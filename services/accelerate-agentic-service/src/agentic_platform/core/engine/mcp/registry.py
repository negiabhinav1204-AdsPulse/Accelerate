"""MCP Tool Registry — connects to MCP servers, returns AgenticTool[].

Manages MCP server connections and wraps discovered tools as AgenticTool
instances using metadata from the YAML manifest. Tools are cached per
server — multiple agents can share the same MCP server connection.

Lifecycle:
    registry = MCPToolRegistry(config)
    await registry.initialize()          # Connect to all servers
    tools = registry.get_tools()         # Get wrapped AgenticTool[]
    tools = registry.get_tools(servers=["campaign_tools"])  # Filter by server
    tools = registry.get_tools(tool_names=["pause_campaign"])  # Filter by name
    await registry.cleanup()             # Disconnect all servers

Integration with agent loader:
    The loader creates one MCPToolRegistry per agent (or shares one globally),
    calls initialize() at startup, and cleanup() at shutdown.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool

from src.agentic_platform.core.engine.models import AgenticTool
from src.agentic_platform.core.engine.mcp.config import MCPConfig, MCPServerConfig, MCPTransport
from src.agentic_platform.core.engine.mcp.adapter import wrap_mcp_tool
from src.agentic_platform.core.engine.mcp.transformer import ResultTransformer

logger = logging.getLogger(__name__)


class MCPToolRegistry:
    """Connects to MCP servers and provides AgenticTool[] from discovered tools.

    Each MCP server connection yields a list of BaseTool. These are wrapped
    as AgenticTool using the manifest metadata from config. The result is
    indistinguishable from native tools — same interface, same features.
    """

    def __init__(
        self,
        config: MCPConfig,
        transformers: dict[str, ResultTransformer] | None = None,
    ):
        self._config = config
        self._transformers = transformers or {}
        self._tools: dict[str, AgenticTool] = {}  # tool_name -> AgenticTool
        self._tool_servers: dict[str, str] = {}    # tool_name -> server_name
        self._clients: dict[str, Any] = {}         # server_name -> MCP client
        self._middlewares: list = []                # collected from all servers
        self._initialized = False

    @classmethod
    def from_yaml(
        cls,
        path: str | Path,
        transformers: dict[str, ResultTransformer] | None = None,
    ) -> MCPToolRegistry:
        """Create registry from a YAML config file."""
        config = MCPConfig.from_yaml(path)
        return cls(config, transformers=transformers)

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
        transformers: dict[str, ResultTransformer] | None = None,
    ) -> MCPToolRegistry:
        """Create registry from a config dict."""
        config = MCPConfig.from_dict(data)
        return cls(config, transformers=transformers)

    async def initialize(self) -> None:
        """Connect to all configured MCP servers and discover tools."""
        if self._initialized:
            return

        failed_servers: list[str] = []

        for server_name, server_config in self._config.servers.items():
            # Collect middlewares from server config
            if server_config.middlewares:
                self._middlewares.extend(server_config.middlewares)

            try:
                tools = await self._connect_server(server_name, server_config)
                for base_tool in tools:
                    if base_tool.name in self._tools:
                        raise ValueError(
                            f"Duplicate MCP tool name '{base_tool.name}' — "
                            f"server '{server_name}' conflicts with "
                            f"server '{self._tool_servers[base_tool.name]}'. "
                            f"Rename the tool in one of the MCP servers."
                        )

                    agentic_tool = wrap_mcp_tool(
                        base_tool, server_name, server_config,
                        transformers=self._transformers,
                    )
                    self._tools[agentic_tool.name] = agentic_tool
                    self._tool_servers[agentic_tool.name] = server_name

                logger.info(
                    "MCP server '%s': %d tools loaded",
                    server_name, len(tools),
                )
            except Exception as e:
                logger.error(
                    "Failed to connect to MCP server '%s': %s — "
                    "agent will start without tools from this server",
                    server_name, e,
                )
                failed_servers.append(server_name)

        self._initialized = True

        connected = len(self._config.servers) - len(failed_servers)
        logger.info(
            "MCP registry initialized: %d tools from %d/%d servers%s",
            len(self._tools), connected, len(self._config.servers),
            f" (failed: {failed_servers})" if failed_servers else "",
        )

    async def _connect_server(
        self, server_name: str, config: MCPServerConfig,
    ) -> list[BaseTool]:
        """Connect to a single MCP server and return its tools as BaseTool[]."""
        from langchain_mcp_adapters.client import MultiServerMCPClient

        # Build connection config for langchain-mcp-adapters
        if config.transport == MCPTransport.STDIO:
            connection: dict[str, Any] = {
                "transport": "stdio",
                "command": config.command,
                "args": config.args,
                **({"env": config.env} if config.env else {}),
            }
        else:
            transport = "sse" if config.transport == MCPTransport.SSE else "http"
            connection = {
                "transport": transport,
                "url": config.url,
                **({"headers": config.headers} if config.headers else {}),
            }

        client = MultiServerMCPClient({server_name: connection})
        self._clients[server_name] = client

        tools = await client.get_tools()
        return tools

    def get_tools(
        self,
        *,
        servers: list[str] | None = None,
        tool_names: list[str] | None = None,
    ) -> list[AgenticTool]:
        """Get wrapped AgenticTool instances, optionally filtered."""
        if not self._initialized:
            raise RuntimeError("MCPToolRegistry not initialized. Call await registry.initialize() first.")

        tools = list(self._tools.values())

        if servers:
            server_set = set(servers)
            tools = [t for t in tools if self._tool_servers.get(t.name) in server_set]

        if tool_names:
            name_set = set(tool_names)
            tools = [t for t in tools if t.name in name_set]

        return tools

    @property
    def tool_names(self) -> list[str]:
        """List all discovered tool names."""
        return list(self._tools.keys())

    @property
    def server_names(self) -> list[str]:
        """List all configured server names."""
        return list(self._config.servers.keys())

    @property
    def middlewares(self) -> list:
        """All middlewares collected from MCP server configs."""
        return list(self._middlewares)

    async def cleanup(self) -> None:
        """Disconnect from all MCP servers."""
        for server_name, client in self._clients.items():
            try:
                if hasattr(client, "close"):
                    await client.close()
                logger.info("Cleaned up MCP server: %s", server_name)
            except Exception as e:
                logger.warning("Error cleaning up MCP server '%s': %s", server_name, e)
        self._clients.clear()
        self._tools.clear()
        self._tool_servers.clear()
        self._initialized = False
