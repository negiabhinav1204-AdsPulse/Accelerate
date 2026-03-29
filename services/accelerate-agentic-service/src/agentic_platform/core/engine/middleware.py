"""Tool middleware — pre-execution hooks for tool args transformation.

Middlewares transform tool arguments before execution. They receive the
tool name, current args, and LangGraph config (with org_id, user_id, etc.).
Bundled with MCP server definitions in MCPServerConfig.middlewares.

Usage:
    class MyMiddleware(ToolMiddleware):
        def applies_to(self, tool_name: str) -> bool:
            return tool_name in {"execute_sql"}

        async def before_execute(self, tool_name, args, config):
            args = dict(args)
            args["org_id"] = config.get("configurable", {}).get("org_id")
            return args

    # In MCP server definition:
    "my_server": {
        "transport": "sse",
        "url": "...",
        "middlewares": [MyMiddleware()],
    }
"""

from __future__ import annotations

import abc
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.runnables import RunnableConfig


class ToolMiddleware(abc.ABC):
    """Pre-execution hook that transforms tool args."""

    @abc.abstractmethod
    def applies_to(self, tool_name: str) -> bool:
        """Return True if this middleware should run for the given tool."""

    @abc.abstractmethod
    async def before_execute(
        self, tool_name: str, args: dict, config: "RunnableConfig",
    ) -> dict:
        """Transform args before the tool runs. Must return the (possibly modified) args dict."""


async def run_middlewares(
    middlewares: list[ToolMiddleware],
    tool_name: str,
    args: dict,
    config: "RunnableConfig",
) -> dict:
    """Run matching middlewares in order, threading args through each."""
    for mw in middlewares:
        if mw.applies_to(tool_name):
            args = await mw.before_execute(tool_name, args, config)
    return args
