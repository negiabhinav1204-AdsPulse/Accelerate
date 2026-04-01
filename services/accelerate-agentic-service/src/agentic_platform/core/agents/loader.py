"""Agent loader — compiles all agents at startup.

Each agent gets its own:
  - Compiled ReAct graph (tools bound at build time)
  - Postgres checkpointer (isolated state per agent)
  - Persistence client (can point to different db-service instances)
  - MCP tool connections (if configured)

Usage in server.py:
    agents = await load_all_agents(configs=[campaign_config, ...])
    # agents["campaign-assistant"].graph, .persistence, .config
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.engine.registry import AgentRegistry
from src.agentic_platform.core.llm import get_llm
from typing import Any as _Any

logger = logging.getLogger(__name__)


@dataclass
class LoadedAgent:
    """A fully initialized agent — graph + persistence + config.

    persistence is set by the API layer (e.g. api/server.py lifespan)
    after loading, since it is chat/transport-specific.
    """
    config: AgentConfig
    graph: CompiledStateGraph
    persistence: _Any = None
    checkpointer: AsyncPostgresSaver = None
    _checkpointer_ctx: object = None  # context manager for cleanup
    _mcp_registry: Any = None         # MCPToolRegistry for cleanup


async def _load_mcp_tools(config: AgentConfig) -> tuple[list, Any]:
    """Load MCP tools for an agent if configured.

    Returns:
        (list[AgenticTool], MCPToolRegistry | None)
    """
    if not config.mcp_servers:
        return [], None

    from src.agentic_platform.core.engine.mcp import MCPToolRegistry

    transformers = config.mcp_result_transformers or None

    if isinstance(config.mcp_servers, str):
        registry = MCPToolRegistry.from_yaml(config.mcp_servers, transformers=transformers)
    else:
        registry = MCPToolRegistry.from_dict(config.mcp_servers, transformers=transformers)

    await registry.initialize()
    tools = registry.get_tools()

    logger.info(
        "Agent '%s': loaded %d MCP tools from servers %s",
        config.agent_id, len(tools), registry.server_names,
    )
    return tools, registry


def _compile_graph(config: AgentConfig, checkpointer, mcp_tools=None, mcp_middlewares=None) -> CompiledStateGraph:
    """Compile an AgentConfig into a runnable graph."""
    registry = AgentRegistry(
        system_prompt=config.system_prompt,
        dynamic_context=config.dynamic_context,
        middlewares=mcp_middlewares or [],
    )

    # Register native tools
    for tool in config.tools:
        registry.register_tool(tool)

    # Register MCP tools (same interface — AgenticTool)
    if mcp_tools:
        for tool in mcp_tools:
            registry.register_tool(tool)

    for workflow in config.workflows:
        registry.register_workflow(workflow)
    llm = get_llm(config.model)
    return registry.build_graph(llm, checkpointer)


async def load_all_agents(configs: list[AgentConfig]) -> dict[str, LoadedAgent]:
    """Validate and compile all agents from the provided configs.

    Each agent gets its own checkpointer connection and persistence client.
    Returns {agent_id: LoadedAgent}.
    """
    agents: dict[str, LoadedAgent] = {}

    # Validate no duplicate IDs
    seen: set[str] = set()
    for c in configs:
        if c.agent_id in seen:
            raise ValueError(f"Duplicate agent_id: '{c.agent_id}'")
        seen.add(c.agent_id)

    # Compile each agent with its own DB connections
    for config in configs:
        # Use a connection pool with short lifetimes so Neon serverless
        # connection kills don't leave stale connections in the pool.
        pool = AsyncConnectionPool(
            conninfo=config.checkpointer_db_url,
            kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
            min_size=1,
            max_size=5,
            max_lifetime=60,    # recycle connections every 60s
            max_idle=30,        # drop idle connections after 30s
            open=False,
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(conn=pool)
        await checkpointer.setup()
        checkpointer_ctx = pool  # store for cleanup

        # Load MCP tools and their middlewares if configured
        mcp_tools, mcp_registry = await _load_mcp_tools(config)
        mcp_middlewares = mcp_registry.middlewares if mcp_registry else []

        graph = _compile_graph(config, checkpointer, mcp_tools=mcp_tools, mcp_middlewares=mcp_middlewares)

        total_tools = len(config.tools) + len(mcp_tools)
        agents[config.agent_id] = LoadedAgent(
            config=config,
            graph=graph,
            checkpointer=checkpointer,
            _checkpointer_ctx=checkpointer_ctx,
            _mcp_registry=mcp_registry,
        )

        mcp_info = f", {len(mcp_tools)} MCP tools" if mcp_tools else ""
        logger.info(
            "Loaded agent: %s (%s, %d tools%s, model=%s)",
            config.agent_id, config.name, total_tools, mcp_info, config.model,
        )

    return agents


async def cleanup_agents(agents: dict[str, LoadedAgent]) -> None:
    """Close all agent checkpointer and MCP connections."""
    for agent in agents.values():
        # Cleanup MCP connections
        if agent._mcp_registry:
            try:
                await agent._mcp_registry.cleanup()
            except Exception:
                pass
        # Cleanup checkpointer pool
        if agent._checkpointer_ctx:
            try:
                await agent._checkpointer_ctx.close()
            except Exception:
                pass
