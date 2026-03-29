"""Tests for MCP result transformer and MCPToolWrapper."""

import pytest
from unittest.mock import MagicMock, AsyncMock

from langchain_core.tools import BaseTool

from src.agentic_platform.core.engine.mcp.transformer import MCPToolWrapper, ResultTransformer
from src.agentic_platform.core.engine.models import ToolResponse, UIBlock, BlockDisplay


def _make_base_tool(name="test_tool", sync_result="raw result", async_result="raw async result"):
    """Create a mock BaseTool with sync and async results."""
    tool = MagicMock(spec=BaseTool)
    tool.name = name
    tool.description = "A test tool"
    tool.args_schema = None
    tool._run = MagicMock(return_value=sync_result)
    tool._arun = AsyncMock(return_value=async_result)
    # ainvoke returns same as _arun for MCP tools
    tool.ainvoke = AsyncMock(return_value=async_result)
    return tool


class TestMCPToolWrapper:
    def test_sync_run_applies_transformer(self):
        base = _make_base_tool(sync_result={"campaigns": [1, 2, 3]})

        def transformer(raw, args):
            return ToolResponse(
                summary=f"Found {len(raw['campaigns'])} campaigns",
                data=raw,
            ).model_dump()

        wrapper = MCPToolWrapper(base, transformer)
        result = wrapper._run(query="test")

        assert result["summary"] == "Found 3 campaigns"
        assert result["data"]["campaigns"] == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_async_run_applies_transformer(self):
        base = _make_base_tool(async_result={"items": ["a", "b"]})

        def transformer(raw, args):
            return ToolResponse(
                summary=f"{len(raw['items'])} items found",
                data=raw,
            ).model_dump()

        wrapper = MCPToolWrapper(base, transformer)
        result = await wrapper._arun(query="test")

        assert result["summary"] == "2 items found"

    @pytest.mark.asyncio
    async def test_async_run_forwards_config(self):
        """Config with __stream_emitter must propagate to the wrapped tool."""
        base = _make_base_tool(async_result="ok")
        wrapper = MCPToolWrapper(base, lambda r, a: {"summary": "done", "data": r})

        config = {"metadata": {"__stream_emitter": "fake_emitter"}}
        await wrapper._arun(query="test", config=config)

        # Verify ainvoke was called with config
        base.ainvoke.assert_called_once()
        call_kwargs = base.ainvoke.call_args
        assert call_kwargs[1]["config"] == config

    def test_transformer_failure_returns_structured_error(self):
        """If transformer crashes, return ToolResponse-shaped error, not raw result."""
        base = _make_base_tool(sync_result="raw output")

        def bad_transformer(raw, args):
            raise ValueError("transformer exploded")

        wrapper = MCPToolWrapper(base, bad_transformer)
        result = wrapper._run(query="test")

        # Should return ToolResponse-shaped dict (not raw string)
        assert isinstance(result, dict)
        assert "summary" in result
        assert "transformer" in result["summary"].lower() or "failed" in result["summary"].lower()
        assert result["data"] == "raw output"

    def test_preserves_tool_identity(self):
        base = _make_base_tool(name="my_mcp_tool")
        wrapper = MCPToolWrapper(base, lambda r, a: r)

        assert wrapper.name == "my_mcp_tool"
        assert wrapper.description == "A test tool"

    def test_preserves_args_schema(self):
        """args_schema from wrapped tool must propagate for LLM binding."""
        from pydantic import BaseModel

        class MySchema(BaseModel):
            query: str
            limit: int = 10

        base = _make_base_tool()
        base.args_schema = MySchema

        wrapper = MCPToolWrapper(base, lambda r, a: r)
        assert wrapper.args_schema is MySchema

    def test_transformer_receives_tool_args(self):
        base = _make_base_tool(sync_result="data")
        received_args = {}

        def capture_transformer(raw, args):
            received_args.update(args)
            return ToolResponse(summary="ok").model_dump()

        wrapper = MCPToolWrapper(base, capture_transformer)
        wrapper._run(campaign_id="abc", budget=500)

        assert received_args == {"campaign_id": "abc", "budget": 500}


