"""Tests for orchestrator — thin pass-through for graph events."""

import json
import pytest
from unittest.mock import AsyncMock

from langchain_core.messages import AIMessageChunk

from src.agentic_platform.api.chat.orchestration import run_chat_stream
from src.agentic_platform.api.chat.persistence import Persistence


def parse_sse(raw: str) -> list[dict]:
    events = []
    for line in raw.split("\n"):
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


async def collect_stream(**kwargs) -> str:
    raw = ""
    async for chunk in run_chat_stream(**kwargs):
        raw += chunk
    return raw


class FakeGraph:
    """Yields v2 StreamPart dicts for messages+custom multi-mode."""

    def __init__(self, chunks: list[dict]):
        self._chunks = chunks

    async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
        for c in self._chunks:
            yield c


def text_chunks(tokens: list[str]) -> list[dict]:
    return [
        {"type": "messages", "ns": (), "data": (AIMessageChunk(content=t), {"langgraph_node": "agent"})}
        for t in tokens
    ]


def tool_chunks(tool_name: str, ui_blocks: list[dict] | None = None, final_tokens: list[str] | None = None) -> list[dict]:
    """Simulate StreamingToolNode custom events + final text."""
    chunks = [
        {"type": "custom", "ns": (), "data": {"type": "THINKING", "content": "Working..."}},
        {"type": "custom", "ns": (), "data": {"type": "STEP_STARTED", "stepName": tool_name}},
        {"type": "custom", "ns": (), "data": {"type": "STEP_FINISHED", "stepName": tool_name}},
    ]
    for block in (ui_blocks or []):
        chunks.append({"type": "custom", "ns": (), "data": {"type": "CUSTOM", "name": block["type"], "value": block["data"]}})
    for t in (final_tokens or []):
        chunks.append({"type": "messages", "ns": (), "data": (AIMessageChunk(content=t), {"langgraph_node": "agent"})})
    return chunks


class TestTextStreaming:
    async def test_streams_tokens(self):
        raw = await collect_stream(
            graph=FakeGraph(text_chunks(["Hello ", "world!"])),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        types = [e["type"] for e in events]
        assert types == [
            "RUN_STARTED", "TEXT_MESSAGE_START",
            "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_CONTENT",
            "TEXT_MESSAGE_END", "RUN_FINISHED",
        ]
        assert "".join(e["delta"] for e in events if e["type"] == "TEXT_MESSAGE_CONTENT") == "Hello world!"

    async def test_empty_response(self):
        raw = await collect_stream(
            graph=FakeGraph(text_chunks([""])),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        assert [e["type"] for e in events] == ["RUN_STARTED", "RUN_FINISHED"]

    async def test_persists_text(self):
        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=FakeGraph(text_chunks(["Hello!"])),
            persistence=persistence, conv_id="c1", user_message="Hi",
        )
        persistence.add_message.assert_awaited_once()
        saved = persistence.add_message.call_args[0][2]
        assert len(saved) == 1
        assert saved[0]["type"] == "text"
        assert saved[0]["content"] == "Hello!"
        assert "id" in saved[0]  # block ID assigned by reducer

    async def test_skips_tool_call_chunks(self):
        tc_chunk = AIMessageChunk(content="", tool_call_chunks=[{"name": "foo", "args": "", "id": "tc1", "index": 0}])
        chunks = [
            {"type": "messages", "ns": (), "data": (tc_chunk, {"langgraph_node": "agent"})},
            {"type": "messages", "ns": (), "data": (AIMessageChunk(content="Final."), {"langgraph_node": "agent"})},
        ]
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        deltas = [e["delta"] for e in events if e["type"] == "TEXT_MESSAGE_CONTENT"]
        assert deltas == ["Final."]


class TestToolStreaming:
    async def test_step_events(self):
        chunks = tool_chunks("query_analytics", final_tokens=["Done."])
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="How are campaigns?",
        )
        events = parse_sse(raw)
        types = [e["type"] for e in events]
        assert "STEP_STARTED" in types
        assert "STEP_FINISHED" in types
        step = next(e for e in events if e["type"] == "STEP_STARTED")
        assert step["stepName"] == "query_analytics"

    async def test_thinking_event(self):
        chunks = tool_chunks("query_analytics", final_tokens=["Done."])
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        reasoning = [e for e in events if e["type"] == "REASONING_MESSAGE_CHUNK"]
        assert len(reasoning) == 1
        assert reasoning[0]["delta"] == "Working..."

    async def test_ui_blocks(self):
        blocks = [{"type": "analytics_dashboard", "data": {"campaigns": [1, 2]}}]
        chunks = tool_chunks("query_analytics", ui_blocks=blocks, final_tokens=["Here."])
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        custom_events = [e for e in events if e["type"] == "CUSTOM" and e["name"] == "analytics_dashboard"]
        assert len(custom_events) == 1
        assert custom_events[0]["value"] == {"campaigns": [1, 2]}

    async def test_persists_blocks_and_text(self):
        blocks = [{"type": "chart", "data": {"x": 1}}]
        chunks = tool_chunks("my_tool", ui_blocks=blocks, final_tokens=["Summary."])
        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=FakeGraph(chunks),
            persistence=persistence, conv_id="c1", user_message="Go",
        )
        persistence.add_message.assert_awaited_once()
        saved = persistence.add_message.call_args[0][2]
        assert saved[0]["type"] == "chart"
        assert saved[0]["data"] == {"x": 1}
        assert "id" in saved[0]
        assert saved[1]["type"] == "text"
        assert saved[1]["content"] == "Summary."

    async def test_event_order(self):
        """Step events come before text events."""
        blocks = [{"type": "dash", "data": {}}]
        chunks = tool_chunks("tool", ui_blocks=blocks, final_tokens=["Done."])
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        types = [e["type"] for e in events]
        step_idx = types.index("STEP_STARTED")
        text_idx = types.index("TEXT_MESSAGE_START")
        assert step_idx < text_idx


