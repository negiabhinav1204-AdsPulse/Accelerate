"""Workflow graph construction — LangGraph node factories.

Internal module. Not part of the public API.
"""

import asyncio
import logging
from typing import TYPE_CHECKING

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from src.agentic_platform.core.stream_emitter import StreamEmitter
from src.agentic_platform.core.engine.models import StepStatus
from src.agentic_platform.core.engine.workflow import WorkflowState
from src.agentic_platform.core.engine._workflow_runtime import (
    run_step, build_ctx,
    emit_thinking, emit_delta, emit_step_started, emit_step_done,
    emit_step_status, emit_ui_blocks, result_dict, handle_hitl,
    emit_progress_block, epoch_ms, format_title, find_tool_call_id,
    element_step_names, build_snapshot, apply_results_to_snapshot,
)

if TYPE_CHECKING:
    from src.agentic_platform.core.engine.workflow import (
        AgenticWorkflow, Step, Parallel,
    )

logger = logging.getLogger(__name__)


# ── Wave Router ──────────────────────────────────────────────────────

def make_wave_router(step_names: list[str]):
    """After each wave: check error → check HITL cancel → proceed."""
    def router(state: WorkflowState) -> str:
        if state.get("error"):
            return "error"
        for name in step_names:
            result = state.get("step_results", {}).get(name, {})
            if isinstance(result, dict) and result.get("_cancelled"):
                return "cancel"
        return "next"
    return router


# ── Parse Trigger Node ───────────────────────────────────────────────

