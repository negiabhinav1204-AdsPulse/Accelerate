"""Workflow runtime helpers — step execution, emission, and snapshot building.

Internal module. Not part of the public API.
"""

import asyncio
import logging
import random
import time
from typing import Any, TYPE_CHECKING

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt

from src.agentic_platform.core.stream_emitter import StreamEmitter
from src.agentic_platform.core.engine.models import (
    BlockDisplay, NodeResponse, StepStatus, DEFAULT_THINKING_MESSAGES,
)
from src.agentic_platform.core.engine.hitl import HITLRequest, is_rejection

from src.agentic_platform.core.engine.workflow import WorkflowState

if TYPE_CHECKING:
    from src.agentic_platform.core.engine.workflow import (
        Step, StepElement, Parallel, SubStep, StepProgress,
        WorkflowContext, AgenticWorkflow,
        _NullProgress, _ArtifactEmitter, _NULL_PROGRESS,
    )

logger = logging.getLogger(__name__)


# ── Step Execution ───────────────────────────────────────────────────

async def run_step(step: "Step", ctx: "WorkflowContext") -> tuple[NodeResponse | None, str | None]:
    """Execute a step function with timeout. Returns (response, error)."""
    try:
        response = await asyncio.wait_for(step.func(ctx), timeout=step.timeout)
        if not isinstance(response, NodeResponse):
            response = NodeResponse(data=response)
        return response, None
    except asyncio.TimeoutError:
        logger.warning("Workflow step %s timed out after %ds", step.name, step.timeout)
        return None, f"Step '{step.label}' timed out after {step.timeout}s"
    except Exception as e:
        logger.exception("Workflow step %s failed", step.name)
        return None, f"Step '{step.label}' failed: {e}"


def build_ctx(
    state: "WorkflowState", step: "Step", emitter: StreamEmitter,
    msg_id: str, path_prefix: str, config: RunnableConfig | None = None,
) -> "WorkflowContext":
    """Construct WorkflowContext for a step function."""
    from src.agentic_platform.core.engine.workflow import (
        WorkflowContext, StepProgress, _ArtifactEmitter, _NULL_PROGRESS,
    )

    raw_results = state.get("step_results", {})
    results = {}
    for name, data in raw_results.items():
        if isinstance(data, dict) and not data.get("_cancelled") and not data.get("_error"):
            metadata = dict(data.get("metadata", {}))
            if "user_input" in data:
                metadata["user_input"] = data["user_input"]
            results[name] = NodeResponse(
                summary=data.get("summary"),
                data=data.get("data"),
                metadata=metadata,
            )

    if step.substeps:
        progress = StepProgress(emitter, msg_id, path_prefix, [s.name for s in step.substeps])
    else:
        progress = _NULL_PROGRESS

    cfg = config or state.get("__config__", {})
    configurable = cfg.get("configurable", {}) if isinstance(cfg, dict) else {}
    metadata = cfg.get("metadata", {}) if isinstance(cfg, dict) else {}

    artifact_emitter = _ArtifactEmitter(emitter, msg_id, path_prefix)

    return WorkflowContext(
        args=state.get("workflow_args", {}),
        results=results,
        progress=progress,
        step_name=step.name,
        _artifact_emitter=artifact_emitter,
        user_id=metadata.get("user_id") or configurable.get("user_id", "anonymous"),
        org_id=metadata.get("org_id") or configurable.get("org_id", "default"),
        connected_platforms=metadata.get("connected_platforms", []),
    )


# ── Emission Helpers ─────────────────────────────────────────────────

def emit_thinking(emitter: StreamEmitter, step: "Step") -> None:
    if step.thinking_messages:
        emitter.thinking(random.choice(step.thinking_messages), message_id=f"thinking-{step.name}")


def emit_delta(emitter: StreamEmitter, msg_id: str, path: str, value: str | int | None) -> None:
    emitter.activity_delta(
        msg_id, "workflow_progress",
        [{"op": "replace", "path": path, "value": value}],
    )


def emit_step_started(emitter: StreamEmitter, msg_id: str, path_prefix: str) -> int:
    """Emit ACTIVITY_DELTA marking a step as active. Returns the timestamp used."""
    now = epoch_ms()
    emitter.activity_delta(
        msg_id, "workflow_progress",
        [
            {"op": "replace", "path": f"{path_prefix}/status", "value": StepStatus.ACTIVE},
            {"op": "replace", "path": f"{path_prefix}/started_at", "value": now},
        ],
    )
    return now


