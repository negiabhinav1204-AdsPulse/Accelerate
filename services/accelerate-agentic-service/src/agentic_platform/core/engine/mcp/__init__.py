"""MCP Tool Registry — bridges MCP servers with the AgenticTool framework.

MCP tools arrive as plain LangChain BaseTool. This module wraps them as
AgenticTool with full platform metadata (thinking messages, HITL, tags,
timeouts) driven by YAML config. The result: MCP tools get streaming,
HITL gates, UI blocks, and everything else — identical to native tools.

Usage:
    registry = MCPToolRegistry.from_yaml("mcp_servers.yaml")
    tools = await registry.get_tools(tags=["campaigns"])
    # Returns list[AgenticTool] — plug into AgentConfig.tools
"""

from src.agentic_platform.core.engine.mcp.config import (
    MCPServerConfig,
    MCPToolManifest,
    MCPConfig,
)
from src.agentic_platform.core.engine.mcp.adapter import wrap_mcp_tool
from src.agentic_platform.core.engine.mcp.registry import MCPToolRegistry
from src.agentic_platform.core.engine.mcp.transformer import ResultTransformer, MCPToolWrapper

__all__ = [
    "MCPServerConfig",
    "MCPToolManifest",
    "MCPConfig",
    "MCPToolRegistry",
    "MCPToolWrapper",
    "ResultTransformer",
    "wrap_mcp_tool",
]