def make_parse_trigger_node(workflow: "AgenticWorkflow"):
    async def _parse_trigger(state: "WorkflowState", writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        for msg in reversed(state["messages"]):
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == workflow.name:
                        args = tc["args"]
                        title = format_title(workflow.title, args)
                        now = epoch_ms()
                        snapshot = build_snapshot(workflow.steps, title, started_at=now)
                        emitter.activity_snapshot(
                            f"wf-{workflow.name}",
                            "workflow_progress",
                            snapshot,
                        )
                        return {
                            "workflow_args": args,
                            "step_results": {},
                            "current_step": 0,
                            "error": "",
                            "workflow_started_at": now,
                        }
        return {"error": f"No tool call found for trigger '{workflow.name}'"}
    return _parse_trigger


# ── Resume Snapshot ──────────────────────────────────────────────────

def maybe_emit_resume_snapshot(
    state: "WorkflowState", emitter: StreamEmitter, workflow: "AgenticWorkflow",
) -> None:
    """Re-emit ACTIVITY_SNAPSHOT for step 2+ and resume scenarios."""
    if not state.get("step_results"):
        return
    args = state.get("workflow_args", {})
    title = format_title(workflow.title, args)
    started_at = state.get("workflow_started_at")
    snapshot = build_snapshot(workflow.steps, title, started_at=started_at)
    apply_results_to_snapshot(snapshot, state.get("step_results", {}), workflow.steps)
    emitter.activity_snapshot(
        f"wf-{workflow.name}",
        "workflow_progress",
        snapshot,
    )


# ── Step Wave (single Step) ─────────────────────────────────────────

def make_step_wave(step: "Step", snap_idx: int, workflow: "AgenticWorkflow"):
    """Wrap a single Step with streaming, timeout, error handling, and HITL."""
    path_prefix = f"/steps/{snap_idx}"
    visible = not step.hidden

    async def _wave_node(state: "WorkflowState", config: RunnableConfig, writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        msg_id = f"wf-{workflow.name}"

        maybe_emit_resume_snapshot(state, emitter, workflow)
        ctx = build_ctx(state, step, emitter, msg_id, path_prefix, config=config)

        if visible:
            emit_thinking(emitter, step)
            step_started = emit_step_started(emitter, msg_id, path_prefix)
        else:
            step_started = epoch_ms()

        response, error = await run_step(step, ctx)
        if error:
            return {"error": error, "current_step": snap_idx}

        if visible:
            emit_ui_blocks(emitter, response, step_name=step.name)

        step_completed = epoch_ms()
        step_data = result_dict(response, started_at=step_started, completed_at=step_completed)
        if ctx._artifact_emitter and ctx._artifact_emitter.artifacts:
            step_data["_artifacts"] = ctx._artifact_emitter.artifacts
        if hasattr(ctx.progress, 'substep_summaries') and ctx.progress.substep_summaries:
            step_data["_substep_summaries"] = ctx.progress.substep_summaries

        # HITL gate
        if response.hitl:
            if visible:
                emit_step_status(emitter, msg_id, path_prefix, StepStatus.REVIEW, response)
            decision = handle_hitl(response, step_data, step_name="" if step.hidden else step.name)

            if step_data.get("_cancelled"):
                if visible:
                    emit_delta(emitter, msg_id, f"{path_prefix}/status", StepStatus.CANCELLED)
                return {"step_results": {step.name: step_data}, "current_step": snap_idx}

            if visible:
                emit_step_done(emitter, msg_id, path_prefix, response)
        else:
            if visible:
                emit_step_done(emitter, msg_id, path_prefix, response)

        emit_progress_block(emitter, workflow, state, snap_idx, {step.name: step_data})
        return {"step_results": {step.name: step_data}, "current_step": snap_idx + 1}

    return _wave_node


# ── Parallel Wave ────────────────────────────────────────────────────

def make_parallel_wave(parallel: "Parallel", snap_idx: int, workflow: "AgenticWorkflow"):
    """Run all children concurrently via asyncio.gather."""

    async def _wave_node(state: "WorkflowState", config: RunnableConfig, writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        msg_id = f"wf-{workflow.name}"
        group_path = f"/steps/{snap_idx}"

        maybe_emit_resume_snapshot(state, emitter, workflow)
        emit_step_started(emitter, msg_id, group_path)

        async def _run_child(child: "Step", child_idx: int) -> tuple[str, dict]:
            child_path = f"{group_path}/children/{child_idx}"
            ctx = build_ctx(state, child, emitter, msg_id, child_path, config=config)

            emit_thinking(emitter, child)
            child_started = emit_step_started(emitter, msg_id, child_path)

            response, error = await run_step(child, ctx)
            if error:
                return child.name, {"_error": error}

            if response.hitl:
                logger.warning(
                    "Step '%s' in Parallel '%s' returned HITL — ignored. "
                    "HITL is not supported inside Parallel groups.",
                    child.name, parallel.name,
                )
                response.hitl = None

            child_completed = epoch_ms()
            emit_step_done(emitter, msg_id, child_path, response)
            emit_ui_blocks(emitter, response, step_name=child.name)
            child_data = result_dict(response, started_at=child_started, completed_at=child_completed)
            if ctx._artifact_emitter and ctx._artifact_emitter.artifacts:
                child_data["_artifacts"] = ctx._artifact_emitter.artifacts
            return child.name, child_data

        child_results = await asyncio.gather(
            *[_run_child(child, i) for i, child in enumerate(parallel.steps)],
            return_exceptions=True,
        )

        step_results = {}
        first_error = None
        for i, result in enumerate(child_results):
            if isinstance(result, Exception):
                error_msg = f"Step '{parallel.steps[i].label}' failed: {result}"
                first_error = first_error or error_msg
                step_results[parallel.steps[i].name] = {"_error": error_msg}
                continue
            name, data = result
            if data.get("_error") and not first_error:
                first_error = data["_error"]
            step_results[name] = data

        if first_error:
            return {"step_results": step_results, "error": first_error, "current_step": snap_idx}

        now = epoch_ms()
        emitter.activity_delta(
            msg_id, "workflow_progress",
            [
                {"op": "replace", "path": f"{group_path}/status", "value": StepStatus.DONE},
                {"op": "replace", "path": f"{group_path}/completed_at", "value": now},
            ],
        )

        emit_progress_block(emitter, workflow, state, snap_idx, step_results)
        return {"step_results": step_results, "current_step": snap_idx + 1}

    return _wave_node


# ── Terminal Nodes ───────────────────────────────────────────────────

def make_finalize_node(workflow: "AgenticWorkflow"):
    async def _finalize(state: "WorkflowState", writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        results = state.get("step_results", {})
        args = state.get("workflow_args", {})

        if workflow.finalize:
            content = await workflow.finalize(state, results)
        else:
            from src.agentic_platform.core.engine.workflow import Step
            title = format_title(workflow.title, args)
            last_step = workflow.steps[-1]
            last_name = last_step.name if isinstance(last_step, Step) else last_step.steps[-1].name
            last_data = results.get(last_name, {})
            last_summary = (last_data.get("summary") or "Done") if isinstance(last_data, dict) else "Done"
            content = f"Workflow completed: {title}. Final step: {last_summary}. The user can see the full progress card — do NOT restate the steps."

        tool_call_id = find_tool_call_id(state, workflow.name)
        msg_id = f"wf-{workflow.name}"

        now = epoch_ms()
        emitter.activity_delta(
            msg_id, "workflow_progress",
            [
                {"op": "replace", "path": "/status", "value": StepStatus.COMPLETED},
                {"op": "replace", "path": "/completed_at", "value": now},
            ],
        )

        title = format_title(workflow.title, args)
        started_at = state.get("workflow_started_at")
        final = build_snapshot(workflow.steps, title, started_at=started_at)
        final["status"] = StepStatus.COMPLETED
        final["completed_at"] = now
        apply_results_to_snapshot(final, results, workflow.steps)
        emitter.block("workflow_progress", final)

        # Emit deferred blocks (sidebar/fullscreen triggers) AFTER workflow completion
        for step_data in results.values():
            if isinstance(step_data, dict):
                for block in step_data.get("_deferred_blocks", []):
                    emitter.block(
                        block["type"], block["data"],
                        display=block.get("display"),
                        inline_trigger=block.get("inline_trigger"),
                    )

        return {"messages": [ToolMessage(content=content, name=workflow.name, tool_call_id=tool_call_id)]}

    return _finalize


def make_error_exit_node(workflow: "AgenticWorkflow"):
    async def _error_exit(state: "WorkflowState", writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        error = state.get("error", "Unknown error")
        tool_call_id = find_tool_call_id(state, workflow.name)
        args = state.get("workflow_args", {})
        results = state.get("step_results", {})
        snap_idx = state.get("current_step", 0)
        msg_id = f"wf-{workflow.name}"

        patch = [{"op": "replace", "path": "/status", "value": StepStatus.ERROR}]
        if snap_idx < len(workflow.steps):
            patch.append({"op": "replace", "path": f"/steps/{snap_idx}/status", "value": StepStatus.ERROR})
            patch.append({"op": "replace", "path": f"/steps/{snap_idx}/summary", "value": error})
        emitter.activity_delta(msg_id, "workflow_progress", patch)

        title = format_title(workflow.title, args)
        started_at = state.get("workflow_started_at")
        err_snap = build_snapshot(workflow.steps, title, started_at=started_at)
        err_snap["status"] = StepStatus.ERROR
        apply_results_to_snapshot(err_snap, results, workflow.steps)
        if snap_idx < len(workflow.steps):
            err_snap["steps"][snap_idx]["status"] = StepStatus.ERROR
            err_snap["steps"][snap_idx]["summary"] = error
        emitter.block("workflow_progress", err_snap)

        return {"messages": [ToolMessage(content=f"Workflow error: {error}", name=workflow.name,
                                         tool_call_id=tool_call_id)]}

    return _error_exit


def make_cancel_node(workflow: "AgenticWorkflow"):
    async def _cancel(state: "WorkflowState", writer: StreamWriter) -> dict:
        emitter = StreamEmitter(writer)
        tool_call_id = find_tool_call_id(state, workflow.name)
        args = state.get("workflow_args", {})
        results = state.get("step_results", {})
        msg_id = f"wf-{workflow.name}"

        emit_delta(emitter, msg_id, "/status", StepStatus.CANCELLED)

        title = format_title(workflow.title, args)
        started_at = state.get("workflow_started_at")
        cancel_snap = build_snapshot(workflow.steps, title, started_at=started_at)
        cancel_snap["status"] = StepStatus.CANCELLED
        apply_results_to_snapshot(cancel_snap, results, workflow.steps)
        emitter.block("workflow_progress", cancel_snap)

        return {"messages": [ToolMessage(content="Workflow cancelled by user.", name=workflow.name,
                                         tool_call_id=tool_call_id)]}

    return _cancel
