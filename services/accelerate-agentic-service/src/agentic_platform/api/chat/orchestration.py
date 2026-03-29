"""Chat orchestration — AG-UI protocol, SSE streaming, chat persistence.

Projects raw LangGraph stream chunks into AG-UI events, folds them
into a StreamReducer snapshot, and yields SSE-encoded events to the
frontend. Uses core.execution for the generic graph execution primitive.

Flow:
  1. Projects raw stream chunks -> AG-UI events (stateless)
  2. Folds each AG-UI event into StreamReducer (reduce first)
  3. Yields SSE-encoded event to frontend (yield second)
  4. Flushes reducer snapshot to DB after stream ends
"""

from __future__ import annotations

import asyncio
import logging
import time as _time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator, TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

from ag_ui.core import (
    RunStartedEvent,
    RunFinishedEvent,
    RunErrorEvent,
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    StepStartedEvent,
    StepFinishedEvent,
    CustomEvent,
    ReasoningMessageChunkEvent,
    ActivitySnapshotEvent,
    ActivityDeltaEvent,
)

from src.agentic_platform.core.auth import UserContext
from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.config import settings
from src.agentic_platform.core.execution import build_graph_config, build_graph_input, execute_graph
from src.agentic_platform.api.chat.persistence import Persistence
from src.agentic_platform.api.sse import sse_encode
from src.agentic_platform.api.chat.stream_reducer import StreamReducer, StreamSnapshot
from src.agentic_platform.core.utils import normalize_content
from src.agentic_platform.core.engine.models import WriterEvent, REPLAY_SUPPRESSED_EVENTS
from src.agentic_platform.core.engine.hitl import is_rejection

logger = logging.getLogger(__name__)

# Suppress harmless OTEL context detach warnings in async generators
logging.getLogger("opentelemetry.context").setLevel(logging.CRITICAL)


# ── Langfuse helper ─────────────────────────────────────────────────

@contextmanager
def _langfuse_trace(conv_id: str, user_message: str, trace_name: str = "chat-agent"):
    """Yields (callbacks, finalize) for Langfuse tracing. No-ops if disabled."""
    if not settings.langfuse_enabled:
        yield [], lambda _text: None
        return

    try:
        from langfuse import get_client, propagate_attributes
        from langfuse.langchain import CallbackHandler

        client = get_client()
        obs_ctx = client.start_as_current_observation(
            as_type="span", name=trace_name, input={"message": user_message},
        )
        session_ctx = propagate_attributes(session_id=conv_id)
        obs_ctx.__enter__()
        session_ctx.__enter__()

        def _finalize(collected_text: str):
            try:
                client.update_current_span(output={"response": collected_text or None})
            except Exception:
                pass

        try:
            yield [CallbackHandler()], _finalize
        finally:
            try:
                session_ctx.__exit__(None, None, None)
                obs_ctx.__exit__(None, None, None)
            except Exception:
                pass
    except Exception:
        logger.debug("Langfuse not available, tracing disabled")
        yield [], lambda _text: None


# ── Background execution with reconnection ───────────────────────────

@dataclass
class _RunState:
    """Tracks a running graph execution — shared across SSE connections."""
    task: asyncio.Task
    events: list  # append-only event log
    done: asyncio.Event  # set when execution completes
    run_id: str

    def subscribe(self, from_index: int = 0) -> AsyncIterator:
        """Yield events starting from `from_index`, then follow live."""
        return self._stream(from_index)

    async def _stream(self, idx: int):
        while True:
            # Yield any buffered events we haven't seen yet
            while idx < len(self.events):
                event = self.events[idx]
                idx += 1
                if event is None:
                    return  # sentinel — execution complete
                yield event
            # Wait for more events or completion
            if self.done.is_set():
                return
            await asyncio.sleep(0.05)  # poll interval


_active_runs: dict[str, _RunState] = {}

_RUN_TTL_SECONDS = 3600  # 1 hour


def _prune_stale_runs() -> None:
    """Remove completed runs older than TTL to prevent memory leaks."""
    now = _time.time()
    stale = [
        k for k, v in _active_runs.items()
        if v.done.is_set() and (now - getattr(v, '_completed_at', now)) > _RUN_TTL_SECONDS
    ]
    for k in stale:
        del _active_runs[k]


# ── Main streaming function ─────────────────────────────────────────