def emit_step_done(
    emitter: StreamEmitter, msg_id: str, path_prefix: str,
    response: NodeResponse,
) -> None:
    """Emit ACTIVITY_DELTA marking a step as done with completed_at timestamp."""
    now = epoch_ms()
    patch = [
        {"op": "replace", "path": f"{path_prefix}/status", "value": StepStatus.DONE},
        {"op": "replace", "path": f"{path_prefix}/completed_at", "value": now},
    ]
    if response.summary:
        patch.append({"op": "replace", "path": f"{path_prefix}/summary", "value": response.summary})
    emitter.activity_delta(msg_id, "workflow_progress", patch)


def emit_step_status(
    emitter: StreamEmitter, msg_id: str, path_prefix: str,
    status: str, response: NodeResponse,
) -> None:
    """Emit ACTIVITY_DELTA with step status and optional summary."""
    patch = [{"op": "replace", "path": f"{path_prefix}/status", "value": status}]
    if response.summary:
        patch.append({"op": "replace", "path": f"{path_prefix}/summary", "value": response.summary})
    emitter.activity_delta(msg_id, "workflow_progress", patch)


def emit_ui_blocks(emitter: StreamEmitter, response: NodeResponse, step_name: str = "") -> None:
    if response.ui_blocks and not response.summary:
        logger.warning(
            "Step '%s' emits ui_blocks but no summary — progress card will show "
            "'Done' with no context. Set NodeResponse.summary for a meaningful one-liner.",
            step_name or "unknown",
        )
    for block in response.ui_blocks:
        # Fullscreen and sidebar blocks are deferred to finalize so they
        # appear AFTER the workflow card in the message stream.
        if block.display in (BlockDisplay.FULLSCREEN, BlockDisplay.SIDEBAR):
            continue
        emitter.block(
            block.type, block.data,
            display=block.display.value,
            inline_trigger=block.inline_trigger,
            workflow_step=step_name or None,
        )


# ── Result & HITL ───────────────────────────────────────────────────

def result_dict(response: NodeResponse, started_at: int | None = None, completed_at: int | None = None) -> dict:
    result: dict = {
        "summary": response.summary, "data": response.data, "metadata": response.metadata,
        "started_at": started_at, "completed_at": completed_at,
    }
    deferred = [b for b in response.ui_blocks if b.display in (BlockDisplay.FULLSCREEN, BlockDisplay.SIDEBAR)]
    if deferred:
        result["_deferred_blocks"] = [
            {"type": b.type, "data": b.data, "display": b.display.value, "inline_trigger": b.inline_trigger}
            for b in deferred
        ]
    return result


def handle_hitl(response: NodeResponse, step_data: dict, step_name: str = "") -> dict:
    """Handle HITL gate. Returns the user's decision dict."""
    hitl = response.hitl
    if not isinstance(hitl, HITLRequest):
        raise TypeError(
            f"NodeResponse.hitl must be an HITLRequest instance, got {type(hitl).__name__}. "
            f"Use build_confirmation() or HITLRequest(...) from tools.hitl."
        )
    interrupt_value = hitl.model_dump(mode="json") | {"status": StepStatus.PENDING}
    if step_name:
        interrupt_value["workflow_step"] = step_name
    decision = interrupt(interrupt_value)
    if is_rejection(decision.get("action", "")):
        step_data["_cancelled"] = True
    elif decision.get("modifications"):
        step_data["user_input"] = decision["modifications"]
    return decision


# ── Snapshot Builders ────────────────────────────────────────────────

def epoch_ms() -> int:
    """Current time as epoch milliseconds."""
    return int(time.time() * 1000)


def format_title(template: str, args: dict) -> str:
    try:
        return template.format(**args)
    except (KeyError, IndexError, ValueError) as e:
        logger.warning("Failed to format workflow title %r with args %r: %s", template, args, e)
        return template


def find_tool_call_id(state: "WorkflowState", trigger_name: str) -> str:
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                if tc["name"] == trigger_name:
                    return tc["id"]
    return "unknown"


