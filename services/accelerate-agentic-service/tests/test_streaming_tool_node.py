"""Tests for StreamingToolNode — auto thinking, steps, UI blocks."""

import pytest
from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool

from src.agentic_platform.core.engine.executor import StreamingToolNode, _parse_tool_response
from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, UIBlock, ToolTag


@tool("mock_analytics")
async def _mock_analytics(query: str) -> dict:
    """Mock analytics tool."""
    return ToolResponse(
        summary="3 campaigns found",
        ui_blocks=[UIBlock(type="dashboard", data={"campaigns": [1, 2, 3]})],
    ).model_dump()

mock_analytics = AgenticTool(
    func=_mock_analytics,
    thinking_messages=["Analyzing..."],
    tags=[ToolTag.ANALYTICS],
)


@tool("mock_simple")
async def _mock_simple(query: str) -> dict:
    """Simple tool with no UI blocks."""
    return ToolResponse(summary="Done").model_dump()

mock_simple = AgenticTool(func=_mock_simple, thinking_messages=["Working..."])


@tool("mock_failing")
async def _mock_failing(query: str) -> dict:
    """Tool that raises."""
    raise RuntimeError("BigQuery down")

mock_failing = AgenticTool(func=_mock_failing, timeout=5)


def _make_state(tool_calls: list[dict]) -> dict:
    return {"messages": [AIMessage(content="", tool_calls=tool_calls)]}


def _tc(name: str, args: dict | None = None, id: str = "tc1") -> dict:
    return {"name": name, "args": args or {"query": "x"}, "id": id}


def _writer_calls(writer: MagicMock) -> list[dict]:
    return [c[0][0] for c in writer.call_args_list]


class TestStreamingToolNode:
    async def test_emits_thinking_from_tool(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics])
        await node(_make_state([_tc("mock_analytics")]), writer)

        calls = _writer_calls(writer)
        thinking = next(c for c in calls if c["type"] == "THINKING")
        assert thinking["content"] == "Analyzing..."  # from the tool's own messages

    async def test_emits_step_events(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics])
        await node(_make_state([_tc("mock_analytics")]), writer)

        calls = _writer_calls(writer)
        types = [c["type"] for c in calls]
        assert "STEP_STARTED" in types
        assert "STEP_FINISHED" in types

    async def test_emits_ui_blocks(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics])
        await node(_make_state([_tc("mock_analytics")]), writer)

        calls = _writer_calls(writer)
        custom = [c for c in calls if c["type"] == "CUSTOM"]
        assert len(custom) == 1
        assert custom[0]["name"] == "dashboard"

    async def test_tool_message_uses_for_llm(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics])
        result = await node(_make_state([_tc("mock_analytics")]), writer)

        msgs = result["messages"]
        assert len(msgs) == 1
        assert isinstance(msgs[0], ToolMessage)
        assert "3 campaigns found" in msgs[0].content
        assert "dashboard" not in msgs[0].content

    async def test_no_ui_blocks(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_simple])
        await node(_make_state([_tc("mock_simple")]), writer)

        calls = _writer_calls(writer)
        assert not [c for c in calls if c["type"] == "CUSTOM"]

    async def test_tool_error_emits_step_finished(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_failing])
        result = await node(_make_state([_tc("mock_failing")]), writer)

        calls = _writer_calls(writer)
        assert "STEP_FINISHED" in [c["type"] for c in calls]
        assert "BigQuery down" in result["messages"][0].content

    async def test_parallel_execution(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics, mock_simple])
        result = await node(
            _make_state([_tc("mock_analytics", id="tc1"), _tc("mock_simple", id="tc2")]),
            writer,
        )

        assert len(result["messages"]) == 2
        assert result["messages"][0].tool_call_id == "tc1"
        assert result["messages"][1].tool_call_id == "tc2"

    async def test_no_tool_calls(self):
        writer = MagicMock()
        node = StreamingToolNode([mock_analytics])
        result = await node({"messages": [AIMessage(content="Hello")]}, writer)
        assert result == {"messages": []}


class TestParseToolResponse:
    def test_from_dict(self):
        r = _parse_tool_response({"summary": "ok", "ui_blocks": [{"type": "x", "data": {}}]})
        assert r.summary == "ok"
        assert len(r.ui_blocks) == 1

    def test_from_tool_response(self):
        assert _parse_tool_response(ToolResponse(summary="direct")).summary == "direct"

    def test_from_string(self):
        assert _parse_tool_response("plain text").data == "plain text"

    def test_from_unknown_dict(self):
        # Dicts without ToolResponse keys are wrapped as opaque data
        result = _parse_tool_response({"unexpected": "fields"})
        assert result.data == {"unexpected": "fields"}
