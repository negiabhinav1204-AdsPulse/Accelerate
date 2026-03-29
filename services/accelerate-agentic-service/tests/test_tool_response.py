"""Tests for ToolResponse.for_llm() — controls what the LLM sees."""

from src.agentic_platform.core.engine.models import ToolResponse, UIBlock


class TestForLLM:
    def test_summary_and_data(self):
        r = ToolResponse(summary="3 campaigns found", data={"count": 3})
        result = r.for_llm()
        assert "3 campaigns found" in result
        assert '"count": 3' in result

    def test_summary_only(self):
        r = ToolResponse(summary="All good")
        assert r.for_llm() == "All good"

    def test_data_only_dict(self):
        r = ToolResponse(data={"x": 1})
        assert r.for_llm() == '{"x": 1}'

    def test_data_only_string(self):
        r = ToolResponse(data="raw text")
        assert r.for_llm() == "raw text"

    def test_nothing(self):
        r = ToolResponse()
        assert r.for_llm() == "Done."

    def test_ui_blocks_not_in_llm_output(self):
        """ui_blocks are never sent to LLM — only summary and data."""
        r = ToolResponse(
            summary="3 campaigns found",
            data=[{"name": "Summer Sale", "spend": 5200}],
            ui_blocks=[UIBlock(type="chart", data={"big": "payload"})],
        )
        result = r.for_llm()
        assert "3 campaigns found" in result
        assert "Summer Sale" in result  # data IS included for follow-ups
        assert "chart" not in result    # ui_blocks never included