def element_step_names(element: "StepElement") -> list[str]:
    """Get all step names from an element (for router checking)."""
    from src.agentic_platform.core.engine.workflow import Step
    if isinstance(element, Step):
        return [element.name]
    return [s.name for s in element.steps]


def build_snapshot(steps: list["StepElement"], title: str, started_at: int | None = None) -> dict:
    return {
        "title": title,
        "status": StepStatus.ACTIVE,
        "started_at": started_at,
        "completed_at": None,
        "steps": [snapshot_element(el) for el in steps],
    }


def snapshot_element(element: "StepElement") -> dict:
    """Build snapshot entry for a Step or Parallel."""
    from src.agentic_platform.core.engine.workflow import Step
    if isinstance(element, Step):
        entry: dict = {
            "name": element.name, "label": element.label,
            "status": StepStatus.PENDING, "summary": "",
            "started_at": None, "completed_at": None,
            "artifacts": [],
        }
        if element.hidden:
            entry["hidden"] = True
        if element.substeps:
            entry["substeps"] = [
                {"name": s.name, "label": s.label, "status": StepStatus.PENDING, "summary": "",
                 "started_at": None, "completed_at": None}
                for s in element.substeps
            ]
        return entry
    return {
        "name": element.name, "label": element.label,
        "status": StepStatus.PENDING, "summary": "",
        "started_at": None, "completed_at": None,
        "artifacts": [],
        "children": [snapshot_element(s) for s in element.steps],
    }


def apply_results_to_snapshot(
    snapshot: dict, results: dict[str, Any], steps: list["StepElement"],
) -> None:
    """Update a snapshot dict with completed step results, timestamps, and substeps."""
    from src.agentic_platform.core.engine.workflow import Step
    for idx, element in enumerate(steps):
        if isinstance(element, Step):
            data = results.get(element.name)
            if isinstance(data, dict) and "summary" in data:
                snap_step = snapshot["steps"][idx]
                snap_step["status"] = StepStatus.DONE
                snap_step["summary"] = data.get("summary") or ""
                snap_step["started_at"] = data.get("started_at")
                snap_step["completed_at"] = data.get("completed_at")
                if data.get("_artifacts"):
                    snap_step["artifacts"] = data["_artifacts"]
                if element.substeps and "substeps" in snap_step:
                    substep_summaries = data.get("_substep_summaries", {})
                    for sub_idx, sub_def in enumerate(element.substeps):
                        sub = snap_step["substeps"][sub_idx]
                        sub["status"] = StepStatus.DONE
                        if not sub.get("completed_at"):
                            sub["completed_at"] = data.get("completed_at")
                        if sub_def.name in substep_summaries:
                            sub["summary"] = substep_summaries[sub_def.name]
        else:
            all_done = True
            group_started = None
            group_completed = None
            for child_idx, child in enumerate(element.steps):
                data = results.get(child.name)
                if isinstance(data, dict) and "summary" in data:
                    snap_child = snapshot["steps"][idx]["children"][child_idx]
                    snap_child["status"] = StepStatus.DONE
                    snap_child["summary"] = data.get("summary") or ""
                    snap_child["started_at"] = data.get("started_at")
                    snap_child["completed_at"] = data.get("completed_at")
                    if data.get("_artifacts"):
                        snap_child["artifacts"] = data["_artifacts"]
                    if data.get("started_at"):
                        group_started = min(group_started or data["started_at"], data["started_at"])
                    if data.get("completed_at"):
                        group_completed = max(group_completed or 0, data["completed_at"])
                else:
                    all_done = False
            if all_done and element.steps:
                snapshot["steps"][idx]["status"] = StepStatus.DONE
                snapshot["steps"][idx]["started_at"] = group_started
                snapshot["steps"][idx]["completed_at"] = group_completed


def emit_progress_block(
    emitter: StreamEmitter, workflow: "AgenticWorkflow",
    state: "WorkflowState", snap_idx: int, new_results: dict,
) -> None:
    """Emit a CUSTOM workflow_progress block for DB persistence."""
    args = state.get("workflow_args", {})
    all_results = dict(state.get("step_results", {}))
    all_results.update(new_results)

    title = format_title(workflow.title, args)
    started_at = state.get("workflow_started_at")
    progress = build_snapshot(workflow.steps, title, started_at=started_at)
    apply_results_to_snapshot(progress, all_results, workflow.steps)

    emitter.block("workflow_progress", progress)
