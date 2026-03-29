"""Tests for StreamReducer — infallible snapshot accumulator."""

from ag_ui.core import (
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    CustomEvent,
    ActivitySnapshotEvent,
    ActivityDeltaEvent,
    RunFinishedEvent,
    RunErrorEvent,
    StepStartedEvent,
    StepFinishedEvent,
    ReasoningMessageChunkEvent,
)

from src.agentic_platform.api.chat.stream_reducer import StreamReducer, RunStatus


class TestTextLifecycle:
    def test_text_accumulation(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Hello "))
        r.apply(TextMessageContentEvent(message_id="m1", delta="world!"))
        r.apply(TextMessageEndEvent(message_id="m1"))

        s = r.snapshot
        assert s.text_started is True
        assert s.text == "Hello world!"

    def test_text_in_db_blocks(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Result"))
        r.apply(TextMessageEndEvent(message_id="m1"))

        blocks = r.snapshot.to_db_blocks()
        assert len(blocks) == 1
        assert blocks[0]["type"] == "text"
        assert blocks[0]["content"] == "Result"
        assert blocks[0]["id"] == "text-m1"


class TestHITLBlock:
    def test_hitl_creates_block_and_interrupts(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="hitl_request", value={
            "hitl_id": "hitl-abc", "title": "Approve?", "type": "confirmation",
        }))

        s = r.snapshot
        assert s.run_status == RunStatus.INTERRUPTED
        assert s.hitl_interrupted is True
        assert len(s.blocks) == 1
        assert s.blocks[0].type == "hitl_request"
        assert s.blocks[0].status == "awaiting_input"
        assert s.blocks[0].id == "hitl-abc"
        assert s.blocks[0].content["title"] == "Approve?"


class TestCustomBlock:
    def test_regular_block_collected(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="dashboard", value={"campaigns": [1, 2]}))

        s = r.snapshot
        assert len(s.blocks) == 1
        assert s.blocks[0].type == "dashboard"
        assert s.blocks[0].status == "completed"
        assert s.blocks[0].content == {"campaigns": [1, 2]}

    def test_block_metadata_passthrough(self):
        """display, inline_trigger, workflow_step extracted from __agui_meta."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="details", value={
            "name": "Summer",
            "__agui_meta": {
                "display": "sidebar",
                "inline_trigger": {"title": "Click"},
                "workflow_step": "analyze",
            },
        }))

        b = r.snapshot.blocks[0]
        assert b.display == "sidebar"
        assert b.inline_trigger == {"title": "Click"}
        assert b.workflow_step == "analyze"
        # __agui_meta should not be in content
        assert "__agui_meta" not in b.content

    def test_to_db_blocks_backward_compat(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="chart", value={
            "x": 1,
            "__agui_meta": {"display": "sidebar", "workflow_step": "step1"},
        }))

        blocks = r.snapshot.to_db_blocks()
        assert len(blocks) == 1
        assert blocks[0]["type"] == "chart"
        assert blocks[0]["data"] == {"x": 1}
        assert blocks[0]["display"] == "sidebar"
        assert blocks[0]["workflow_step"] == "step1"
        assert "id" in blocks[0]  # UUID assigned by reducer


class TestWorkflowProgress:
    def test_workflow_progress_no_block_object(self):
        """workflow_progress updates activity, does NOT create a Block in blocks list."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={
            "title": "Creating campaign", "status": "active", "steps": [],
        }))

        s = r.snapshot
        assert len(s.blocks) == 0  # no Block object
        assert s.workflow_activity == {"title": "Creating campaign", "status": "active", "steps": []}

    def test_workflow_reference_in_db_blocks(self):
        """to_db_blocks(workflow_id=...) includes a lightweight reference, not full data."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r._snap.workflow_name = "create_campaign"
        r.apply(CustomEvent(name="workflow_progress", value={
            "title": "Creating campaign", "status": "completed", "steps": [{"name": "s1", "status": "done"}],
        }))
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Done!"))

        db = r.snapshot.to_db_blocks(workflow_id="wf-uuid-123")
        types = [b["type"] for b in db]
        assert "workflow_progress" in types
        assert "text" in types
        # workflow_progress appears before text (it was emitted first)
        assert types.index("workflow_progress") < types.index("text")

        wf_block = next(b for b in db if b["type"] == "workflow_progress")
        # Only a reference — no full activity_content
        assert wf_block["workflow_id"] == "wf-uuid-123"
        assert "data" not in wf_block

    def test_no_workflow_block_without_id(self):
        """If workflow_id is None, no workflow_progress block in DB output."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r._snap.workflow_name = "create_campaign"
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Hi"))

        db = r.snapshot.to_db_blocks(workflow_id=None)
        assert all(b.get("type") != "workflow_progress" for b in db)

    def test_no_workflow_block_without_name(self):
        """If workflow_name is not set, no workflow_progress block even with ID."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Hi"))

        db = r.snapshot.to_db_blocks(workflow_id="wf-uuid-123")
        assert all(b.get("type") != "workflow_progress" for b in db)


class TestActivitySnapshot:
    def test_sets_workflow_activity_and_name(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(ActivitySnapshotEvent(
            message_id="wf-create_campaign",
            activity_type="workflow_progress",
            content={"title": "Creating campaign", "steps": []},
        ))

        s = r.snapshot
        assert s.workflow_activity == {"title": "Creating campaign", "steps": []}
        assert s.workflow_name == "create_campaign"


class TestRunStatus:
    def test_initial_running(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        assert r.snapshot.run_status == RunStatus.RUNNING

    def test_finished_to_idle(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(RunFinishedEvent(thread_id="t1", run_id="r1"))
        assert r.snapshot.run_status == RunStatus.IDLE

    def test_error(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(RunErrorEvent(message="boom"))
        assert r.snapshot.run_status == RunStatus.ERROR

    def test_interrupted_stays_interrupted_after_finish(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="hitl_request", value={"hitl_id": "h1"}))
        assert r.snapshot.run_status == RunStatus.INTERRUPTED
        r.apply(RunFinishedEvent(thread_id="t1", run_id="r1"))
        assert r.snapshot.run_status == RunStatus.INTERRUPTED  # not overwritten


class TestEphemeralNoEffect:
    def test_step_events_no_change(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        before_text = r.snapshot.text
        before_blocks = len(r.snapshot.blocks)
        r.apply(StepStartedEvent(step_name="my_tool"))
        r.apply(StepFinishedEvent(step_name="my_tool"))
        assert r.snapshot.text == before_text
        assert len(r.snapshot.blocks) == before_blocks

    def test_reasoning_no_change(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(ReasoningMessageChunkEvent(message_id="thinking", delta="Working..."))
        assert r.snapshot.text == ""
        assert len(r.snapshot.blocks) == 0


class TestApplyNeverThrows:
    def test_garbage_input(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply("garbage")
        r.apply(42)
        r.apply(None)
        assert r.snapshot.dirty is False  # these just fall through, no exception

    def test_malformed_custom_event_marks_dirty(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        # CustomEvent with non-dict value where dict ops are expected
        r.apply(CustomEvent(name="bad", value="not_a_dict"))
        # Should not raise, and block should still be created (with empty content)
        assert len(r.snapshot.blocks) == 1


class TestDbWorkflowStatus:
    def test_completed(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={"status": "completed"}))
        assert r.snapshot.to_db_workflow_status() == "completed"

    def test_error(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={"status": "error"}))
        assert r.snapshot.to_db_workflow_status() == "failed"

    def test_cancelled(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={"status": "cancelled"}))
        assert r.snapshot.to_db_workflow_status() == "cancelled"

    def test_hitl_interrupted(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={"status": "active"}))
        r._snap.hitl_interrupted = True
        assert r.snapshot.to_db_workflow_status() == "waiting_hitl"

    def test_active(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="workflow_progress", value={"status": "active"}))
        assert r.snapshot.to_db_workflow_status() == "active"

    def test_no_activity(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        assert r.snapshot.to_db_workflow_status() == "active"


class TestSequenceOrdering:
    def test_blocks_have_monotonic_sequence(self):
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="chart_a", value={"x": 1}))
        r.apply(CustomEvent(name="chart_b", value={"x": 2}))
        r.apply(CustomEvent(name="chart_c", value={"x": 3}))

        seqs = [b.sequence for b in r.snapshot.blocks]
        assert seqs == sorted(seqs)
        assert len(set(seqs)) == 3  # all unique

    def test_text_before_blocks_persists_in_order(self):
        """Text starts before blocks → text appears first in DB output."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Here: "))
        r.apply(CustomEvent(name="chart", value={"x": 1}))

        db = r.snapshot.to_db_blocks()
        assert db[0]["type"] == "text"
        assert db[0]["content"] == "Here: "
        assert db[1]["type"] == "chart"

    def test_blocks_before_text_persists_in_order(self):
        """Blocks emitted before text → blocks appear first in DB output."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="chart", value={"x": 1}))
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="Done."))

        db = r.snapshot.to_db_blocks()
        assert db[0]["type"] == "chart"
        assert db[1]["type"] == "text"
        assert db[1]["content"] == "Done."

    def test_interleaved_blocks_and_text(self):
        """Block A → text → Block B → all in stream order."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="block_a", value={"a": 1}))
        r.apply(TextMessageStartEvent(message_id="m1", role="assistant"))
        r.apply(TextMessageContentEvent(message_id="m1", delta="middle"))
        r.apply(CustomEvent(name="block_b", value={"b": 2}))

        db = r.snapshot.to_db_blocks()
        types = [b["type"] for b in db]
        assert types == ["block_a", "text", "block_b"]

    def test_hitl_block_sequence_preserved(self):
        """HITL request respects sequence relative to other blocks."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="chart", value={"x": 1}))
        r.apply(CustomEvent(name="hitl_request", value={"hitl_id": "h1", "title": "Ok?"}))

        db = r.snapshot.to_db_blocks()
        assert db[0]["type"] == "chart"
        assert db[1]["type"] == "hitl_request"

    def test_sequence_survives_ephemeral_events(self):
        """Ephemeral events (step/reasoning) increment the counter but don't create blocks.
        Block sequences still monotonically increase."""
        r = StreamReducer(msg_id="m1", run_id="r1")
        r.apply(CustomEvent(name="block_a", value={}))
        r.apply(StepStartedEvent(step_name="tool"))
        r.apply(StepFinishedEvent(step_name="tool"))
        r.apply(CustomEvent(name="block_b", value={}))

        seqs = [b.sequence for b in r.snapshot.blocks]
        assert seqs[1] > seqs[0]  # gap is fine — monotonic is what matters