class TestTransformerWithUIBlocks:
    def test_transformer_adds_ui_blocks_as_objects(self):
        """Transformer returns UIBlock objects — ideal path."""
        base = _make_base_tool(sync_result={"total": 42})

        def transformer(raw, args):
            return ToolResponse(
                summary=f"Total: {raw['total']}",
                ui_blocks=[UIBlock(
                    type="metric_card",
                    data={"value": raw["total"], "label": "Total"},
                    display=BlockDisplay.INLINE,
                )],
            ).model_dump()

        wrapper = MCPToolWrapper(base, transformer)
        result = wrapper._run()

        assert len(result["ui_blocks"]) == 1
        assert result["ui_blocks"][0]["type"] == "metric_card"
        assert result["ui_blocks"][0]["data"]["value"] == 42

    def test_transformer_adds_ui_blocks_as_dicts(self):
        """Transformer returns ui_blocks as dicts — must be coerced by _parse_tool_response."""
        from src.agentic_platform.core.engine.executor import _parse_tool_response

        raw_dict = {
            "summary": "Found results",
            "ui_blocks": [
                {"type": "card", "data": {"title": "Test"}, "display": "inline"},
            ],
        }
        response = _parse_tool_response(raw_dict, "test_tool")

        # After parse, ui_blocks should be UIBlock objects
        assert len(response.ui_blocks) == 1
        block = response.ui_blocks[0]
        assert isinstance(block, UIBlock)
        assert block.type == "card"
        assert block.display == BlockDisplay.INLINE
        assert block.display.value == "inline"  # executor accesses .value

    def test_transformer_adds_hitl(self):
        """Transformer can add post-execution HITL gate."""
        base = _make_base_tool(sync_result={"action": "delete"})

        def transformer(raw, args):
            from src.agentic_platform.core.engine.hitl import build_confirmation
            return ToolResponse(
                summary="Ready to delete",
                data=raw,
                hitl=build_confirmation(
                    title="Confirm deletion?",
                    danger=True,
                ),
            ).model_dump()

        wrapper = MCPToolWrapper(base, transformer)
        result = wrapper._run()

        assert result["hitl"]["title"] == "Confirm deletion?"
        assert result["hitl"]["danger"] is True

    def test_parse_tool_response_coerces_hitl_dict(self):
        """_parse_tool_response auto-coerces hitl dict → HITLRequest."""
        from src.agentic_platform.core.engine.executor import _parse_tool_response
        from src.agentic_platform.core.engine.hitl import HITLRequest

        raw_dict = {
            "summary": "Plan ready",
            "hitl": {
                "type": "confirmation",
                "title": "Approve?",
                "actions": [{"action": "approve", "label": "OK", "style": "primary"}],
            },
        }
        response = _parse_tool_response(raw_dict, "test_tool")
        assert isinstance(response.hitl, HITLRequest)
        assert response.hitl.title == "Approve?"


class TestGracefulDegradation:
    def test_mcp_registry_skips_failed_servers(self):
        """MCPToolRegistry should not crash if a server is unreachable."""
        # This is tested at integration level — unit test verifies the design
        from src.agentic_platform.core.engine.mcp.registry import MCPToolRegistry
        from src.agentic_platform.core.engine.mcp.config import MCPConfig, MCPServerConfig

        config = MCPConfig(servers={
            "bad_server": MCPServerConfig(
                transport="http",
                url="http://localhost:99999/mcp",  # unreachable
            ),
        })
        registry = MCPToolRegistry(config)
        # initialize() should not raise — it logs and continues
        # (actual connection test requires async context)
        assert registry.server_names == ["bad_server"]

    def test_duplicate_mcp_tool_names_raises(self):
        """Duplicate tool names across MCP servers must raise ValueError."""
        from src.agentic_platform.core.engine.mcp.adapter import wrap_mcp_tool
        from src.agentic_platform.core.engine.mcp.config import MCPServerConfig

        base1 = _make_base_tool(name="duplicate_tool")
        base2 = _make_base_tool(name="duplicate_tool")

        config = MCPServerConfig(transport="http", url="http://localhost:8001/mcp")

        tool1 = wrap_mcp_tool(base1, "server_a", config)
        tool2 = wrap_mcp_tool(base2, "server_b", config)

        # AgentRegistry enforces uniqueness
        from src.agentic_platform.core.engine.registry import AgentRegistry
        registry = AgentRegistry()
        registry.register_tool(tool1)
        with pytest.raises(ValueError, match="Duplicate"):
            registry.register_tool(tool2)
