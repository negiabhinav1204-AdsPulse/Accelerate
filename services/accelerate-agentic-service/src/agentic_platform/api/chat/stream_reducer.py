"""StreamReducer — infallible snapshot accumulator for AG-UI events.

Folds projected AG-UI events into a StreamSnapshot. Single module,
fully testable without LangGraph. apply() never re-raises.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from uuid import uuid4

from ag_ui.core import (
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    CustomEvent,
    ActivitySnapshotEvent,
    ActivityDeltaEvent,
    RunFinishedEvent,
    RunErrorEvent,
)

from src.agentic_platform.core.engine.models import StepStatus

logger = logging.getLogger(__name__)


# ── Run Status ────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    INTERRUPTED = "interrupted"
    ERROR = "error"


# ── Block ─────────────────────────────────────────────────────────────

@dataclass
class Block:
    """Universal atom — persisted as part of a message."""
    id: str
    type: str
    status: str  # "completed" | "awaiting_input" | "approved" | "rejected"
    content: dict
    sequence: int = 0  # monotonic order from reducer — guarantees stream ordering
    display: str | None = None
    inline_trigger: dict | None = None
    workflow_step: str | None = None


# ── Stream Snapshot ───────────────────────────────────────────────────

@dataclass
class StreamSnapshot:
    """Materialized view of the current stream state."""
    msg_id: str
    run_id: str
    run_status: RunStatus = RunStatus.RUNNING
    text: str = ""
    text_started: bool = False
    text_sequence: int = 0  # sequence when text started — for ordering vs blocks
    blocks: list[Block] = field(default_factory=list)
    workflow_name: str | None = None
    workflow_db_id: str | None = None
    workflow_activity: dict | None = None
    workflow_activity_sequence: int = 0  # sequence of last workflow_activity update
    hitl_interrupted: bool = False
    dirty: bool = False

    def to_db_blocks(self, workflow_id: str | None = None) -> list[dict]:
        """Backward-compatible {"type": ..., "data": ...} format.

        Blocks are sorted by sequence to honour stream ordering.
        Text and workflow_progress are interleaved at their sequence positions.

        workflow_progress is a lightweight reference (just workflow_id) — the
        full data lives in the workflows table. The GET /messages endpoint
        hydrates the reference at read time.
        """
        # Build (sequence, dict) pairs for sorting
        items: list[tuple[int, dict]] = []

        for block in self.blocks:
            db_block: dict = {"id": block.id, "type": block.type, "data": block.content}
            if block.display:
                db_block["display"] = block.display
            if block.inline_trigger:
                db_block["inline_trigger"] = block.inline_trigger
            if block.workflow_step:
                db_block["workflow_step"] = block.workflow_step
            items.append((block.sequence, db_block))

        if workflow_id and self.workflow_name:
            items.append((
                self.workflow_activity_sequence,
                {"id": f"wfp-{workflow_id}", "type": "workflow_progress", "workflow_id": workflow_id},
            ))

        if self.text:
            items.append((self.text_sequence, {"id": f"text-{self.msg_id}", "type": "text", "content": self.text}))

        items.sort(key=lambda x: x[0])
        return [item for _, item in items]

    def to_db_workflow_status(self) -> str:
        """Map workflow activity status to DB status."""
        if self.hitl_interrupted:
            return "waiting_hitl"
        if not self.workflow_activity:
            return "active"

        backend_status = self.workflow_activity.get("status", "active")
        status_map = {
            "completed": "completed",
            "done": "completed",
            "error": "failed",
            "cancelled": "cancelled",
        }
        return status_map.get(backend_status, "active")


# ── Stream Reducer ────────────────────────────────────────────────────

class StreamReducer:
    """Infallible accumulator that folds AG-UI events into a snapshot.

    apply() wraps all handlers in try/except and marks dirty on failure.
    Events are stamped with a monotonic sequence number to guarantee
    stream ordering is preserved through to persistence.
    """

    def __init__(self, msg_id: str, run_id: str) -> None:
        self._snap = StreamSnapshot(msg_id=msg_id, run_id=run_id)
        self._seq = 0  # monotonic counter — incremented on every apply()

    @property
    def snapshot(self) -> StreamSnapshot:
        return self._snap

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq

    def apply(self, event) -> None:
        """Infallible: never re-raises."""
        try:
            self._dispatch(event)
        except Exception:
            logger.warning("Reducer failed to handle event %s", type(event).__name__, exc_info=True)
            self._snap.dirty = True

    def _dispatch(self, event) -> None:
        seq = self._next_seq()

        if isinstance(event, TextMessageStartEvent):
            self._snap.text_started = True
            self._snap.text_sequence = seq

        elif isinstance(event, TextMessageContentEvent):
            self._snap.text += event.delta

        elif isinstance(event, TextMessageEndEvent):
            pass  # no-op — text persisted via to_db_blocks()

        elif isinstance(event, CustomEvent):
            self._handle_custom(event)

        elif isinstance(event, ActivitySnapshotEvent):
            self._snap.workflow_activity = event.content
            self._snap.workflow_activity_sequence = seq
            self._snap.workflow_name = event.message_id.replace("wf-", "") if event.message_id else None

        elif isinstance(event, ActivityDeltaEvent):
            pass  # Final snapshot comes via workflow_progress CUSTOM block

        elif isinstance(event, RunFinishedEvent):
            if self._snap.run_status != RunStatus.INTERRUPTED:
                self._snap.run_status = RunStatus.IDLE

        elif isinstance(event, RunErrorEvent):
            self._snap.run_status = RunStatus.ERROR

        # Step/Reasoning events are ephemeral — no-op

    def _handle_custom(self, event: CustomEvent) -> None:
        if event.name == "hitl_request":
            value = event.value if isinstance(event.value, dict) else {}
            block = Block(
                id=value.get("hitl_id", str(uuid4())),
                type="hitl_request",
                status="awaiting_input",
                content=value,
                sequence=self._seq,
            )
            self._snap.blocks.append(block)
            self._snap.run_status = RunStatus.INTERRUPTED
            self._snap.hitl_interrupted = True

        elif event.name == "workflow_progress":
            # Track for DB entity + persisted as message block via to_db_blocks()
            self._snap.workflow_activity = event.value if isinstance(event.value, dict) else {}
            self._snap.workflow_activity_sequence = self._seq

        else:
            # Ephemeral blocks — streamed to frontend but NOT persisted
            if event.name == "image_preview":
                return

            # Regular UI block
            value = dict(event.value) if isinstance(event.value, dict) else {}
            meta = value.pop("__agui_meta", {})
            block = Block(
                id=str(uuid4()),
                type=event.name,
                status="completed",
                content=value,
                sequence=self._seq,
                display=meta.get("display"),
                inline_trigger=meta.get("inline_trigger"),
                workflow_step=meta.get("workflow_step"),
            )
            self._snap.blocks.append(block)