class TestHITLResume:
    async def test_hitl_interrupt_emits_custom_event(self):
        """__interrupt__ in updates stream → CustomEvent(name='hitl_request')."""
        class InterruptGraph:
            async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
                yield {"type": "custom", "ns": (), "data": {"type": "THINKING", "content": "Checking..."}}
                yield {"type": "custom", "ns": (), "data": {"type": "STEP_STARTED", "stepName": "my_tool"}}
                yield {"type": "custom", "ns": (), "data": {"type": "STEP_FINISHED", "stepName": "my_tool"}}
                yield {
                    "type": "updates",
                    "ns": (),
                    "data": {"__interrupt__": [
                        type("Interrupt", (), {"value": {"hitl_id": "hitl-abc123", "title": "Approve?", "type": "confirmation"}})()
                    ]},
                }

        raw = await collect_stream(
            graph=InterruptGraph(),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        hitl_events = [e for e in events if e.get("type") == "CUSTOM" and e.get("name") == "hitl_request"]
        assert len(hitl_events) == 1
        assert hitl_events[0]["value"]["hitl_id"] == "hitl-abc123"

    async def test_hitl_persists_blocks_including_request(self):
        """HITL interrupt persists the hitl_request block."""
        class InterruptGraph:
            async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
                yield {
                    "type": "updates",
                    "ns": (),
                    "data": {"__interrupt__": [
                        type("Interrupt", (), {"value": {"hitl_id": "hitl-x", "title": "Ok?", "type": "confirmation"}})()
                    ]},
                }

        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=InterruptGraph(),
            persistence=persistence, conv_id="c1", user_message="Hi",
        )
        persistence.add_message.assert_awaited_once()
        saved = persistence.add_message.call_args[0][2]
        assert any(b["type"] == "hitl_request" for b in saved)

    async def test_resume_suppresses_replay_events(self):
        """On HITL resume, replayed THINKING/STEP events are suppressed."""
        chunks = [
            {"type": "custom", "ns": (), "data": {"type": "THINKING", "content": "Replayed..."}},
            {"type": "custom", "ns": (), "data": {"type": "STEP_STARTED", "stepName": "tool"}},
            {"type": "custom", "ns": (), "data": {"type": "STEP_FINISHED", "stepName": "tool"}},
            {"type": "messages", "ns": (), "data": (AIMessageChunk(content="Result."), {"langgraph_node": "agent"})},
        ]
        raw = await collect_stream(
            graph=FakeGraph(chunks),
            persistence=AsyncMock(spec=Persistence),
            conv_id="c1",
            hitl_response={"action": "approve", "hitl_id": "hitl-abc"},
        )
        events = parse_sse(raw)
        types = [e["type"] for e in events]
        # THINKING and STEP events should be suppressed on resume
        assert "REASONING_MESSAGE_CHUNK" not in types
        assert "STEP_STARTED" not in types
        assert "STEP_FINISHED" not in types
        # But text still comes through
        assert "TEXT_MESSAGE_CONTENT" in types

    async def test_resume_persists_hitl_resolution(self):
        """On resume, orchestrator calls update_hitl_block with correct status."""
        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=FakeGraph(text_chunks(["Done."])),
            persistence=persistence,
            conv_id="c1",
            hitl_response={"action": "reject", "hitl_id": "hitl-xyz", "reason": "No"},
        )
        persistence.update_hitl_block.assert_awaited_once_with(
            "c1", "hitl-xyz", "rejected", "reject",
        )

    async def test_resume_cancel_action_persists_as_rejected(self):
        """'cancel' action is persisted as 'rejected' status (centralized rejection check)."""
        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=FakeGraph(text_chunks(["Done."])),
            persistence=persistence,
            conv_id="c1",
            hitl_response={"action": "cancel", "hitl_id": "hitl-xyz"},
        )
        persistence.update_hitl_block.assert_awaited_once_with(
            "c1", "hitl-xyz", "rejected", "cancel",
        )

    async def test_text_persisted_even_during_hitl_interrupt(self):
        """Text streamed before HITL interrupt is still persisted."""
        class TextThenInterruptGraph:
            async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
                yield {"type": "messages", "ns": (), "data": (AIMessageChunk(content="Let me check"), {"langgraph_node": "agent"})}
                yield {
                    "type": "updates",
                    "ns": (),
                    "data": {"__interrupt__": [
                        type("Interrupt", (), {"value": {"hitl_id": "hitl-t", "title": "Ok?", "type": "confirmation"}})()
                    ]},
                }

        persistence = AsyncMock(spec=Persistence)
        await collect_stream(
            graph=TextThenInterruptGraph(),
            persistence=persistence, conv_id="c1", user_message="Hi",
        )
        persistence.add_message.assert_awaited_once()
        saved = persistence.add_message.call_args[0][2]
        text_blocks = [b for b in saved if b.get("type") == "text"]
        assert len(text_blocks) == 1
        assert text_blocks[0]["content"] == "Let me check"


class TestErrorHandling:
    async def test_error_mid_stream(self):
        class ErrorGraph:
            async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
                yield {"type": "messages", "ns": (), "data": (AIMessageChunk(content="partial"), {"langgraph_node": "agent"})}
                raise RuntimeError("boom")

        raw = await collect_stream(
            graph=ErrorGraph(), persistence=AsyncMock(spec=Persistence),
            conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        types = [e["type"] for e in events]
        assert "RUN_ERROR" in types
        assert "TEXT_MESSAGE_END" in types
        assert events[-1]["type"] == "RUN_FINISHED"

    async def test_persistence_failure(self):
        persistence = AsyncMock(spec=Persistence)
        persistence.add_message.side_effect = RuntimeError("DB down")
        raw = await collect_stream(
            graph=FakeGraph(text_chunks(["Hi!"])),
            persistence=persistence, conv_id="c1", user_message="Hi",
        )
        events = parse_sse(raw)
        assert events[-1]["type"] == "RUN_FINISHED"
