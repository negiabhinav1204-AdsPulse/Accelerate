"""Workflow SDK — deterministic multi-step pipelines as LangGraph sub-graphs.

Three primitives:
  Step(name, func, label)        — executes code, gets checkpointed
  Parallel(name, label, steps)   — runs children concurrently via asyncio.gather
  SubStep(name, label)           — progress-only child (for internal parallelism)

Developers write step functions: async def step(ctx) -> NodeResponse
The SDK handles streaming, progress, HITL, error/timeout, and persistence.

Usage:
    @tool
    async def _create_campaign(goal: str, budget: float) -> dict:
        \"\"\"Create a campaign with AI-generated media plan.\"\"\"
        raise NotImplementedError("Routed to workflow sub-graph")

    async def research(ctx: WorkflowContext) -> NodeResponse:
        data = await scraper.scrape(ctx.args["url"])
        return NodeResponse(summary=f"Found {len(data)} products", data=data)

    async def analyze(ctx: WorkflowContext) -> NodeResponse:
        async def run_agent(name, schema, prompt):
            ctx.progress.start(name)
            result = await llm.with_structured_output(schema).ainvoke(prompt)
            ctx.progress.done(name, summary="Complete")
            return result

        biz, brand = await asyncio.gather(
            run_agent("business", BusinessContext, biz_prompt),
            run_agent("brand", BrandResult, brand_prompt),
        )
        return NodeResponse(summary="Analysis complete", data={...})

    create_campaign = AgenticWorkflow(
        trigger=_create_campaign,
        title="Creating campaign for {url}",
        steps=[
            Step("scrape", research, label="Research website"),
            Step("analyze", analyze, label="Analyze market", substeps=[
                SubStep("business", "Business context"),
                SubStep("brand", "Brand analysis"),
            ]),
            Step("plan", plan_media, label="Generate media plan"),
            Parallel("create", label="Create campaigns", steps=[
                Step("register", register_plan, label="Register plan"),
                Step("generate", generate_assets, label="Generate assets"),
            ]),
            Step("save", save_fn, label="Save campaigns"),
        ],
    )
"""

import logging
from dataclasses import dataclass, field
from typing import Annotated, Any, Callable, Awaitable, Protocol, Union

from langchain_core.messages import BaseMessage
from langchain_core.tools import BaseTool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

from typing_extensions import TypedDict

from src.agentic_platform.core.stream_emitter import StreamEmitter
from src.agentic_platform.core.engine.models import (
    NodeResponse, StepStatus, DEFAULT_THINKING_MESSAGES,
)

logger = logging.getLogger(__name__)


# ── Workflow State ──────────────────────────────────────────────────

def _merge_results(existing: dict, new: dict) -> dict:
    """Reducer: merge step_results dicts."""
    merged = dict(existing)
    merged.update(new)
    return merged


class WorkflowState(TypedDict):
    """Sub-graph state. `messages` maps to parent via shared key."""
    messages: Annotated[list[BaseMessage], add_messages]
    workflow_args: dict[str, Any]
    step_results: Annotated[dict[str, Any], _merge_results]
    current_step: int
    error: str
    workflow_started_at: int  # epoch ms — set once in _parse_trigger


# ── Primitives ──────────────────────────────────────────────────────

@dataclass
class SubStep:
    """Progress-only child of a Step. No graph node — just UI."""
    name: str
    label: str = ""

    def __post_init__(self):
        if not self.name:
            raise ValueError("SubStep.name must be set")
        if not self.label:
            self.label = self.name.replace("_", " ").title()


@dataclass
class Step:
    """Leaf execution unit — has a func, gets checkpointed."""
    name: str
    func: Callable[..., Awaitable[NodeResponse]]
    label: str = ""
    substeps: list[SubStep] = field(default_factory=list)
    thinking_messages: list[str] = field(default_factory=lambda: list(DEFAULT_THINKING_MESSAGES))
    timeout: int = 60
    hidden: bool = False

    def __post_init__(self):
        if not self.name:
            raise ValueError("Step.name must be set")
        if not self.name.replace("_", "").isalnum():
            raise ValueError(f"Step.name must be alphanumeric (got '{self.name}')")
        if not callable(self.func):
            raise ValueError(f"Step.func must be callable (got {type(self.func).__name__})")
        if not self.label:
            self.label = self.name.replace("_", " ").title()
        if self.timeout <= 0:
            raise ValueError("Step.timeout must be > 0")
        # Validate substep names are unique
        sub_names = [s.name for s in self.substeps]
        if len(sub_names) != len(set(sub_names)):
            raise ValueError(f"Duplicate substep names in step '{self.name}': {sub_names}")


