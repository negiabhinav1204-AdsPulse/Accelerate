"""Tests for StreamEmitter — typed StreamWriter wrapper."""

from src.agentic_platform.core.stream_emitter import (
    StreamEmitter,
    _THINKING, _STEP_STARTED, _STEP_FINISHED, _CUSTOM,
    _ACTIVITY_SNAPSHOT, _ACTIVITY_DELTA,
)


def _collector():
    emitted = []
    return emitted, lambda event: emitted.append(event)


class TestThinking:
    def test_emits_correct_dict(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.thinking("Working on it...")
        assert len(emitted) == 1
        assert emitted[0]["type"] == _THINKING
        assert emitted[0]["content"] == "Working on it..."
        assert emitted[0]["message_id"] == "thinking"

    def test_custom_message_id(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.thinking("Analyzing...", message_id="thinking-analyze")
        assert emitted[0]["message_id"] == "thinking-analyze"


class TestStepEvents:
    def test_step_started(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.step_started("query_analytics")
        assert emitted[0] == {"type": _STEP_STARTED, "stepName": "query_analytics"}

    def test_step_finished(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.step_finished("query_analytics")
        assert emitted[0] == {"type": _STEP_FINISHED, "stepName": "query_analytics"}


class TestBlock:
    def test_basic_block(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.block("dashboard", {"campaigns": [1, 2]})
        assert emitted[0]["type"] == _CUSTOM
        assert emitted[0]["name"] == "dashboard"
        assert emitted[0]["value"] == {"campaigns": [1, 2]}
        # Default display="inline" is omitted to keep events clean
        assert "display" not in emitted[0]

    def test_block_no_meta_when_defaults(self):
        """workflow_progress and other internal events stay clean."""
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.block("workflow_progress", {"status": "active"})
        assert "display" not in emitted[0]
        assert "inline_trigger" not in emitted[0]
        assert "workflow_step" not in emitted[0]

    def test_block_with_metadata(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.block(
            "campaign_details",
            {"name": "Summer"},
            display="sidebar",
            inline_trigger={"title": "Summer Campaign"},
            workflow_step="analyze",
        )
        assert emitted[0]["display"] == "sidebar"
        assert emitted[0]["inline_trigger"] == {"title": "Summer Campaign"}
        assert emitted[0]["workflow_step"] == "analyze"

    def test_block_without_workflow_step(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.block("chart", {"x": 1})
        assert "workflow_step" not in emitted[0]


class TestActivitySnapshot:
    def test_shape(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.activity_snapshot(
            "wf-create_campaign",
            "workflow_progress",
            {"title": "Creating campaign", "steps": []},
        )
        assert emitted[0]["type"] == _ACTIVITY_SNAPSHOT
        assert emitted[0]["message_id"] == "wf-create_campaign"
        assert emitted[0]["activity_type"] == "workflow_progress"
        assert emitted[0]["content"]["title"] == "Creating campaign"


class TestActivityDelta:
    def test_shape(self):
        emitted, writer = _collector()
        emitter = StreamEmitter(writer)
        emitter.activity_delta(
            "wf-create_campaign",
            "workflow_progress",
            [{"op": "replace", "path": "/steps/0/status", "value": "active"}],
        )
        assert emitted[0]["type"] == _ACTIVITY_DELTA
        assert emitted[0]["message_id"] == "wf-create_campaign"
        assert emitted[0]["patch"] == [{"op": "replace", "path": "/steps/0/status", "value": "active"}]
