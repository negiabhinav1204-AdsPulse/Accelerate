"""Tests for HITL infrastructure — request_human_input, HITL gate in executor."""

import json
import pytest
from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool

from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.executor import StreamingToolNode
from src.agentic_platform.core.engine.hitl import (
    HITLRequest, HITLType, HITLPolicy, HITLAction, HITLActionButton,
    request_human_input, build_confirmation, is_rejection,
)


# ── Test tools ───────────────────────────────────────────────────────

@tool("safe_tool")
async def _safe_tool(query: str) -> dict:
    """A safe tool that never needs approval."""
    return ToolResponse(summary="Done safely").model_dump()

safe_tool = AgenticTool(func=_safe_tool, thinking_messages=["Working..."])


@tool("dangerous_tool")
async def _dangerous_tool(target: str) -> dict:
    """A dangerous tool that always needs pre-execution approval."""
    return ToolResponse(summary=f"Deleted {target}").model_dump()

dangerous_tool = AgenticTool(
    func=_dangerous_tool,
    thinking_messages=["Preparing..."],
    hitl_policy="always",
)


@tool("tool_with_hitl_response")
async def _tool_with_hitl_response(query: str) -> dict:
    """A tool that returns a HITL request for post-execution approval."""
    return ToolResponse(
        summary="Budget proposal ready",
        hitl=build_confirmation(
            title="Approve budget changes?",
            payload={"total": 650},
        ).model_dump(),
    ).model_dump()

hitl_response_tool = AgenticTool(func=_tool_with_hitl_response, thinking_messages=["Analyzing..."])


# ── HITLRequest model tests ──────────────────────────────────────────

class TestHITLRequest:
    def test_auto_generates_id(self):
        r = HITLRequest(type=HITLType.CONFIRMATION, title="Test")
        assert r.hitl_id.startswith("hitl-")
        assert len(r.hitl_id) > 5

    def test_preserves_explicit_id(self):
        r = HITLRequest(hitl_id="hitl-custom123", title="Test")
        assert r.hitl_id == "hitl-custom123"

    def test_has_created_at(self):
        r = HITLRequest(title="Test")
        assert r.created_at  # non-empty ISO timestamp

    def test_build_confirmation(self):
        r = build_confirmation("Delete all?", "This is irreversible", {"count": 5})
        assert r.type == HITLType.CONFIRMATION
        assert r.title == "Delete all?"
        assert r.payload == {"count": 5}
        assert len(r.actions) == 2
        assert r.actions[0].action == HITLAction.APPROVE
        assert r.actions[1].action == HITLAction.REJECT

    def test_actions_are_typed(self):
        r = build_confirmation("Test?")
        for action_btn in r.actions:
            assert isinstance(action_btn, HITLActionButton)


class TestIsRejection:
    def test_reject_is_rejection(self):
        assert is_rejection("reject") is True

    def test_cancel_is_rejection(self):
        assert is_rejection("cancel") is True

    def test_approve_is_not_rejection(self):
        assert is_rejection("approve") is False

    def test_submit_is_not_rejection(self):
        assert is_rejection("submit") is False

    def test_empty_is_not_rejection(self):
        assert is_rejection("") is False


# ── request_human_input tests ────────────────────────────────────────

class TestRequestHumanInput:
    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    def test_calls_interrupt_and_returns_decision(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "approve"}
        request = build_confirmation("Proceed?")

        decision = request_human_input(request)

        # interrupt() was called with JSON-serializable data
        mock_interrupt.assert_called_once()
        interrupt_data = mock_interrupt.call_args[0][0]
        assert interrupt_data["status"] == "pending"
        assert interrupt_data["title"] == "Proceed?"
        # Enums serialized to strings (mode="json")
        assert interrupt_data["type"] == "confirmation"

        # Decision returned
        assert decision == {"action": "approve"}


# ── StreamingToolNode HITL gate tests ────────────────────────────────

def _make_state(tool_calls):
    return {"messages": [AIMessage(content="", tool_calls=tool_calls)]}

def _tc(name, args=None, id="tc1"):
    return {"name": name, "args": args or {}, "id": id}

def _writer_calls(writer):
    return [c[0][0] for c in writer.call_args_list]


