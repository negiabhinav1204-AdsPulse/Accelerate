"""Tests for MCP BaseTool → AgenticTool adapter."""

import pytest
from unittest.mock import MagicMock

from langchain_core.tools import BaseTool

from src.agentic_platform.core.engine.mcp.adapter import wrap_mcp_tool, _resolve_tags
from src.agentic_platform.core.engine.mcp.config import MCPServerConfig, MCPServerDefaults, MCPToolManifest
from src.agentic_platform.core.engine.models import AgenticTool, ToolTag


def _make_base_tool(name: str = "test_tool", description: str = "A test tool") -> BaseTool:
    """Create a mock BaseTool mimicking what MCP servers return."""
    tool = MagicMock(spec=BaseTool)
    tool.name = name
    tool.description = description
    # Make isinstance check work
    tool.__class__ = BaseTool
    return tool


class TestResolveTagS:
    def test_known_tags(self):
        tags = _resolve_tags(["analytics", "campaign_mgmt"])
        assert tags == [ToolTag.ANALYTICS, ToolTag.CAMPAIGN_MGMT]

    def test_unknown_tags_skipped(self):
        tags = _resolve_tags(["analytics", "custom_unknown"])
        assert tags == [ToolTag.ANALYTICS]

    def test_case_insensitive(self):
        tags = _resolve_tags(["ANALYTICS"])
        assert tags == [ToolTag.ANALYTICS]

    def test_empty(self):
        assert _resolve_tags([]) == []


class TestWrapMcpTool:
    def test_uses_manifest_override(self):
        base = _make_base_tool()
        config = MCPServerConfig(
            transport="http",
            url="http://localhost:8001/mcp",
            server_defaults=MCPServerDefaults(tags=["analytics"], timeout=30),
            tool_manifest={
                "test_tool": MCPToolManifest(
                    thinking_messages=["Custom thinking..."],
                    timeout=90,
                    hitl_policy="always",
                ),
            },
        )
        result = wrap_mcp_tool(base, "test_server", config)
        assert isinstance(result, AgenticTool)
        assert result.thinking_messages == ["Custom thinking..."]
        assert result.timeout == 90
        assert result.hitl_policy == "always"

    def test_falls_back_to_server_defaults(self):
        base = _make_base_tool()
        config = MCPServerConfig(
            transport="http",
            url="http://localhost:8001/mcp",
            server_defaults=MCPServerDefaults(
                tags=["diagnostics"],
                thinking_messages=["Server default thinking..."],
                timeout=45,
            ),
        )
        result = wrap_mcp_tool(base, "test_server", config)
        assert result.thinking_messages == ["Server default thinking..."]
        assert result.timeout == 45
        assert result.hitl_policy == "never"
        assert ToolTag.DIAGNOSTICS in result.tags

    def test_adds_description_if_missing(self):
        base = _make_base_tool(description="")
        config = MCPServerConfig(transport="http", url="http://localhost:8001/mcp")
        wrap_mcp_tool(base, "my_server", config)
        assert "my_server" in base.description
