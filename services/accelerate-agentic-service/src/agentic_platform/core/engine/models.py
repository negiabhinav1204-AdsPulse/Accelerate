"""Framework models for tools.

AgenticTool wraps a LangChain BaseTool with thinking messages, tags,
and timeout — making each tool file the single source of truth.
"""

import json
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langchain_core.tools import BaseTool
from langgraph.graph.message import add_messages


# ── Agent State ──────────────────────────────────────────────────────

class AgentState(TypedDict):
    """LangGraph state for the ReAct agent."""
    messages: Annotated[list[BaseMessage], add_messages]


# ── Enums ────────────────────────────────────────────────────────────

class ToolTag(str, Enum):
    """Tool categories — used for filtering and organization."""
    ANALYTICS = "analytics"
    CAMPAIGN_MGMT = "campaign_mgmt"
    DIAGNOSTICS = "diagnostics"
    RECOMMENDATIONS = "recommendations"


class BlockDisplay(str, Enum):
    """Where the frontend renders this block."""
    INLINE = "inline"
    SIDEBAR = "sidebar"
    MODAL = "modal"
    FULLSCREEN = "fullscreen"


class StepStatus(str, Enum):
    """Workflow step/workflow statuses — used in ACTIVITY_SNAPSHOT/DELTA."""
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"
    ERROR = "error"
    REVIEW = "review"
    CANCELLED = "cancelled"
    COMPLETED = "completed"  # workflow-level terminal


# ── UI Block ─────────────────────────────────────────────────────────

class UIBlock(BaseModel):
    """A rich UI block sent to the frontend.

    DO NOT construct directly — use BlockSpec.create() which validates
    data against the typed Pydantic model for the block type.
    """
    type: str
    data: dict[str, Any]
    display: BlockDisplay = BlockDisplay.INLINE
    inline_trigger: dict[str, Any] | None = None


# ── Tool Response ────────────────────────────────────────────────────

class ToolResponse(BaseModel):
    """Standard return type for ALL tools. Tools return this — never SSE events."""
    summary: str | None = None
    data: Any = None
    ui_blocks: list[UIBlock] = []
    metadata: dict[str, Any] = {}
    hitl: Any = None  # Must be HITLRequest — enforced at gate time

    def for_llm(self) -> str:
        """What goes into the ToolMessage. Never includes ui_blocks."""
        if self.summary and self.data:
            data_str = json.dumps(self.data) if not isinstance(self.data, str) else self.data
            return f"{self.summary}\n\nData: {data_str}"
        if self.summary:
            return self.summary
        if self.data:
            return json.dumps(self.data) if not isinstance(self.data, str) else self.data
        return "Done."


# ── Writer Event Types ───────────────────────────────────────────────
# Used by StreamingToolNode (emit) and orchestrator (filter/map).

class WriterEvent(str, Enum):
    """Event types emitted by StreamingToolNode via StreamWriter."""
    THINKING = "THINKING"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"
    CUSTOM = "CUSTOM"
    ACTIVITY_SNAPSHOT = "ACTIVITY_SNAPSHOT"
    ACTIVITY_DELTA = "ACTIVITY_DELTA"

# Set of ephemeral events that are suppressed on HITL resume.
REPLAY_SUPPRESSED_EVENTS = frozenset((WriterEvent.THINKING, WriterEvent.STEP_STARTED, WriterEvent.STEP_FINISHED))


# ── Default Thinking Messages ────────────────────────────────────────

DEFAULT_THINKING_MESSAGES = [
    "Working on it...",
    "Let me look into that...",
    "Processing your request...",
]


# ── AgenticTool ──────────────────────────────────────────────────────

@dataclass
class AgenticTool:
    """Self-contained tool definition.

    The LLM-visible tool name comes from the @tool decorator. Set it
    explicitly via @tool("name") to avoid coupling to the Python function name.

    Example:
        @tool("query_analytics")
        async def _query_analytics(question: str) -> dict:
            ...
            return ToolResponse(summary="...", data=rows).model_dump()

        query_analytics = AgenticTool(
            func=_query_analytics,
            thinking_messages=["Querying data..."],
            tags=[ToolTag.ANALYTICS],
            timeout=60,
        )
    """
    func: BaseTool
    thinking_messages: list[str] = field(default_factory=lambda: list(DEFAULT_THINKING_MESSAGES))
    tags: list[ToolTag] = field(default_factory=list)
    timeout: int = 30
    hitl_policy: str = "never"  # HITLPolicy value — pre-execution confirmation

    def __post_init__(self):
        from src.agentic_platform.core.engine.hitl import HITLPolicy
        if not isinstance(self.func, BaseTool):
            raise TypeError(
                f"AgenticTool.func must be a LangChain BaseTool (use @tool decorator). "
                f"Got {type(self.func).__name__}. "
                f"Did you forget the @tool decorator on your function?"
            )
        if not self.thinking_messages:
            raise ValueError("AgenticTool.thinking_messages must not be empty")
        if self.timeout <= 0:
            raise ValueError("AgenticTool.timeout must be > 0")
        if not self.func.description:
            raise ValueError(
                f"Tool '{self.func.name}' has no description. "
                f"Add a docstring to your @tool function — the LLM uses it to decide when to call the tool."
            )
        valid_policies = {p.value for p in HITLPolicy}
        if self.hitl_policy not in valid_policies:
            raise ValueError(
                f"AgenticTool.hitl_policy must be one of {valid_policies}, "
                f"got '{self.hitl_policy}'"
            )

        # Guardrail: underscore-prefixed names are a Python convention for
        # "private". LLMs see this name and will struggle to call it correctly.
        # Fix: use @tool("clean_name") to set the LLM-visible name explicitly.
        if self.name.startswith("_"):
            raise ValueError(
                f"Tool name '{self.name}' starts with underscore. "
                f"LLMs see this name and may fail to call it. "
                f"Use @tool(\"clean_name\") to set the LLM-visible name. "
                f"Example: @tool(\"my_tool\") above your function definition."
            )

    @property
    def name(self) -> str:
        return self.func.name

    def get_thinking_message(self) -> str:
        return random.choice(self.thinking_messages)


# ── Node Response (Workflow Steps) ──────────────────────────────────

class NodeResponse(BaseModel):
    """Return type for workflow steps. Steps return this — SDK handles streaming."""
    summary: str | None = None
    data: Any = None
    ui_blocks: list[UIBlock] = []
    metadata: dict[str, Any] = {}
    hitl: Any = None  # Must be HITLRequest — enforced at gate time
