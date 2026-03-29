"""YAML configuration models for MCP server connections and tool manifests.

Each MCP server entry defines:
  - Connection: transport type, URL, headers
  - Server defaults: fallback metadata for all tools from this server
  - Tool manifest: per-tool metadata overrides

Example YAML:
    servers:
      campaign_tools:
        transport: http
        url: http://campaign-service:8001/mcp
        server_defaults:
          tags: [campaigns]
          timeout: 30
        tool_manifest:
          pause_campaign:
            hitl_policy: always
            thinking_messages: ["Preparing to pause campaign..."]
            timeout: 60
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from src.agentic_platform.core.engine.middleware import ToolMiddleware


class MCPTransport(str, Enum):
    """Supported MCP transport types."""
    HTTP = "http"
    STREAMABLE_HTTP = "streamable_http"
    SSE = "sse"
    STDIO = "stdio"


@dataclass
class MCPToolManifest:
    """Per-tool metadata override from YAML manifest.

    Any field set here overrides the server_defaults for this specific tool.
    Fields left as None fall back to server_defaults.
    """
    thinking_messages: list[str] | None = None
    tags: list[str] | None = None
    timeout: int | None = None
    hitl_policy: str | None = None  # "never" | "always"


@dataclass
class MCPServerDefaults:
    """Default metadata applied to ALL tools from this server.

    Individual tools can override any of these in tool_manifest.
    """
    tags: list[str] = field(default_factory=list)
    thinking_messages: list[str] = field(default_factory=lambda: [
        "Calling external service...",
        "Working on it...",
    ])
    timeout: int = 30
    hitl_policy: str = "never"


@dataclass
class MCPServerConfig:
    """Configuration for a single MCP server connection."""
    # Connection
    transport: MCPTransport = MCPTransport.STREAMABLE_HTTP
    url: str = ""
    command: str = ""           # for stdio transport
    args: list[str] = field(default_factory=list)  # for stdio transport
    env: dict[str, str] = field(default_factory=dict)  # for stdio transport
    headers: dict[str, str] = field(default_factory=dict)

    # Metadata
    server_defaults: MCPServerDefaults = field(default_factory=MCPServerDefaults)
    tool_manifest: dict[str, MCPToolManifest] = field(default_factory=dict)

    # Pre-execution middlewares for tools from this server.
    # Middlewares transform tool args before execution (e.g. inject org_id
    # filters into SQL queries). They receive tool name, args, and LangGraph
    # config. Set programmatically — not serialized to/from YAML.
    middlewares: list[ToolMiddleware] = field(default_factory=list)

    def __post_init__(self):
        if isinstance(self.transport, str):
            self.transport = MCPTransport(self.transport)
        if isinstance(self.server_defaults, dict):
            self.server_defaults = MCPServerDefaults(**self.server_defaults)
        if self.tool_manifest:
            self.tool_manifest = {
                name: MCPToolManifest(**entry) if isinstance(entry, dict) else entry
                for name, entry in self.tool_manifest.items()
            }
        # Validate transport-specific requirements
        if self.transport == MCPTransport.STDIO:
            if not self.command:
                raise ValueError("MCPServerConfig: stdio transport requires 'command'")
        else:
            if not self.url:
                raise ValueError(f"MCPServerConfig: {self.transport.value} transport requires 'url'")


@dataclass
class MCPConfig:
    """Top-level MCP configuration — all servers."""
    servers: dict[str, MCPServerConfig] = field(default_factory=dict)

    @classmethod
    def from_yaml(cls, path: str | Path) -> MCPConfig:
        """Load MCP config from a YAML file."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"MCP config file not found: {path}")

        with open(path) as f:
            raw = yaml.safe_load(f) or {}

        servers = {}
        for name, server_data in raw.get("servers", {}).items():
            servers[name] = MCPServerConfig(**server_data)

        return cls(servers=servers)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MCPConfig:
        """Load MCP config from a dict (for inline AgentConfig usage)."""
        servers = {}
        for name, server_data in data.get("servers", {}).items():
            if isinstance(server_data, dict):
                servers[name] = MCPServerConfig(**server_data)
            else:
                servers[name] = server_data
        return cls(servers=servers)
