"""Shared MCP server definitions — reusable across agents.

Each entry is a named server config. Agents reference servers by key:

    from src.agentic_platform.app.common.mcp_servers import mcp_server, mcp_servers

    # Single server
    config = AgentConfig(
        mcp_servers=mcp_servers("langchain_docs"),
        ...
    )

    # Multiple servers
    config = AgentConfig(
        mcp_servers=mcp_servers("langchain_docs", "jira"),
        ...
    )

To add a new MCP server, add an entry to MCP_SERVERS below.
Middlewares are bundled with their server — they transform tool args
before execution (e.g. org_id injection for BigQuery data isolation).
"""

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.engine.mcp.bq_middleware import BigQueryOrgFilter

# ── Server definitions ────────────────────────────────────────────
# Each key is a reusable server name. Value is the config dict
# matching MCPServerConfig fields.
#
# Middlewares: pre-execution hooks bundled with the server. They
# transform tool args before the tool runs. Example: BigQueryOrgFilter
# injects organization_id filters into SQL queries for data isolation.

MCP_SERVERS: dict[str, dict] = {
    "langchain_docs": {
        "transport": "http",
        "url": "https://docs.langchain.com/mcp",
        "server_defaults": {
            "tags": ["diagnostics"],
            "thinking_messages": [
                "Searching LangChain docs...",
                "Looking up documentation...",
            ],
            "timeout": 30,
        },
    },

    # BigQuery analytics sidecar (Google MCP Toolbox with --prebuilt=bigquery).
    # Shares network namespace with the agentic-service container → reachable at localhost:5001.
    # Uses SSE transport — the toolbox exposes MCP at /sse.
    # Middleware: BigQueryOrgFilter programmatically injects organization_id
    # filters into every execute_sql call — the LLM cannot be trusted for this.
    "bigquery_analytics": {
        "transport": "sse",
        "url": f"{settings.analytics_mcp_url}/mcp/sse",
        "server_defaults": {
            "tags": ["analytics"],
            "thinking_messages": [
                "Fetching campaign data...",
                "Running analytics query...",
            ],
            "timeout": 60,
            "hitl_policy": "never",
        },
        "middlewares": [BigQueryOrgFilter()],
    },

    # Example — uncomment when ready:
    # "jira": {
    #     "transport": "http",
    #     "url": "http://jira-mcp:8002/mcp",
    #     "server_defaults": {
    #         "tags": ["diagnostics"],
    #         "thinking_messages": ["Checking Jira..."],
    #         "timeout": 45,
    #     },
    #     "tool_manifest": {
    #         "create_jira_issue": {"hitl_policy": "always"},
    #     },
    # },
}


def mcp_server(key: str) -> dict:
    """Get a single MCP server config by key."""
    if key not in MCP_SERVERS:
        available = ", ".join(sorted(MCP_SERVERS.keys()))
        raise KeyError(f"Unknown MCP server '{key}'. Available: {available}")
    return MCP_SERVERS[key]


def mcp_servers(*keys: str) -> dict:
    """Build an mcp_servers config dict from one or more server keys.

    Returns the dict shape expected by AgentConfig.mcp_servers:
        {"servers": {"langchain_docs": {...}, "jira": {...}}}
    """
    return {"servers": {key: mcp_server(key) for key in keys}}