class TestHITLGatePreExecution:
    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_policy_always_asks_before_execution(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "approve"}
        writer = MagicMock()
        node = StreamingToolNode([dangerous_tool])

        result = await node(_make_state([_tc("dangerous_tool", {"target": "all"})]), writer)

        # interrupt() was called (HITL gate triggered)
        mock_interrupt.assert_called_once()

        # Tool executed after approval
        assert "Deleted all" in result["messages"][0].content

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_policy_always_rejected_cancels_tool(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "reject", "reason": "Changed my mind"}
        writer = MagicMock()
        node = StreamingToolNode([dangerous_tool])

        result = await node(_make_state([_tc("dangerous_tool", {"target": "all"})]), writer)

        # Tool should NOT have executed — cancelled by user
        assert "Cancelled by user" in result["messages"][0].content
        assert "Changed my mind" in result["messages"][0].content

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_policy_always_cancel_action_also_rejects(self, mock_interrupt):
        """Verify 'cancel' is treated the same as 'reject' (centralized rejection check)."""
        mock_interrupt.return_value = {"action": "cancel", "reason": "Nevermind"}
        writer = MagicMock()
        node = StreamingToolNode([dangerous_tool])

        result = await node(_make_state([_tc("dangerous_tool", {"target": "all"})]), writer)

        assert "Cancelled by user" in result["messages"][0].content

    async def test_policy_never_skips_hitl(self):
        writer = MagicMock()
        node = StreamingToolNode([safe_tool])

        result = await node(_make_state([_tc("safe_tool", {"query": "test"})]), writer)

        # Tool executed normally — no interrupt
        assert "Done safely" in result["messages"][0].content


class TestHITLGatePostExecution:
    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_tool_hitl_response_triggers_interrupt(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "approve"}
        writer = MagicMock()
        node = StreamingToolNode([hitl_response_tool])

        result = await node(_make_state([_tc("tool_with_hitl_response", {"query": "budget"})]), writer)

        # interrupt() called with HITL data
        mock_interrupt.assert_called_once()
        interrupt_data = mock_interrupt.call_args[0][0]
        assert interrupt_data["title"] == "Approve budget changes?"

        # Approved — tool response used
        assert "Budget proposal ready" in result["messages"][0].content

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_tool_hitl_rejected(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "reject", "reason": "Too expensive"}
        writer = MagicMock()
        node = StreamingToolNode([hitl_response_tool])

        result = await node(_make_state([_tc("tool_with_hitl_response", {"query": "budget"})]), writer)

        assert "Rejected by user" in result["messages"][0].content
        assert "Too expensive" in result["messages"][0].content

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_tool_hitl_cancel_action_rejects(self, mock_interrupt):
        """Verify 'cancel' in post-execution gate is treated as rejection."""
        mock_interrupt.return_value = {"action": "cancel", "reason": "Changed mind"}
        writer = MagicMock()
        node = StreamingToolNode([hitl_response_tool])

        result = await node(_make_state([_tc("tool_with_hitl_response", {"query": "budget"})]), writer)

        assert "Rejected by user" in result["messages"][0].content

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_tool_hitl_form_submission(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "submit", "modifications": {"budget": 500}}
        writer = MagicMock()
        node = StreamingToolNode([hitl_response_tool])

        result = await node(_make_state([_tc("tool_with_hitl_response", {"query": "budget"})]), writer)

        assert "User input" in result["messages"][0].content
        assert "500" in result["messages"][0].content


class TestHITLToolSerialization:
    """HITL-policy tools run sequentially, safe tools run concurrently."""

    @patch("src.agentic_platform.core.engine.hitl.interrupt")
    async def test_mixed_tools_hitl_runs_after_safe(self, mock_interrupt):
        mock_interrupt.return_value = {"action": "approve"}
        writer = MagicMock()
        node = StreamingToolNode([safe_tool, dangerous_tool])

        state = _make_state([
            _tc("safe_tool", {"query": "test"}, id="tc1"),
            _tc("dangerous_tool", {"target": "x"}, id="tc2"),
        ])
        result = await node(state, writer)

        # Both tools executed
        assert len(result["messages"]) == 2
        contents = [m.content for m in result["messages"]]
        assert any("Done safely" in c for c in contents)
        assert any("Deleted x" in c for c in contents)


class TestParseToolResponse:
    """_parse_tool_response fails loudly on ToolResponse-shaped dicts with schema errors."""

    def test_rejects_malformed_tool_response_dict(self):
        from src.agentic_platform.core.engine.executor import _parse_tool_response
        # Dict with a ToolResponse key but wrong types — should raise, not silently wrap
        with pytest.raises(Exception):
            _parse_tool_response({"summary": 123, "ui_blocks": "not a list"}, "test_tool")

    def test_wraps_opaque_dict_as_data(self):
        from src.agentic_platform.core.engine.executor import _parse_tool_response
        # Dict with no ToolResponse keys — treated as opaque data
        result = _parse_tool_response({"foo": "bar"}, "test_tool")
        assert result.data == {"foo": "bar"}
