"""MCP BaseTool -> AgenticTool adapter.

Wraps a plain LangChain BaseTool (from an MCP server) into an AgenticTool
with full platform metadata. If a result transformer is registered for the
tool, it wraps the BaseTool in MCPToolWrapper first so raw MCP output gets
converted to ToolResponse with UI blocks, HITL, etc.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from langchain_core.tools import BaseTool

from src.agentic_platform.core.engine.models import AgenticTool, ToolTag, DEFAULT_THINKING_MESSAGES
from src.agentic_platform.core.engine.mcp.transformer import ResultTransformer, MCPToolWrapper

if TYPE_CHECKING:
    from src.agentic_platform.core.engine.mcp.config import MCPServerConfig, MCPToolManifest

logger = logging.getLogger(__name__)

# Map string tags from YAML to ToolTag enum values.
# Unknown tags are logged and skipped — allows MCP servers to define
# domain-specific tags without breaking the platform.
_TAG_MAP: dict[str, ToolTag] = {t.value: t for t in ToolTag}


def _resolve_tags(tag_strings: list[str]) -> list[ToolTag]:
    """Convert string tags to ToolTag enums, skipping unknowns."""
    tags = []
    for s in tag_strings:
        tag = _TAG_MAP.get(s.lower())
        if tag:
            tags.append(tag)
        else:
            logger.debug("Unknown ToolTag '%s' from MCP manifest — skipped", s)
    return tags


def wrap_mcp_tool(
    base_tool: BaseTool,
    server_name: str,
    server_config: MCPServerConfig,
    transformers: dict[str, ResultTransformer] | None = None,
) -> AgenticTool:
    """Wrap an MCP BaseTool as an AgenticTool using manifest metadata.

    Resolution order for each field:
      1. tool_manifest[tool_name] (per-tool override)
      2. server_defaults (server-wide fallback)
      3. hardcoded defaults (from AgenticTool)

    If a result transformer is registered for this tool, the BaseTool is
    wrapped in MCPToolWrapper so raw MCP output gets converted to
    ToolResponse format (with UI blocks, HITL, structured data).

    Args:
        base_tool: LangChain BaseTool from MCP server
        server_name: Name of the MCP server (for logging)
        server_config: Server config with defaults and manifest
        transformers: Optional dict of tool_name -> ResultTransformer

    Returns:
        AgenticTool ready for registration
    """
    tool_name = base_tool.name
    manifest = server_config.tool_manifest.get(tool_name)
    defaults = server_config.server_defaults

    # Resolve each field: manifest -> defaults -> hardcoded
    thinking_messages = (
        (manifest.thinking_messages if manifest and manifest.thinking_messages else None)
        or defaults.thinking_messages
        or list(DEFAULT_THINKING_MESSAGES)
    )

    tag_strings = (
        (manifest.tags if manifest and manifest.tags else None)
        or defaults.tags
        or []
    )
    tags = _resolve_tags(tag_strings)

    timeout = (
        (manifest.timeout if manifest and manifest.timeout else None)
        or defaults.timeout
        or 30
    )

    hitl_policy = (
        (manifest.hitl_policy if manifest and manifest.hitl_policy else None)
        or defaults.hitl_policy
        or "never"
    )

    # Ensure BaseTool has a description (MCP tools should, but guard against it)
    if not base_tool.description:
        base_tool.description = f"MCP tool '{tool_name}' from server '{server_name}'"

    # Apply result transformer if registered for this tool
    func = base_tool
    if transformers and tool_name in transformers:
        func = MCPToolWrapper(base_tool, transformers[tool_name])
        logger.info("Applied result transformer to MCP tool: %s", tool_name)

    agentic_tool = AgenticTool(
        func=func,
        thinking_messages=thinking_messages,
        tags=tags,
        timeout=timeout,
        hitl_policy=hitl_policy,
    )

    logger.info(
        "Wrapped MCP tool: %s (server=%s, tags=%s, hitl=%s, timeout=%ds)",
        tool_name, server_name, [t.value for t in tags], hitl_policy, timeout,
    )
    return agentic_tool
