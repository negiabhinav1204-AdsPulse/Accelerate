"""Result transformers — bridge MCP tool output to ToolResponse.

MCP servers return plain strings or dicts. Result transformers convert
these into ToolResponse with UI blocks, HITL gates, and structured data.

Without a transformer:
    MCP result "Found 3 campaigns" -> ToolResponse(data="Found 3 campaigns")

With a transformer:
    MCP result {"campaigns": [...]} -> ToolResponse(
        summary="Found 3 campaigns",
        data={...},
        ui_blocks=[campaign_overview.create(...)],
        hitl=build_confirmation("Apply changes?") if destructive,
    )

Transformers are registered per tool name and applied automatically
by MCPToolWrapper during execution.

Usage:
    # In domains/<domain>/mcp_transformers.py
    from src.agentic_platform.core.engine.mcp.transformer import ResultTransformer

    def transform_campaign_metrics(raw_result: Any, tool_args: dict) -> dict:
        data = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
        return ToolResponse(
            summary=f"Found {len(data['campaigns'])} campaigns",
            data=data,
            ui_blocks=[campaign_overview.create(CampaignOverviewData(**data))],
        ).model_dump()

    # Register when building agent config
    mcp_result_transformers={
        "get_campaign_metrics": transform_campaign_metrics,
    }
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Type

from pydantic import BaseModel

from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)

# Type alias for transformer functions.
# Takes (raw_result, tool_args) -> dict (ToolResponse.model_dump() shape)
ResultTransformer = Callable[[Any, dict[str, Any]], dict[str, Any]]


class MCPToolWrapper(BaseTool):
    """Wraps an MCP BaseTool with a result transformer.

    Intercepts the tool's return value and runs it through a transformer
    function that converts it to ToolResponse format. The executor's
    _parse_tool_response() then picks up the ToolResponse fields
    (summary, data, ui_blocks, hitl) automatically.

    This is a BaseTool subclass so it satisfies AgenticTool.func type check.
    """

    name: str = ""
    description: str = ""
    args_schema: Type[BaseModel] | None = None
    wrapped_tool: BaseTool = None
    transformer: ResultTransformer = None

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, wrapped_tool: BaseTool, transformer: ResultTransformer):
        # Extract args_schema BEFORE super().__init__() so LLM binding
        # sees the correct schema from the wrapped MCP tool.
        schema = getattr(wrapped_tool, "args_schema", None)
        if schema is not None and not (isinstance(schema, type) and issubclass(schema, BaseModel)):
            schema = None

        super().__init__(
            name=wrapped_tool.name,
            description=wrapped_tool.description,
            args_schema=schema,
            wrapped_tool=wrapped_tool,
            transformer=transformer,
        )

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        """Sync execution with transform."""
        raw = self.wrapped_tool._run(*args, **kwargs)
        return self._apply_transform(raw, kwargs)

    async def _arun(self, *args: Any, **kwargs: Any) -> Any:
        """Async execution with transform."""
        config = kwargs.pop("config", None)

        if config:
            raw = await self.wrapped_tool.ainvoke(kwargs, config=config)
        else:
            raw = await self.wrapped_tool.ainvoke(kwargs)

        return self._apply_transform(raw, kwargs)

    def _apply_transform(self, raw_result: Any, tool_args: dict) -> Any:
        """Apply the transformer, returning structured error on failure."""
        try:
            return self.transformer(raw_result, tool_args)
        except Exception as e:
            logger.error(
                "Result transformer failed for tool '%s': %s — wrapping raw result",
                self.name, e,
            )
            return {
                "summary": f"Tool completed but result formatting failed: {e}",
                "data": raw_result,
            }
