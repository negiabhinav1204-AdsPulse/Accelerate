"""HITL — Human-in-the-Loop infrastructure.

One function: request_human_input(). Called from StreamingToolNode.
This is the ONLY place interrupt() is called in the entire codebase.

Tools signal HITL via:
  - ToolResponse.hitl (post-execution: "approve this result?")
  - AgenticTool.hitl_policy="always" (pre-execution: "confirm before running?")

Both flow through request_human_input() -> same interrupt() -> same SSE event -> same resume.
"""

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from langgraph.types import interrupt

logger = logging.getLogger(__name__)


def _generate_hitl_id() -> str:
    import uuid
    return f"hitl-{uuid.uuid4().hex[:12]}"


class HITLType(str, Enum):
    CONFIRMATION = "confirmation"  # title + description + payload table + action buttons
    FORM = "form"                  # dynamic input fields + submit
    CHOICE = "choice"              # radio/card selection


class HITLAction(str, Enum):
    """All recognized HITL user actions — single source of truth."""
    APPROVE = "approve"
    REJECT = "reject"
    CANCEL = "cancel"
    SUBMIT = "submit"
    SELECT = "select"


REJECTION_ACTIONS = frozenset((HITLAction.REJECT, HITLAction.CANCEL))
"""Actions that mean "user said no". Used by executor + orchestrator."""


class HITLPolicy(str, Enum):
    NEVER = "never"
    ALWAYS = "always"


# ── Typed sub-models for HITL request fields ─────────────────────────

class HITLActionButton(BaseModel):
    action: HITLAction
    label: str
    style: str = "default"  # "primary" | "default" | "danger"


class HITLField(BaseModel):
    name: str
    label: str
    type: str  # text, textarea, number, slider, date, select, multiselect, toggle, email, url, color
    required: bool = False
    placeholder: str | None = None
    default: Any = None
    min: float | None = None
    max: float | None = None
    step: float | None = None
    rows: int | None = None
    options: list[dict[str, Any]] | None = None


class HITLChoice(BaseModel):
    value: str
    label: str
    description: str = ""


class HITLRequest(BaseModel):
    hitl_id: str = Field(default_factory=_generate_hitl_id)
    type: HITLType = HITLType.CONFIRMATION
    title: str = ""
    description: str | None = None
    danger: bool = False  # red styling for destructive actions
    payload: dict[str, Any] = {}
    actions: list[HITLActionButton] = []
    fields: list[HITLField] | None = None
    choices: list[HITLChoice] | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def is_rejection(action: str) -> bool:
    """Check if an action string represents a rejection."""
    return action in {a.value for a in REJECTION_ACTIONS}


def request_human_input(request: HITLRequest) -> dict:
    """Pause execution and wait for human input.

    This is the ONLY place interrupt() is called in the entire codebase.
    Tools, workflows, guardrails — all call this one function.

    The orchestrator emits the HITL_REQUEST SSE event when it detects
    __interrupt__ in the updates stream — not here. This avoids duplicate
    events on resume (LangGraph re-executes the full node).

    Args:
        request: HITLRequest describing what to ask the human

    Returns:
        dict with user's decision: {"action": "approve", ...}
    """
    data = request.model_dump(mode="json")
    data["status"] = "pending"
    decision = interrupt(data)
    return decision


def build_confirmation(
    title: str,
    description: str = "",
    payload: dict | None = None,
    danger: bool = False,
) -> HITLRequest:
    """Convenience: build a simple approve/reject confirmation."""
    return HITLRequest(
        type=HITLType.CONFIRMATION,
        title=title,
        description=description,
        danger=danger,
        payload=payload or {},
        actions=[
            HITLActionButton(action=HITLAction.APPROVE, label="Proceed", style="primary"),
            HITLActionButton(action=HITLAction.REJECT, label="Cancel", style="default"),
        ],
    )