async def run_chat_stream(
    *,
    graph: CompiledStateGraph,
    persistence: Persistence,
    conv_id: str,
    user_message: str | None = None,
    hitl_response: dict | None = None,
    user: UserContext | None = None,
    agent_config: AgentConfig | None = None,
    resume_workflow: bool = False,
) -> AsyncIterator[str]:
    """Execute the agent graph and yield SSE-encoded AG-UI events.

    The graph runs in a background task. If the client disconnects, the
    task continues and persists results. On reconnect (reload/tab switch),
    the new SSE stream replays missed events and follows live progress.
    """
    is_resume = hitl_response is not None or resume_workflow

    # ── Reconnect to existing run if one is active ──
    if resume_workflow:
        existing = _active_runs.get(conv_id)
        if existing and not existing.done.is_set():
            logger.info("Reconnecting to active run %s for conv %s", existing.run_id, conv_id)
            try:
                async for event in existing.subscribe(from_index=0):
                    yield sse_encode(event)
            except asyncio.CancelledError:
                logger.debug("Client disconnected during reconnect for conv %s", conv_id)
            return
        logger.debug("No active task for conv %s, skipping reconnect", conv_id)
        return

    # ── New run ──
    run_id = str(uuid4())
    msg_id = str(uuid4())

    # On HITL resume: reuse existing workflow ID so we UPDATE, not create.
    prior_workflow_id: str | None = None
    if is_resume:
        try:
            workflows = await persistence.get_active_workflows(conv_id)
            for wf in workflows:
                if wf.get("status") == "waiting_hitl":
                    prior_workflow_id = wf.get("id")
                    break
            if not prior_workflow_id:
                for wf in workflows:
                    if wf.get("status") == "active":
                        prior_workflow_id = wf.get("id")
                        break
            if prior_workflow_id:
                logger.debug("HITL resume: reusing workflow %s", prior_workflow_id)
        except Exception as e:
            logger.warning("Failed to look up prior workflow for resume: %s", e)

    reducer = StreamReducer(msg_id=msg_id, run_id=run_id)
    if prior_workflow_id:
        reducer.snapshot.workflow_db_id = prior_workflow_id

    # Shared run state — survives SSE disconnect, supports reconnection
    run_state = _RunState(
        task=None,  # set below
        events=[],
        done=asyncio.Event(),
        run_id=run_id,
    )

    async def _execute_graph():
        """Run graph to completion — survives client disconnect."""
        trace_name = agent_config.langfuse_trace_name if agent_config else "chat-agent"
        with _langfuse_trace(conv_id, user_message or "(resume)", trace_name) as (callbacks, finalize):
            graph_config = build_graph_config(conv_id, user, callbacks=callbacks)

            graph_input = build_graph_input(
                user_message,
                hitl_response=hitl_response,
                resume_workflow=resume_workflow,
            )

            # HITL resume needs persistence for updating HITL block status
            if hitl_response:
                hitl_id = hitl_response.get("hitl_id")
                if hitl_id:
                    try:
                        action = hitl_response.get("action", "")
                        resolved_status = "rejected" if is_rejection(action) else "approved"
                        await persistence.update_hitl_block(conv_id, hitl_id, resolved_status, action)
                    except Exception as e:
                        logger.warning("Failed to update HITL block %s: %s", hitl_id, e)

            run_state.events.append(RunStartedEvent(thread_id=conv_id, run_id=run_id))

            try:
                async for chunk in execute_graph(
                    graph, graph_input, graph_config,
                ):
                    for event in project_chunk(chunk, reducer.snapshot, is_resume):
                        reducer.apply(event)
                        run_state.events.append(event)

                if reducer.snapshot.text_started:
                    end_evt = TextMessageEndEvent(message_id=reducer.snapshot.msg_id)
                    reducer.apply(end_evt)
                    run_state.events.append(end_evt)

            except Exception as e:
                logger.exception("Graph execution failed for conv %s", conv_id)
                if reducer.snapshot.text_started:
                    run_state.events.append(TextMessageEndEvent(message_id=reducer.snapshot.msg_id))
                error_evt = RunErrorEvent(message=str(e))
                reducer.apply(error_evt)
                run_state.events.append(error_evt)

            finished_evt = RunFinishedEvent(thread_id=conv_id, run_id=run_id)
            reducer.apply(finished_evt)
            run_state.events.append(finished_evt)
            finalize(reducer.snapshot.text)

        await _flush_snapshot(persistence, conv_id, run_id, reducer)
        run_state.events.append(None)  # sentinel
        run_state.done.set()

    def _cleanup(task: asyncio.Task):
        state = _active_runs.get(conv_id)
        if state:
            state._completed_at = _time.time()
        _prune_stale_runs()

    task = asyncio.create_task(_execute_graph())
    run_state.task = task
    task.add_done_callback(_cleanup)
    _active_runs[conv_id] = run_state

    # Stream to client — replays from start, follows live
    try:
        async for event in run_state.subscribe(from_index=0):
            yield sse_encode(event)
    except asyncio.CancelledError:
        logger.info("Client disconnected, graph continues in background for conv %s", conv_id)


# ── Chunk projection (pure, stateless) ──────────────────────────────

