"""Tests for shared MCP server definitions (domains/common/mcp_servers.py)."""

import pytest

from src.agentic_platform.app.common.mcp_servers import MCP_SERVERS, mcp_server, mcp_servers


class TestMCPServersRegistry:
    def test_bigquery_analytics_registered(self):
        """bigquery_analytics server must be present in MCP_SERVERS."""
        assert "bigquery_analytics" in MCP_SERVERS

    def test_bigquery_analytics_transport(self):
        assert MCP_SERVERS["bigquery_analytics"]["transport"] == "sse"

    def test_bigquery_analytics_url_is_string(self):
        """URL is evaluated from settings at import time — must be a non-empty string."""
        url = MCP_SERVERS["bigquery_analytics"]["url"]
        assert isinstance(url, str)
        assert url  # non-empty

    def test_bigquery_analytics_default_url(self):
        """Default URL points to the localhost sidecar."""
        url = MCP_SERVERS["bigquery_analytics"]["url"]
        assert "5001" in url

    def test_bigquery_analytics_thinking_messages(self):
        defaults = MCP_SERVERS["bigquery_analytics"]["server_defaults"]
        assert "Fetching campaign data..." in defaults["thinking_messages"]

    def test_bigquery_analytics_timeout(self):
        defaults = MCP_SERVERS["bigquery_analytics"]["server_defaults"]
        assert defaults["timeout"] == 60

    def test_bigquery_analytics_hitl_policy(self):
        defaults = MCP_SERVERS["bigquery_analytics"]["server_defaults"]
        assert defaults["hitl_policy"] == "never"


class TestMCPServersHelper:
    def test_mcp_servers_bigquery_analytics(self):
        """mcp_servers() returns the correct shape for bigquery_analytics."""
        result = mcp_servers("bigquery_analytics")
        assert "servers" in result
        assert "bigquery_analytics" in result["servers"]

    def test_mcp_servers_multiple_including_bigquery(self):
        """mcp_servers() with multiple keys includes all requested servers."""
        result = mcp_servers("langchain_docs", "bigquery_analytics")
        assert "langchain_docs" in result["servers"]
        assert "bigquery_analytics" in result["servers"]

    def test_mcp_servers_unknown_key_raises(self):
        with pytest.raises(KeyError, match="Unknown MCP server"):
            mcp_servers("nonexistent_server")
