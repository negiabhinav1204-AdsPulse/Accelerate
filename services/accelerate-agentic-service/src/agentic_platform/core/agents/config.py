"""Agent configuration — defines what an agent is.

Each domain creates an AgentConfig with its own prompt, tools, model,
and database config. The platform compiles it into a runnable graph.

Platform-shared (NOT in AgentConfig):
  - Auth (IAM JWT validation)
  - LLM API keys (Anthropic/OpenAI/Google)
  - Service port/host

Domain-specific (IN AgentConfig):
  - System prompt, tools, model
  - Checkpointer DB, persistence DB
  - Langfuse project, context window

Usage:
    # domains/campaigns/agent.py
    config = AgentConfig(
        agent_id="campaign-assistant",
        name="Campaign Assistant",
        system_prompt="You are an advertising...",
        model="anthropic",
        tools=[query_analytics, get_campaign_details],
        checkpointer_db_url="postgresql://...",
        db_service_url="http://...",
    )
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, TYPE_CHECKING

from src.agentic_platform.core.engine.models import AgenticTool
from src.agentic_platform.core.config import MODELS

if TYPE_CHECKING:
    from src.agentic_platform.core.engine.workflow import AgenticWorkflow


@dataclass
class AgentConfig:
    """Everything needed to build and run an agent."""

    # ── Identity ─────────────────────────────────────────────────────
    agent_id: str                    # URL-safe: "campaign-assistant"
    name: str                        # Display: "Campaign Assistant"

    # ── Brain ────────────────────────────────────────────────────────
    system_prompt: str               # Full system prompt
    dynamic_context: Callable[[dict], str] | None = None  # Per-request system prompt additions (receives metadata dict)
    hydrate_context: Callable[..., Any] | None = None  # Per-request async hook: hydrate_context(user) — enriches UserContext before graph runs
    tools: list[AgenticTool] = field(default_factory=list)
    workflows: list[AgenticWorkflow] = field(default_factory=list)
    model: str = "sonnet"            # any name from config.py MODELS

    # ── MCP Servers ──────────────────────────────────────────────────
    mcp_servers: str | dict[str, Any] | None = None
    mcp_result_transformers: dict[str, Callable[[Any, dict[str, Any]], dict[str, Any]]] = field(default_factory=dict)

    # ── Storage ──────────────────────────────────────────────────────
    checkpointer_db_url: str = ""    # Postgres for LangGraph state
    db_service_url: str = ""         # REST API for message persistence

    # ── Observability ────────────────────────────────────────────────
    langfuse_enabled: bool = True
    langfuse_trace_name: str = ""    # e.g. "campaign-chat-agent" (defaults to agent_id)

    def __post_init__(self):
        if not self.agent_id:
            raise ValueError("AgentConfig.agent_id must be set")
        if not self.agent_id.replace("-", "").replace("_", "").isalnum():
            raise ValueError(f"AgentConfig.agent_id must be URL-safe (got '{self.agent_id}')")
        if not self.name:
            raise ValueError("AgentConfig.name must be set")
        if not self.system_prompt:
            raise ValueError("AgentConfig.system_prompt must be set")
        if self.model not in MODELS:
            raise ValueError(
                f"AgentConfig.model '{self.model}' not found. "
                f"Available: {', '.join(MODELS.keys())}"
            )
        if not self.checkpointer_db_url:
            raise ValueError("AgentConfig.checkpointer_db_url must be set")
        if not self.db_service_url:
            raise ValueError("AgentConfig.db_service_url must be set")
        if not self.langfuse_trace_name:
            self.langfuse_trace_name = self.agent_id
