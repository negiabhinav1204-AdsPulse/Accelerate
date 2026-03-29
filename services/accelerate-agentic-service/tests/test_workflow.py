"""Tests for workflow SDK — Step, Parallel, SubStep, StepProgress, AgenticWorkflow."""

import asyncio
import pytest

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from src.agentic_platform.core.stream_emitter import StreamEmitter
from src.agentic_platform.core.engine.models import NodeResponse, WriterEvent, UIBlock, StepStatus
from src.agentic_platform.core.engine.workflow import (
    AgenticWorkflow,
    Step,
    SubStep,
    Parallel,
    StepProgress,
    WorkflowContext,
    WorkflowState,
    _NullProgress,
)
from src.agentic_platform.core.engine._workflow_runtime import (
    build_snapshot as _build_snapshot,
    find_tool_call_id as _find_tool_call_id,
    snapshot_element as _snapshot_element,
)
from src.agentic_platform.core.engine._workflow_graph import (
    make_wave_router as _make_wave_router,
    make_parse_trigger_node as _make_parse_trigger_node,
    make_finalize_node as _make_finalize_node,
    make_error_exit_node as _make_error_exit_node,
    make_cancel_node as _make_cancel_node,
    make_step_wave as _make_step_wave,
    make_parallel_wave as _make_parallel_wave,
)


# ── Test helpers ────────────────────────────────────────────────────

@tool("test_trigger")
async def _test_trigger(goal: str, url: str) -> dict:
    """Create a test campaign."""
    pass


@tool("simple_trigger")
async def _simple_trigger(query: str) -> dict:
    """Simple trigger."""
    pass