@dataclass
class Parallel:
    """Runs children concurrently. Compiles to a single LangGraph node with asyncio.gather."""
    name: str
    steps: list[Step]
    label: str = ""

    def __post_init__(self):
        if not self.name:
            raise ValueError("Parallel.name must be set")
        if not self.steps:
            raise ValueError("Parallel.steps must not be empty")
        if len(self.steps) < 2:
            raise ValueError("Parallel requires at least 2 steps (use Step for single steps)")
        if not self.label:
            self.label = self.name.replace("_", " ").title()
        # Validate child step names are unique
        names = [s.name for s in self.steps]
        if len(names) != len(set(names)):
            raise ValueError(f"Duplicate step names in Parallel '{self.name}': {names}")


StepElement = Union[Step, Parallel]


# ── Step Progress ───────────────────────────────────────────────────

class StepProgress:
    """Emit ACTIVITY_DELTA for substeps. Thread-safe for asyncio.gather.

    Step functions use this to report internal parallel progress:
        ctx.progress.start("business")
        result = await llm.ainvoke(...)
        ctx.progress.done("business", summary="Complete")
    """

    def __init__(self, emitter: StreamEmitter, msg_id: str, path_prefix: str, substep_names: list[str]):
        self._emitter = emitter
        self._msg_id = msg_id
        self._path_prefix = path_prefix
        self._substeps = {name: idx for idx, name in enumerate(substep_names)}
        self._summaries: dict[str, str] = {}

    def _validate(self, name: str) -> int:
        idx = self._substeps.get(name)
        if idx is None:
            raise ValueError(
                f"Unknown substep '{name}'. Declared substeps: {list(self._substeps)}. "
                f"Did you forget to add SubStep('{name}', ...) to your Step?"
            )
        return idx

    def start(self, name: str) -> None:
        """Mark a substep as active with started_at timestamp."""
        from src.agentic_platform.core.engine._workflow_runtime import epoch_ms
        idx = self._validate(name)
        now = epoch_ms()
        self._emitter.activity_delta(
            self._msg_id, "workflow_progress",
            [
                {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/status", "value": StepStatus.ACTIVE},
                {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/started_at", "value": now},
            ],
        )

    def done(self, name: str, summary: str = "") -> None:
        """Mark a substep as done with completed_at timestamp and optional summary."""
        from src.agentic_platform.core.engine._workflow_runtime import epoch_ms
        idx = self._validate(name)
        now = epoch_ms()
        patch = [
            {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/status", "value": StepStatus.DONE},
            {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/completed_at", "value": now},
        ]
        if summary:
            patch.append(
                {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/summary", "value": summary},
            )
            self._summaries[name] = summary
        self._emitter.activity_delta(self._msg_id, "workflow_progress", patch)

    @property
    def substep_summaries(self) -> dict[str, str]:
        """Substep summaries set by done() — used by snapshot builder for persistence."""
        return dict(self._summaries)

    def update(self, name: str, message: str) -> None:
        """Update a substep's summary without changing its status."""
        idx = self._validate(name)
        self._emitter.activity_delta(
            self._msg_id, "workflow_progress",
            [{"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/summary", "value": message}],
        )

    def error(self, name: str, message: str = "") -> None:
        """Mark a substep as errored with completed_at timestamp."""
        from src.agentic_platform.core.engine._workflow_runtime import epoch_ms
        idx = self._validate(name)
        now = epoch_ms()
        patch = [
            {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/status", "value": StepStatus.ERROR},
            {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/completed_at", "value": now},
        ]
        if message:
            patch.append(
                {"op": "replace", "path": f"{self._path_prefix}/substeps/{idx}/summary", "value": message},
            )
        self._emitter.activity_delta(self._msg_id, "workflow_progress", patch)


class _NullProgress:
    """Null-object progress for steps without substeps.
    Calling start/done/error raises immediately with a clear message.
    """
    def _fail(self, name: str) -> None:
        raise ValueError(
            f"Cannot report substep progress — step has no substeps declared. "
            f"Add SubStep('{name}', ...) to your Step definition."
        )

    def start(self, name: str) -> None:
        self._fail(name)

    def done(self, name: str, summary: str = "") -> None:
        self._fail(name)

    def update(self, name: str, message: str) -> None:
        self._fail(name)

    def error(self, name: str, message: str = "") -> None:
        self._fail(name)

_NULL_PROGRESS = _NullProgress()


# ── Finalize Callback Protocol ──────────────────────────────────────

class FinalizeCallback(Protocol):
    async def __call__(self, state: WorkflowState, results: dict) -> str: ...


# ── Artifacts ───────────────────────────────────────────────────────

@dataclass
class StepArtifact:
    """A structured insight emitted by a workflow step.

    Artifacts appear in the "Insights" sidebar when the user clicks
    a completed workflow step.
    """
    type: str
    title: str
    data: dict[str, Any]


class _ArtifactEmitter:
    """Collects and streams artifacts for a single workflow step."""
    def __init__(self, emitter: StreamEmitter, msg_id: str, step_path: str):
        self._emitter = emitter
        self._msg_id = msg_id
        self._step_path = step_path
        self.artifacts: list[dict] = []

    def emit(self, artifact: StepArtifact) -> None:
        entry = {"type": artifact.type, "title": artifact.title, "data": artifact.data}
        self.artifacts.append(entry)
        self._emitter.activity_delta(
            self._msg_id, "workflow_progress",
            [{"op": "add", "path": f"{self._step_path}/artifacts/-", "value": entry}],
        )


# ── Workflow Context ────────────────────────────────────────────────

@dataclass
class WorkflowContext:
    """Context passed to each step function.

    args: trigger arguments from the @tool call
    results: completed step results {name: NodeResponse}
    progress: report substep progress
    step_name: current step name
    """
    args: dict[str, Any]
    results: dict[str, NodeResponse]
    progress: StepProgress | _NullProgress
    step_name: str = ""
    _artifact_emitter: _ArtifactEmitter | None = None
    user_id: str = "anonymous"
    org_id: str = "default"
    connected_platforms: list[Any] = field(default_factory=list)

    def emit_artifact(self, artifact: StepArtifact) -> None:
        """Emit a step-level artifact for display in the insight sidebar."""
        if self._artifact_emitter:
            self._artifact_emitter.emit(artifact)


# ── Workflow Definition ─────────────────────────────────────────────

@dataclass
class AgenticWorkflow:
    """Self-contained workflow definition. build_graph() builds the sub-graph.

    steps is a list of Step or Parallel elements:
      - Step: sequential execution, one LangGraph node
      - Parallel: concurrent execution, one LangGraph node (asyncio.gather)
    """
    trigger: BaseTool
    title: str
    steps: list[StepElement]
    tags: list[str] = field(default_factory=list)
    finalize: FinalizeCallback | None = None

    def __post_init__(self):
        if not isinstance(self.trigger, BaseTool):
            raise TypeError(
                f"AgenticWorkflow.trigger must be a LangChain BaseTool (use @tool decorator). "
                f"Got {type(self.trigger).__name__}."
            )
        if not self.steps:
            raise ValueError("AgenticWorkflow.steps must not be empty")
        if not self.trigger.description:
            raise ValueError(
                f"Workflow trigger '{self.trigger.name}' has no description. "
                f"Add a docstring to your @tool function."
            )

        all_names: list[str] = []
        for element in self.steps:
            all_names.append(element.name)
            if isinstance(element, Parallel):
                all_names.extend(s.name for s in element.steps)
        if len(all_names) != len(set(all_names)):
            raise ValueError(f"Duplicate step names: {all_names}")

    @property
    def name(self) -> str:
        return self.trigger.name

    def build_graph(self) -> StateGraph:
        """Build the sub-graph: parse → waves (chained) → finalize/error_exit/cancel."""
        from src.agentic_platform.core.engine._workflow_graph import (
            make_parse_trigger_node, make_step_wave, make_parallel_wave,
            make_finalize_node, make_error_exit_node, make_cancel_node,
            make_wave_router, element_step_names,
        )

        graph = StateGraph(WorkflowState)

        graph.add_node("_parse_trigger", make_parse_trigger_node(self))
        graph.add_node("_finalize", make_finalize_node(self))
        graph.add_node("_error_exit", make_error_exit_node(self))
        graph.add_node("_cancel", make_cancel_node(self))

        for snap_idx, element in enumerate(self.steps):
            if isinstance(element, Step):
                node_fn = make_step_wave(element, snap_idx, self)
            else:
                node_fn = make_parallel_wave(element, snap_idx, self)
            graph.add_node(element.name, node_fn)

        graph.add_edge(START, "_parse_trigger")
        graph.add_edge("_parse_trigger", self.steps[0].name)

        for idx, element in enumerate(self.steps):
            next_node = self.steps[idx + 1].name if idx + 1 < len(self.steps) else "_finalize"
            step_names = element_step_names(element)
            graph.add_conditional_edges(
                element.name,
                make_wave_router(step_names),
                {"next": next_node, "error": "_error_exit", "cancel": "_cancel"},
            )

        graph.add_edge("_finalize", END)
        graph.add_edge("_error_exit", END)
        graph.add_edge("_cancel", END)

        return graph
