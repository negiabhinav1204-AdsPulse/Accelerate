"""Tests for MCP config models."""

import pytest
import tempfile
from pathlib import Path

from src.agentic_platform.core.engine.mcp.config import (
    MCPConfig,
    MCPServerConfig,
    MCPServerDefaults,
    MCPToolManifest,
    MCPTransport,
)


class TestMCPServerConfig:
    def test_http_transport_requires_url(self):
        with pytest.raises(ValueError, match="requires 'url'"):
            MCPServerConfig(transport="http")

    def test_stdio_transport_requires_command(self):
        with pytest.raises(ValueError, match="requires 'command'"):
            MCPServerConfig(transport="stdio")

    def test_http_transport_valid(self):
        config = MCPServerConfig(transport="http", url="http://localhost:8001/mcp")
        assert config.transport == MCPTransport.HTTP
        assert config.url == "http://localhost:8001/mcp"

    def test_stdio_transport_valid(self):
        config = MCPServerConfig(transport="stdio", command="npx", args=["-y", "server"])
        assert config.transport == MCPTransport.STDIO
        assert config.command == "npx"
        assert config.args == ["-y", "server"]

    def test_server_defaults_from_dict(self):
        config = MCPServerConfig(
            transport="http",
            url="http://localhost:8001/mcp",
            server_defaults={"tags": ["analytics"], "timeout": 60},
        )
        assert isinstance(config.server_defaults, MCPServerDefaults)
        assert config.server_defaults.tags == ["analytics"]
        assert config.server_defaults.timeout == 60

    def test_tool_manifest_from_dict(self):
        config = MCPServerConfig(
            transport="http",
            url="http://localhost:8001/mcp",
            tool_manifest={
                "pause_campaign": {"hitl_policy": "always", "timeout": 90},
            },
        )
        manifest = config.tool_manifest["pause_campaign"]
        assert isinstance(manifest, MCPToolManifest)
        assert manifest.hitl_policy == "always"
        assert manifest.timeout == 90


class TestMCPConfig:
    def test_from_yaml(self):
        yaml_content = """
servers:
  test_server:
    transport: http
    url: http://localhost:8001/mcp
    server_defaults:
      tags: [analytics]
      timeout: 45
    tool_manifest:
      my_tool:
        hitl_policy: always
        thinking_messages:
          - "Working..."
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(yaml_content)
            f.flush()
            config = MCPConfig.from_yaml(f.name)

        assert "test_server" in config.servers
        server = config.servers["test_server"]
        assert server.transport == MCPTransport.HTTP
        assert server.url == "http://localhost:8001/mcp"
        assert server.server_defaults.tags == ["analytics"]
        assert server.server_defaults.timeout == 45
        assert "my_tool" in server.tool_manifest
        assert server.tool_manifest["my_tool"].hitl_policy == "always"

    def test_from_dict(self):
        data = {
            "servers": {
                "test": {
                    "transport": "sse",
                    "url": "http://localhost:8002/sse",
                    "server_defaults": {"tags": ["diagnostics"]},
                }
            }
        }
        config = MCPConfig.from_dict(data)
        assert config.servers["test"].transport == MCPTransport.SSE

    def test_from_yaml_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            MCPConfig.from_yaml("/nonexistent/path.yaml")