async def _step_research(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(summary=f"Researched {ctx.args.get('url', '')}", data={"items": [1, 2, 3]})


async def _step_analyze(ctx: WorkflowContext) -> NodeResponse:
    research = ctx.results.get("research")
    items = research.data.get("items", []) if research else []
    return NodeResponse(summary="Analysis complete", data={"count": len(items)})


async def _step_plan(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(summary="Plan ready", data={"budget": 1000})


async def _step_register(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(summary="Plan registered", data={"plan_id": "mp-123"})


async def _step_generate(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(summary="3 campaigns generated", data={"campaigns": [1, 2, 3]})


async def _step_slow(ctx: WorkflowContext) -> NodeResponse:
    await asyncio.sleep(10)
    return NodeResponse(summary="Should not reach here")


async def _step_failing(ctx: WorkflowContext) -> NodeResponse:
    raise RuntimeError("Step exploded")


async def _step_with_substeps(ctx: WorkflowContext) -> NodeResponse:
    """Step that reports substep progress."""
    ctx.progress.start("business")
    ctx.progress.done("business", summary="3 segments")
    ctx.progress.start("brand")
    ctx.progress.done("brand", summary="Strong identity")
    return NodeResponse(summary="Analysis complete", data={})


async def _step_with_hitl(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(
        summary="Needs approval",
        data={"plan": "draft"},
        hitl={
            "type": "confirmation",
            "title": "Approve plan?",
            "description": "Review the plan.",
            "payload": {"budget": 5000},
            "actions": [
                {"action": "approve", "label": "Approve", "style": "primary"},
                {"action": "reject", "label": "Reject", "style": "default"},
            ],
        },
    )


async def _step_with_blocks(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(
        summary="Blocks emitted",
        ui_blocks=[UIBlock(type="test_block", data={"key": "value"})],
    )


def _make_workflow(**kwargs):
    defaults = dict(
        trigger=_test_trigger,
        title="Test workflow for {url}",
        steps=[
            Step("research", _step_research, label="Research website"),
            Step("analyze", _step_analyze, label="Analyze market"),
            Step("plan", _step_plan, label="Build plan"),
        ],
    )
    defaults.update(kwargs)
    return AgenticWorkflow(**defaults)


def _make_state(tool_calls=None, args=None, results=None, error="", current_step=0):
    """Helper to build a WorkflowState dict."""
    state = {
        "messages": [AIMessage(content="", tool_calls=tool_calls or [
            {"name": "test_trigger", "args": {"goal": "test", "url": "https://acme.com"}, "id": "tc1"},
        ])],
        "workflow_args": args or {"goal": "test", "url": "https://acme.com"},
        "step_results": results or {},
        "current_step": current_step,
        "error": error,
    }
    return state


def _collector():
    """Returns (emitted_list, writer_fn)."""
    emitted = []
    return emitted, lambda event: emitted.append(event)


# ── SubStep validation ──────────────────────────────────────────────

class TestSubStep:
    def test_valid(self):
        s = SubStep("business", "Business context")
        assert s.name == "business"
        assert s.label == "Business context"

    def test_default_label(self):
        s = SubStep("my_substep")
        assert s.label == "My Substep"

    def test_empty_name(self):
        with pytest.raises(ValueError, match="name must be set"):
            SubStep("")


# ── Step validation ─────────────────────────────────────────────────

class TestStep:
    def test_valid(self):
        s = Step("research", _step_research, label="Research")
        assert s.name == "research"
        assert s.label == "Research"

    def test_default_label(self):
        s = Step("my_step", _step_research)
        assert s.label == "My Step"

    def test_empty_name(self):
        with pytest.raises(ValueError, match="name must be set"):
            Step("", _step_research)

    def test_invalid_name(self):
        with pytest.raises(ValueError, match="alphanumeric"):
            Step("bad-name!", _step_research)

    def test_not_callable(self):
        with pytest.raises(ValueError, match="callable"):
            Step("step", "not_a_function")

    def test_zero_timeout(self):
        with pytest.raises(ValueError, match="timeout must be > 0"):
            Step("step", _step_research, timeout=0)

    def test_duplicate_substep_names(self):
        with pytest.raises(ValueError, match="Duplicate substep"):
            Step("s", _step_research, substeps=[SubStep("a"), SubStep("a")])

    def test_with_substeps(self):
        s = Step("analyze", _step_analyze, substeps=[
            SubStep("business", "Business context"),
            SubStep("brand", "Brand analysis"),
        ])
        assert len(s.substeps) == 2


# ── Parallel validation ─────────────────────────────────────────────

class TestParallel:
    def test_valid(self):
        p = Parallel("create", steps=[
            Step("a", _step_register),
            Step("b", _step_generate),
        ], label="Create campaigns")
        assert p.name == "create"
        assert len(p.steps) == 2

    def test_empty_name(self):
        with pytest.raises(ValueError, match="name must be set"):
            Parallel("", steps=[Step("a", _step_register), Step("b", _step_generate)])

    def test_empty_steps(self):
        with pytest.raises(ValueError, match="must not be empty"):
            Parallel("p", steps=[])

    def test_single_step(self):
        with pytest.raises(ValueError, match="at least 2"):
            Parallel("p", steps=[Step("a", _step_register)])

    def test_duplicate_child_names(self):
        with pytest.raises(ValueError, match="Duplicate"):
            Parallel("p", steps=[Step("a", _step_register), Step("a", _step_generate)])

    def test_default_label(self):
        p = Parallel("my_group", steps=[Step("a", _step_register), Step("b", _step_generate)])
        assert p.label == "My Group"


# ── AgenticWorkflow validation ──────────────────────────────────────

class TestAgenticWorkflow:
    def test_valid(self):
        wf = _make_workflow()
        assert wf.name == "test_trigger"
        assert len(wf.steps) == 3

    def test_trigger_not_base_tool(self):
        with pytest.raises(TypeError, match="BaseTool"):
            AgenticWorkflow(trigger="not_a_tool", title="Test", steps=[Step("s", _step_research)])

    def test_empty_steps(self):
        with pytest.raises(ValueError, match="must not be empty"):
            AgenticWorkflow(trigger=_test_trigger, title="Test", steps=[])

    def test_trigger_no_docstring(self):
        @tool
        async def _no_doc(x: str) -> dict:
            """Has a docstring."""
            pass
        _no_doc.description = ""
        with pytest.raises(ValueError, match="no description"):
            AgenticWorkflow(trigger=_no_doc, title="Test", steps=[Step("s", _step_research)])

    def test_duplicate_names_across_parallel(self):
        """Step name inside Parallel conflicts with top-level."""
        with pytest.raises(ValueError, match="Duplicate"):
            AgenticWorkflow(
                trigger=_test_trigger, title="Test",
                steps=[
                    Step("research", _step_research),
                    Parallel("p", steps=[
                        Step("research", _step_register),  # dupe!
                        Step("b", _step_generate),
                    ]),
                ],
            )

    def test_with_parallel(self):
        wf = AgenticWorkflow(
            trigger=_test_trigger, title="Test",
            steps=[
                Step("a", _step_research),
                Parallel("p", steps=[Step("b", _step_register), Step("c", _step_generate)]),
                Step("d", _step_plan),
            ],
        )
        assert len(wf.steps) == 3

    def test_build_graph_returns_state_graph(self):
        wf = _make_workflow()
        sg = wf.build_graph()
        assert hasattr(sg, "compile")


# ── Compiled graph structure ────────────────────────────────────────

class TestCompiledGraph:
    def test_nodes_exist_sequential(self):
        wf = _make_workflow()
        compiled = wf.build_graph().compile()
        nodes = set(compiled.get_graph().nodes.keys())
        assert "_parse_trigger" in nodes
        assert "research" in nodes
        assert "analyze" in nodes
        assert "plan" in nodes
        assert "_finalize" in nodes
        assert "_error_exit" in nodes
        assert "_cancel" in nodes

    def test_nodes_exist_with_parallel(self):
        wf = AgenticWorkflow(
            trigger=_test_trigger, title="Test",
            steps=[
                Step("a", _step_research),
                Parallel("p", steps=[Step("b", _step_register), Step("c", _step_generate)]),
                Step("d", _step_plan),
            ],
        )
        compiled = wf.build_graph().compile()
        nodes = set(compiled.get_graph().nodes.keys())
        assert "a" in nodes
        assert "p" in nodes  # Parallel group is one node
        assert "d" in nodes
        # Children are NOT separate nodes — they run inside the Parallel node
        assert "b" not in nodes
        assert "c" not in nodes


# ── StepProgress ────────────────────────────────────────────────────

class TestStepProgress:
    def test_start_emits_delta(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        progress = StepProgress(emitter, "wf-test", "/steps/1", ["business", "brand"])
        progress.start("business")
        assert len(emitted) == 1
        assert emitted[0]["patch"][0]["path"] == "/steps/1/substeps/0/status"
        assert emitted[0]["patch"][0]["value"] == "active"

    def test_done_emits_delta_with_summary(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        progress = StepProgress(emitter, "wf-test", "/steps/1", ["business", "brand"])
        progress.done("brand", summary="Strong identity")
        assert len(emitted) == 1
        assert emitted[0]["patch"][0]["path"] == "/steps/1/substeps/1/status"
        assert emitted[0]["patch"][0]["value"] == "done"
        assert emitted[0]["patch"][1]["path"].endswith("/completed_at")
        assert emitted[0]["patch"][2]["value"] == "Strong identity"

    def test_error_emits_delta(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        progress = StepProgress(emitter, "wf-test", "/steps/1", ["business"])
        progress.error("business", message="LLM timeout")
        assert emitted[0]["patch"][0]["value"] == "error"
        assert emitted[0]["patch"][1]["path"].endswith("/completed_at")
        assert emitted[0]["patch"][2]["value"] == "LLM timeout"

    def test_unknown_substep_raises(self):
        _, writer = _collector()
        emitter = StreamEmitter(writer)
        progress = StepProgress(emitter, "wf-test", "/steps/1", ["business"])
        with pytest.raises(ValueError, match="Unknown substep 'typo'"):
            progress.start("typo")

    def test_null_progress_raises(self):
        null = _NullProgress()
        with pytest.raises(ValueError, match="no substeps declared"):
            null.start("anything")

    def test_parallel_child_path(self):
        """StepProgress works with Parallel child paths."""
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        progress = StepProgress(emitter, "wf-test", "/steps/3/children/0", ["x", "y"])
        progress.done("y", summary="Done")
        assert emitted[0]["patch"][0]["path"] == "/steps/3/children/0/substeps/1/status"


# ── WorkflowContext ─────────────────────────────────────────────────

class TestWorkflowContext:
    def test_fields(self):
        ctx = WorkflowContext(
            args={"url": "https://example.com"},
            results={"step1": NodeResponse(summary="done", data={"x": 1})},
            progress=_NullProgress(),
            step_name="step2",
            user_id="user-123",
            org_id="org-456",
        )
        assert ctx.args["url"] == "https://example.com"
        assert ctx.results["step1"].summary == "done"
        assert ctx.results["step1"].data == {"x": 1}
        assert ctx.step_name == "step2"

    def test_defaults(self):
        ctx = WorkflowContext(args={}, results={}, progress=_NullProgress(), step_name="s")
        assert ctx.user_id == "anonymous"
        assert ctx.org_id == "default"


# ── Snapshot builders ───────────────────────────────────────────────

class TestSnapshotBuilders:
    def test_simple_snapshot(self):
        steps = [Step("a", _step_research, label="Step A"), Step("b", _step_plan, label="Step B")]
        snap = _build_snapshot(steps, "My Workflow")
        assert snap["title"] == "My Workflow"
        assert snap["status"] == "active"
        assert len(snap["steps"]) == 2
        assert snap["steps"][0] == {"name": "a", "label": "Step A", "status": "pending", "summary": "", "started_at": None, "completed_at": None, "artifacts": []}

    def test_snapshot_with_substeps(self):
        steps = [Step("analyze", _step_analyze, label="Analyze", substeps=[
            SubStep("business", "Business"), SubStep("brand", "Brand"),
        ])]
        snap = _build_snapshot(steps, "Test")
        assert "substeps" in snap["steps"][0]
        assert len(snap["steps"][0]["substeps"]) == 2
        assert snap["steps"][0]["substeps"][0]["name"] == "business"

    def test_snapshot_with_parallel(self):
        steps = [
            Step("a", _step_research, label="A"),
            Parallel("p", label="Parallel Group", steps=[
                Step("b", _step_register, label="B"),
                Step("c", _step_generate, label="C"),
            ]),
        ]
        snap = _build_snapshot(steps, "Test")
        assert len(snap["steps"]) == 2
        assert "children" in snap["steps"][1]
        assert len(snap["steps"][1]["children"]) == 2
        assert snap["steps"][1]["children"][0]["name"] == "b"

    def test_snapshot_parallel_child_with_substeps(self):
        steps = [
            Parallel("p", label="P", steps=[
                Step("a", _step_register, label="A", substeps=[SubStep("x", "X")]),
                Step("b", _step_generate, label="B"),
            ]),
        ]
        snap = _build_snapshot(steps, "Test")
        assert "substeps" in snap["steps"][0]["children"][0]
        assert snap["steps"][0]["children"][0]["substeps"][0]["name"] == "x"


# ── Step wave (single Step execution) ──────────────────────────────

class TestStepWave:
    @pytest.mark.asyncio
    async def test_emits_thinking_and_activity(self):
        wf = _make_workflow()
        step = wf.steps[0]  # research
        emitted, writer = _collector()
        state = _make_state()

        step_fn = _make_step_wave(step, 0, wf)
        result = await step_fn(state, RunnableConfig(), writer)

        types = [e["type"] for e in emitted]
        assert WriterEvent.THINKING in types
        assert WriterEvent.ACTIVITY_DELTA in types

        deltas = [e for e in emitted if e["type"] == WriterEvent.ACTIVITY_DELTA]
        assert deltas[0]["patch"][0]["value"] == "active"
        assert deltas[1]["patch"][0]["value"] == "done"

        assert "research" in result["step_results"]
        assert result["step_results"]["research"]["summary"] == "Researched https://acme.com"

    @pytest.mark.asyncio
    async def test_timeout(self):
        step = Step("slow", _step_slow, timeout=1)
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(tool_calls=[{"name": "simple_trigger", "args": {"query": "t"}, "id": "tc1"}],
                            args={"query": "t"})

        step_fn = _make_step_wave(step, 0, wf)
        result = await step_fn(state, RunnableConfig(), writer)
        assert "timed out" in result["error"]

    @pytest.mark.asyncio
    async def test_error(self):
        step = Step("failing", _step_failing)
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        step_fn = _make_step_wave(step, 0, wf)
        result = await step_fn(state, RunnableConfig(), writer)
        assert "failed" in result["error"]
        assert "exploded" in result["error"]

    @pytest.mark.asyncio
    async def test_emits_ui_blocks(self):
        step = Step("blocks", _step_with_blocks)
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        step_fn = _make_step_wave(step, 0, wf)
        await step_fn(state, RunnableConfig(), writer)

        block_events = [e for e in emitted if e.get("type") == WriterEvent.CUSTOM and e.get("name") == "test_block"]
        assert len(block_events) == 1
        assert block_events[0]["value"] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_substep_progress(self):
        step = Step("analyze", _step_with_substeps, label="Analyze", substeps=[
            SubStep("business", "Business"), SubStep("brand", "Brand"),
        ])
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        step_fn = _make_step_wave(step, 0, wf)
        await step_fn(state, RunnableConfig(), writer)

        # Should have substep deltas
        substep_deltas = [e for e in emitted
                         if e.get("type") == WriterEvent.ACTIVITY_DELTA
                         and any("/substeps/" in p.get("path", "") for p in e.get("patch", []))]
        assert len(substep_deltas) == 4  # start+done for business, start+done for brand

    @pytest.mark.asyncio
    async def test_ctx_results_are_node_responses(self):
        """Step functions receive ctx.results as dict[str, NodeResponse]."""
        received_results = {}

        async def check_results(ctx: WorkflowContext) -> NodeResponse:
            received_results.update(ctx.results)
            return NodeResponse(summary="ok")

        wf = AgenticWorkflow(
            trigger=_simple_trigger, title="Test",
            steps=[Step("checker", check_results)],
        )
        state = _make_state(
            args={"query": "t"},
            results={"prev": {"summary": "Previous step", "data": {"x": 1}, "metadata": {}}},
        )
        emitted, writer = _collector()
        step_fn = _make_step_wave(wf.steps[0], 0, wf)
        await step_fn(state, RunnableConfig(), writer)

        assert "prev" in received_results
        assert isinstance(received_results["prev"], NodeResponse)
        assert received_results["prev"].summary == "Previous step"
        assert received_results["prev"].data == {"x": 1}


# ── Parallel wave ───────────────────────────────────────────────────

class TestParallelWave:
    @pytest.mark.asyncio
    async def test_runs_children_concurrently(self):
        """Both children execute and their results are stored."""
        parallel = Parallel("create", steps=[
            Step("register", _step_register, label="Register"),
            Step("generate", _step_generate, label="Generate"),
        ])
        wf = AgenticWorkflow(trigger=_test_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state()

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        result = await wave_fn(state, RunnableConfig(), writer)

        assert "register" in result["step_results"]
        assert "generate" in result["step_results"]
        assert result["step_results"]["register"]["summary"] == "Plan registered"
        assert result["step_results"]["generate"]["summary"] == "3 campaigns generated"
        assert result.get("error") is None or result["error"] == ""

    @pytest.mark.asyncio
    async def test_emits_group_and_child_deltas(self):
        parallel = Parallel("create", steps=[
            Step("register", _step_register),
            Step("generate", _step_generate),
        ])
        wf = AgenticWorkflow(trigger=_test_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state()

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        await wave_fn(state, RunnableConfig(), writer)

        deltas = [e for e in emitted if e.get("type") == WriterEvent.ACTIVITY_DELTA]
        paths = [p["path"] for e in deltas for p in e.get("patch", [])]

        # Group active + done
        assert "/steps/0/status" in paths
        # Children active + done
        assert "/steps/0/children/0/status" in paths
        assert "/steps/0/children/1/status" in paths

    @pytest.mark.asyncio
    async def test_child_error_reports_first_error(self):
        parallel = Parallel("p", steps=[
            Step("ok", _step_register),
            Step("bad", _step_failing),
        ])
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        result = await wave_fn(state, RunnableConfig(), writer)

        assert result["error"]
        assert "exploded" in result["error"]

    @pytest.mark.asyncio
    async def test_child_timeout(self):
        parallel = Parallel("p", steps=[
            Step("ok", _step_register),
            Step("slow", _step_slow, timeout=1),
        ])
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        result = await wave_fn(state, RunnableConfig(), writer)

        assert "timed out" in result["error"]


# ── Parse trigger ───────────────────────────────────────────────────

class TestParseTrigger:
    @pytest.mark.asyncio
    async def test_extracts_args_and_emits_snapshot(self):
        wf = _make_workflow()
        emitted, writer = _collector()
        state = _make_state()

        parse_fn = _make_parse_trigger_node(wf)
        result = await parse_fn(state, writer)

        assert result["workflow_args"] == {"goal": "test", "url": "https://acme.com"}
        assert result["error"] == ""

        snapshots = [e for e in emitted if e["type"] == WriterEvent.ACTIVITY_SNAPSHOT]
        assert len(snapshots) == 1
        assert snapshots[0]["content"]["title"] == "Test workflow for https://acme.com"
        assert len(snapshots[0]["content"]["steps"]) == 3

    @pytest.mark.asyncio
    async def test_snapshot_includes_substeps_and_children(self):
        wf = AgenticWorkflow(
            trigger=_test_trigger, title="Test",
            steps=[
                Step("a", _step_research, substeps=[SubStep("x", "X")]),
                Parallel("p", steps=[Step("b", _step_register), Step("c", _step_generate)]),
            ],
        )
        emitted, writer = _collector()
        state = _make_state()

        parse_fn = _make_parse_trigger_node(wf)
        await parse_fn(state, writer)

        snap = emitted[0]["content"]
        assert "substeps" in snap["steps"][0]
        assert "children" in snap["steps"][1]

    @pytest.mark.asyncio
    async def test_no_matching_tool_call(self):
        wf = _make_workflow()
        state = _make_state(tool_calls=[{"name": "other_tool", "args": {}, "id": "tc1"}])
        result = await _make_parse_trigger_node(wf)(state, lambda e: None)
        assert "No tool call found" in result["error"]


# ── Finalize node ───────────────────────────────────────────────────

class TestFinalizeNode:
    @pytest.mark.asyncio
    async def test_default_finalize(self):
        wf = _make_workflow()
        emitted, writer = _collector()
        state = _make_state(results={
            "research": {"summary": "Found 5 items", "data": {}},
            "analyze": {"summary": "3 competitors", "data": {}},
            "plan": {"summary": "$500/day plan", "data": {}},
        }, current_step=3)

        result = await _make_finalize_node(wf)(state, writer)

        msg = result["messages"][0]
        assert isinstance(msg, ToolMessage)
        # Minimal content — last step summary + instruction not to parrot
        assert "Workflow completed" in msg.content
        assert "$500/day plan" in msg.content  # last step summary
        assert "restate" in msg.content.lower()
        assert msg.tool_call_id == "tc1"

        custom = [e for e in emitted if e.get("type") == WriterEvent.CUSTOM]
        assert custom[0]["value"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_finalize_with_parallel_results(self):
        wf = AgenticWorkflow(
            trigger=_test_trigger, title="Test",
            steps=[
                Step("a", _step_research),
                Parallel("p", steps=[Step("b", _step_register), Step("c", _step_generate)]),
            ],
        )
        emitted, writer = _collector()
        state = _make_state(results={
            "a": {"summary": "Done A"},
            "b": {"summary": "Done B"},
            "c": {"summary": "Done C"},
        })

        result = await _make_finalize_node(wf)(state, writer)
        content = result["messages"][0].content
        # Last step is inside Parallel "p" — last child is "c"
        assert "Done C" in content
        assert "Workflow completed" in content

    @pytest.mark.asyncio
    async def test_custom_finalize(self):
        async def my_finalize(state, results):
            return "Custom summary!"

        wf = _make_workflow(finalize=my_finalize)
        state = _make_state(results={}, current_step=3)

        result = await _make_finalize_node(wf)(state, lambda e: None)
        assert result["messages"][0].content == "Custom summary!"


# ── Error/Cancel nodes ──────────────────────────────────────────────

class TestErrorExitNode:
    @pytest.mark.asyncio
    async def test_error_exit(self):
        wf = _make_workflow()
        emitted, writer = _collector()
        state = _make_state(
            results={"research": {"summary": "Done", "data": {}}},
            error="Step 'Analyze market' failed: connection error",
            current_step=1,
        )

        result = await _make_error_exit_node(wf)(state, writer)

        msg = result["messages"][0]
        assert "connection error" in msg.content

        custom = [e for e in emitted if e.get("type") == WriterEvent.CUSTOM]
        assert custom[0]["value"]["status"] == "error"


class TestCancelNode:
    @pytest.mark.asyncio
    async def test_cancel(self):
        wf = _make_workflow()
        emitted, writer = _collector()
        state = _make_state()

        result = await _make_cancel_node(wf)(state, writer)

        msg = result["messages"][0]
        assert "cancelled" in msg.content.lower()

        deltas = [e for e in emitted if e.get("type") == WriterEvent.ACTIVITY_DELTA]
        assert deltas[0]["patch"][0]["value"] == "cancelled"


# ── Wave router ─────────────────────────────────────────────────────

class TestWaveRouter:
    def test_routes_next(self):
        router = _make_wave_router(["step1"])
        state = {"step_results": {"step1": {"summary": "ok"}}, "error": ""}
        assert router(state) == "next"

    def test_routes_error(self):
        router = _make_wave_router(["step1"])
        state = {"step_results": {}, "error": "something broke"}
        assert router(state) == "error"

    def test_routes_cancel(self):
        router = _make_wave_router(["step1"])
        state = {"step_results": {"step1": {"_cancelled": True}}, "error": ""}
        assert router(state) == "cancel"

    def test_checks_only_wave_steps(self):
        """Router only checks its own wave's step names."""
        router = _make_wave_router(["step2"])
        state = {"step_results": {"step1": {"_cancelled": True}, "step2": {"summary": "ok"}}, "error": ""}
        assert router(state) == "next"  # step1's cancel doesn't affect step2's router


# ── Helpers ─────────────────────────────────────────────────────────

class TestHelpers:
    def test_find_tool_call_id(self):
        state = {"messages": [AIMessage(content="", tool_calls=[
            {"name": "my_trigger", "args": {}, "id": "abc123"},
        ])]}
        assert _find_tool_call_id(state, "my_trigger") == "abc123"
        assert _find_tool_call_id(state, "nonexistent") == "unknown"

    def test_find_tool_call_id_empty(self):
        assert _find_tool_call_id({"messages": []}, "x") == "unknown"


# ── Block-step association ──────────────────────────────────────────

class TestBlockStepAssociation:
    @pytest.mark.asyncio
    async def test_ui_blocks_tagged_with_step_name(self):
        """CUSTOM events for UI blocks carry workflow_step for frontend grouping."""
        step = Step("analyze", _step_with_blocks)
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        step_fn = _make_step_wave(step, 0, wf)
        await step_fn(state, RunnableConfig(), writer)

        block_events = [e for e in emitted if e.get("type") == WriterEvent.CUSTOM and e.get("name") == "test_block"]
        assert len(block_events) == 1
        assert block_events[0]["workflow_step"] == "analyze"

    @pytest.mark.asyncio
    async def test_parallel_child_blocks_tagged(self):
        """Blocks from Parallel children carry the child step name."""
        parallel = Parallel("p", steps=[
            Step("with_blocks", _step_with_blocks, label="Blocks"),
            Step("register", _step_register, label="Register"),
        ])
        wf = AgenticWorkflow(trigger=_test_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state()

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        await wave_fn(state, RunnableConfig(), writer)

        block_events = [e for e in emitted if e.get("type") == WriterEvent.CUSTOM and e.get("name") == "test_block"]
        assert len(block_events) == 1
        assert block_events[0]["workflow_step"] == "with_blocks"


# ── HITL review status ──────────────────────────────────────────────

class TestHITLInParallelIgnored:
    @pytest.mark.asyncio
    async def test_hitl_in_parallel_child_is_silently_dropped(self):
        """HITL returned from a Parallel child is ignored (logged, not raised)."""
        parallel = Parallel("p", steps=[
            Step("with_hitl", _step_with_hitl, label="HITL Step"),
            Step("normal", _step_register, label="Normal"),
        ])
        wf = AgenticWorkflow(trigger=_test_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state()

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        result = await wave_fn(state, RunnableConfig(), writer)

        # Should complete without interrupt — HITL was dropped
        assert "with_hitl" in result["step_results"]
        assert "normal" in result["step_results"]
        assert not result.get("error")


class TestBlocksWithoutSummaryWarning:
    @pytest.mark.asyncio
    async def test_blocks_without_summary_logs_warning(self, caplog):
        """Step emitting blocks without summary triggers a warning."""
        async def blocks_no_summary(ctx: WorkflowContext) -> NodeResponse:
            return NodeResponse(ui_blocks=[UIBlock(type="chart", data={"x": 1})])

        step = Step("no_summary", blocks_no_summary)
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[step])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        import logging
        with caplog.at_level(logging.WARNING):
            step_fn = _make_step_wave(step, 0, wf)
            await step_fn(state, RunnableConfig(), writer)

        assert any("no summary" in r.message.lower() for r in caplog.records)


class TestHITLReviewStatus:
    @pytest.mark.asyncio
    async def test_step_without_hitl_goes_directly_to_done(self):
        """Steps without HITL emit 'active' then 'done' — no 'review'."""
        step = Step("research", _step_research)
        wf = _make_workflow()
        emitted, writer = _collector()
        state = _make_state()

        step_fn = _make_step_wave(step, 0, wf)
        await step_fn(state, RunnableConfig(), writer)

        statuses = []
        for e in emitted:
            if e.get("type") == WriterEvent.ACTIVITY_DELTA:
                for p in e.get("patch", []):
                    if p.get("path") == "/steps/0/status":
                        statuses.append(p["value"])

        assert statuses == [StepStatus.ACTIVE, StepStatus.DONE]
        assert StepStatus.REVIEW not in statuses


# ── Parallel exception stores error result (P0 fix #2) ─────────────

class TestParallelExceptionStoresResult:
    @pytest.mark.asyncio
    async def test_child_exception_stores_error_in_step_results(self):
        """When asyncio.gather catches an unexpected exception, the error is stored in step_results."""
        async def exploding(ctx):
            raise RuntimeError("boom")

        parallel = Parallel("p", steps=[
            Step("ok", _step_register),
            Step("explode", exploding),
        ])
        wf = AgenticWorkflow(trigger=_simple_trigger, title="Test", steps=[parallel])
        emitted, writer = _collector()
        state = _make_state(args={"query": "t"})

        wave_fn = _make_parallel_wave(parallel, 0, wf)
        result = await wave_fn(state, RunnableConfig(), writer)

        assert result["error"]
        # The exception child must have its error stored in step_results
        assert "explode" in result["step_results"]
        assert result["step_results"]["explode"].get("_error")
        # The successful child should also be stored
        assert "ok" in result["step_results"]


# ── Timestamp consistency (P0 fix #3) ──────────────────────────────

class TestTimestampConsistency:
    @pytest.mark.asyncio
    async def test_step_started_timestamp_matches_result(self):
        """_emit_step_started returns the timestamp used, which is stored in step_data."""
        wf = _make_workflow()
        step = wf.steps[0]  # research
        emitted, writer = _collector()
        state = _make_state()

        step_fn = _make_step_wave(step, 0, wf)
        result = await step_fn(state, RunnableConfig(), writer)

        # Find the started_at from the ACTIVITY_DELTA
        started_deltas = [e for e in emitted if e.get("type") == WriterEvent.ACTIVITY_DELTA
                         and any(p.get("path") == "/steps/0/started_at" for p in e.get("patch", []))]
        assert len(started_deltas) == 1
        delta_ts = next(p["value"] for p in started_deltas[0]["patch"] if p["path"] == "/steps/0/started_at")

        # Must match what's stored in step_results
        assert result["step_results"]["research"]["started_at"] == delta_ts


# ── _format_title logs warning on error (P2 fix #12) ───────────────

class TestFormatTitleWarning:
    def test_format_title_logs_warning_on_bad_key(self, caplog):
        from src.agentic_platform.core.engine._workflow_runtime import format_title as _format_title
        import logging
        with caplog.at_level(logging.WARNING):
            result = _format_title("Campaign for {ulr}", {"url": "https://example.com"})
        assert result == "Campaign for {ulr}"
        assert any("Failed to format" in r.message for r in caplog.records)
