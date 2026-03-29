"""StreamEmitter — typed wrapper around LangGraph's StreamWriter.

All streaming in the platform goes through this.
Executor, workflow SDK, and any custom node receive a StreamEmitter,
never a raw writer().
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langgraph.types import StreamWriter

# String constants matching WriterEvent enum values.
# Defined here (not imported) to avoid circular import:
# stream_emitter -> engine.models -> engine/__init__ -> engine.executor -> stream_emitter
_THINKING = "THINKING"
_STEP_STARTED = "STEP_STARTED"
_STEP_FINISHED = "STEP_FINISHED"
_CUSTOM = "CUSTOM"
_ACTIVITY_SNAPSHOT = "ACTIVITY_SNAPSHOT"
_ACTIVITY_DELTA = "ACTIVITY_DELTA"


class StreamEmitter:
    """Typed interface to LangGraph's StreamWriter.

    All streaming events go through typed methods — no raw dicts.
    Devs call emitter.thinking(msg), emitter.step_started(name), etc.
    """

    def __init__(self, writer: StreamWriter) -> None:
        self._writer = writer

    # ── Ephemeral indicators (not persisted) ──────────────────────────

    def thinking(self, content: str, message_id: str = "thinking") -> None:
        """Emit a reasoning/thinking indicator."""
        self._writer({
            "type": _THINKING,
            "message_id": message_id,
            "content": content,
        })

    def step_started(self, step_name: str) -> None:
        """Emit a step-started indicator."""
        self._writer({"type": _STEP_STARTED, "stepName": step_name})

    def step_finished(self, step_name: str) -> None:
        """Emit a step-finished indicator."""
        self._writer({"type": _STEP_FINISHED, "stepName": step_name})

    # ── UI blocks (persisted) ─────────────────────────────────────────

    def block(
        self,
        block_type: str,
        data: dict,
        display: str = "inline",
        inline_trigger: dict | None = None,
        workflow_step: str | None = None,
        block_id: str | None = None,
    ) -> None:
        """Emit a UI block (CUSTOM event).

        Only includes display/inline_trigger/workflow_step/block_id when non-default,
        so workflow_progress and other internal events stay clean.

        block_id: If set, the frontend replaces any existing block with this ID
        in-place instead of appending. Use for progressive updates (e.g. image
        preview -> sharper preview -> final image).
        """
        event: dict = {
            "type": _CUSTOM,
            "name": block_type,
            "value": data,
        }
        if display != "inline":
            event["display"] = display
        if inline_trigger:
            event["inline_trigger"] = inline_trigger
        if workflow_step:
            event["workflow_step"] = workflow_step
        if block_id:
            event["block_id"] = block_id
        self._writer(event)

    # ── Workflow activity (persisted to workflow entity) ───────────────

    def activity_snapshot(
        self, message_id: str, activity_type: str, content: dict,
    ) -> None:
        """Emit a full workflow activity snapshot."""
        self._writer({
            "type": _ACTIVITY_SNAPSHOT,
            "message_id": message_id,
            "activity_type": activity_type,
            "content": content,
        })

    def activity_delta(
        self, message_id: str, activity_type: str, patch: list[dict],
    ) -> None:
        """Emit an incremental workflow activity patch."""
        self._writer({
            "type": _ACTIVITY_DELTA,
            "message_id": message_id,
            "activity_type": activity_type,
            "patch": patch,
        })
