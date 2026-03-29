"""Tests for agentic platform Settings (config.py)."""

import pytest
from unittest.mock import patch


class TestSettingsDefaults:
    def test_analytics_mcp_url_default(self):
        """analytics_mcp_url defaults to localhost sidecar address."""
        with patch.dict("os.environ", {}, clear=False):
            # Re-instantiate Settings to pick up clean env
            from src.agentic_platform.core.config import Settings
            s = Settings()
        assert s.analytics_mcp_url == "http://localhost:5001"

    def test_bigquery_project_default(self):
        from src.agentic_platform.core.config import Settings
        s = Settings()
        assert s.bigquery_project == "accelerate-nonprod-4e59"

    def test_bigquery_dataset_default(self):
        from src.agentic_platform.core.config import Settings
        s = Settings()
        assert s.bigquery_dataset == "accelerate_ingestion_store"

    def test_analytics_mcp_url_override(self):
        """ANALYTICS_MCP_URL env var overrides the default."""
        with patch.dict("os.environ", {"ANALYTICS_MCP_URL": "http://mcp-sidecar:5001"}):
            from src.agentic_platform.core.config import Settings
            s = Settings()
        assert s.analytics_mcp_url == "http://mcp-sidecar:5001"