def project_chunk(chunk: dict, snapshot: StreamSnapshot, is_resume: bool) -> list:
    """Project a single stream chunk -> list of AG-UI events.

    Pure function: reads snapshot for state (e.g. text_started, msg_id)
    but never mutates it. Mutation happens in reducer.apply().
    """
    chunk_type = chunk["type"]
    ns = chunk.get("ns", ())

    if chunk_type == "messages":
        return _handle_messages(chunk["data"], snapshot)
    if chunk_type == "custom":
        return _handle_custom(chunk["data"], is_resume)
    if chunk_type == "updates":
        return _handle_updates(chunk.get("data", {}), ns)
    return []


def _handle_messages(data: tuple, snapshot: StreamSnapshot) -> list:
    """LLM token stream -> TEXT_MESSAGE events."""
    message_chunk, metadata = data
    if metadata.get("langgraph_node") != "agent":
        return []
    if hasattr(message_chunk, "tool_call_chunks") and message_chunk.tool_call_chunks:
        return []
    text = normalize_content(message_chunk.content)
    if not text:
        return []

    events = []
    if not snapshot.text_started:
        events.append(TextMessageStartEvent(message_id=snapshot.msg_id, role="assistant"))
    events.append(TextMessageContentEvent(message_id=snapshot.msg_id, delta=text))
    return events


def _handle_custom(event: dict, is_resume: bool) -> list:
    """StreamWriter events -> AG-UI events (pure projection, no side effects)."""
    event_type = event.get("type", "")

    # Suppress replayed step/thinking on resume
    if is_resume and event_type in REPLAY_SUPPRESSED_EVENTS:
        return []

    return _to_ag_event(event)


def _handle_updates(update_data: dict, ns: tuple = ()) -> list:
    """Graph state updates -> detect HITL interrupts."""
    if "__interrupt__" not in update_data:
        return []

    # Filter: only process interrupts at the parent level to avoid duplicates
    if ns:
        return []

    events = []
    for interrupt_info in update_data["__interrupt__"]:
        value = interrupt_info.value if hasattr(interrupt_info, "value") else interrupt_info.get("value", {})
        if isinstance(value, dict) and value.get("hitl_id"):
            events.append(CustomEvent(name="hitl_request", value=value))
    return events


# ── Persistence ─────────────────────────────────────────────────────

async def _flush_snapshot(
    persistence: Persistence, conv_id: str, run_id: str, reducer: StreamReducer,
) -> None:
    """Persist reducer snapshot to DB."""
    snapshot = reducer.snapshot

    # ── 1. Persist workflow state (if any) -> get workflow_id ──
    workflow_id: str | None = snapshot.workflow_db_id
    if snapshot.workflow_activity and snapshot.workflow_name:
        db_status = snapshot.to_db_workflow_status()
        try:
            if workflow_id:
                await persistence.update_workflow(
                    workflow_id,
                    activity_content=snapshot.workflow_activity,
                    status=db_status,
                )
            else:
                result = await persistence.create_workflow(
                    conversation_id=conv_id,
                    workflow_name=snapshot.workflow_name,
                    run_id=run_id,
                    thread_id=conv_id,
                    activity_content=snapshot.workflow_activity,
                    status=db_status,
                )
                workflow_id = result.get("id")
                snapshot.workflow_db_id = workflow_id
        except Exception as e:
            logger.error("Failed to persist workflow state for conv %s: %s", conv_id, e, exc_info=True)
            workflow_id = None  # Don't include broken reference in message

    # ── 2. Persist assistant message ──
    blocks = snapshot.to_db_blocks(workflow_id=workflow_id)
    if blocks:
        try:
            await persistence.add_message(conv_id, "assistant", blocks)
        except Exception as e:
            logger.warning("Failed to persist assistant message for conv %s: %s", conv_id, e)


# ── Event mapping ───────────────────────────────────────────────────

def _to_ag_event(event: dict) -> list:
    """Map a StreamWriter dict to AG-UI SSE events."""
    event_type = event.get("type", "")

    if event_type == WriterEvent.THINKING:
        return [ReasoningMessageChunkEvent(
            message_id=event.get("message_id", "thinking"),
            delta=event["content"],
        )]
    if event_type == WriterEvent.STEP_STARTED:
        return [StepStartedEvent(step_name=event["stepName"])]
    if event_type == WriterEvent.STEP_FINISHED:
        return [StepFinishedEvent(step_name=event["stepName"])]
    if event_type == WriterEvent.CUSTOM:
        value = dict(event.get("value", {}))
        meta = {k: event[k] for k in ("display", "inline_trigger", "workflow_step", "block_id") if event.get(k)}
        if meta:
            value["__agui_meta"] = meta
        return [CustomEvent(name=event["name"], value=value)]
    if event_type == WriterEvent.ACTIVITY_SNAPSHOT:
        return [ActivitySnapshotEvent(
            message_id=event["message_id"],
            activity_type=event["activity_type"],
            content=event["content"],
        )]
    if event_type == WriterEvent.ACTIVITY_DELTA:
        return [ActivityDeltaEvent(
            message_id=event["message_id"],
            activity_type=event["activity_type"],
            patch=event["patch"],
        )]
    return []
