"""Generic graph execution — no AG-UI, no SSE, no chat persistence.

Exposes raw LangGraph execution as an async iterator. The API layer
decides how to project, accumulate, and stream events.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator, TYPE_CHECKING

from langchain_core.messages import HumanMessage
from langgraph.types import Command

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph
    from src.agentic_platform.core.auth import UserContext
    from src.agentic_platform.core.agents.config import AgentConfig

logger = logging.getLogger(__name__)


def build_graph_config(
    conv_id: str,
    user: "UserContext | None" = None,
    agent_config: "AgentConfig | None" = None,
    callbacks: list | None = None,
) -> dict:
    """Build LangGraph config dict for graph execution.

    Generic — no chat/SSE knowledge. Just sets up configurable,
    metadata, and callbacks.
    """
    config: dict = {"configurable": {"thread_id": conv_id}}
    if user:
        config["configurable"].update(user.to_config())
    if callbacks:
        config["callbacks"] = callbacks
    if user:
        config["metadata"] = user.to_config()
    return config


def build_graph_input(
    user_message: str | None,
    hitl_response: dict | None = None,
    resume_workflow: bool = False,
) -> dict | Command | None:
    """Build graph input from user message or HITL resume.

    Returns dict (new message), Command (HITL resume), or None (reconnect only).
    """
    if resume_workflow:
        return None

    if not hitl_response:
        return {"messages": [HumanMessage(content=user_message)]}

    return Command(resume=hitl_response)


async def execute_graph(
    graph: "CompiledStateGraph",
    input: dict | Command | None,
    config: dict,
    stream_mode: list[str] | None = None,
    subgraphs: bool = True,
) -> AsyncIterator[tuple[Any, ...]]:
    """Execute a LangGraph and yield raw stream chunks.

    This is the core execution primitive. It yields raw LangGraph
    events with no projection, no accumulation, no SSE encoding.

    The caller (api layer) decides:
    - Which stream_mode to use
    - How to project events (AG-UI, custom protocol, etc.)
    - How to accumulate state
    - How to deliver to clients (SSE, WebSocket, batch, etc.)

    Args:
        graph: Compiled LangGraph
        input: Graph input (dict for messages, Command for HITL resume, None for reconnect)
        config: LangGraph config from build_graph_config()
        stream_mode: Event types to stream (default: ["messages", "custom", "updates"])
        subgraphs: Include subgraph events (workflows)

    Yields:
        Raw LangGraph stream chunks (tuples from astream())
    """
    if stream_mode is None:
        stream_mode = ["messages", "custom", "updates"]

    async for chunk in graph.astream(
        input,
        config=config,
        stream_mode=stream_mode,
        subgraphs=subgraphs,
        version="v2",
    ):
        yield chunk
