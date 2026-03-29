"""Tool registry — validates at startup, builds the graph.

Usage in server.py:
    registry = AgentRegistry()
    registry.register_tool(query_analytics)
    registry.register_workflow(create_campaign)
    graph = registry.build_graph(llm, checkpointer)
"""

import logging
from typing import Callable
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END

from src.agentic_platform.core.engine.models import AgentState
from src.agentic_platform.core.engine.models import AgenticTool
from src.agentic_platform.core.engine.workflow import AgenticWorkflow

logger = logging.getLogger(__name__)


class AgentRegistry:
    """Central registry for tools and workflows. Validates at registration, builds graph at startup."""

    def __init__(self, system_prompt: str = "", dynamic_context: "Callable[[dict], str] | None" = None, middlewares=None):
        self._tools: list[AgenticTool] = []
        self._workflows: list[AgenticWorkflow] = []
        self._system_prompt = system_prompt
        self._dynamic_context = dynamic_context
        self._middlewares = middlewares or []
        self._names: set[str] = set()

    def register_tool(self, tool: AgenticTool) -> None:
        if not isinstance(tool, AgenticTool):
            raise TypeError(
                f"Expected AgenticTool, got {type(tool).__name__}. "
                f"Wrap your @tool function: AgenticTool(func=my_tool, ...)"
            )
        if tool.name in self._names:
            raise ValueError(f"Duplicate name '{tool.name}' — already registered.")
        self._names.add(tool.name)
        self._tools.append(tool)
        logger.info("Registered tool: %s (tags=%s, timeout=%ds)", tool.name, [t.value for t in tool.tags], tool.timeout)

    def register_workflow(self, workflow: AgenticWorkflow) -> None:
        """Register a workflow. Its trigger tool is added to the LLM's tool list."""
        if not isinstance(workflow, AgenticWorkflow):
            raise TypeError(
                f"Expected AgenticWorkflow, got {type(workflow).__name__}."
            )
        if workflow.name in self._names:
            raise ValueError(f"Duplicate name '{workflow.name}' — already registered.")
        self._names.add(workflow.name)
        self._workflows.append(workflow)
        logger.info("Registered workflow: %s (%d steps)", workflow.name, len(workflow.steps))

    def build_graph(self, llm, checkpointer):
        """Build the ReAct graph with all registered tools and workflows."""
        from src.agentic_platform.core.engine.executor import StreamingToolNode
        # Combine regular tool funcs + workflow trigger funcs for LLM binding
        lc_tools = [t.func for t in self._tools]
        lc_tools.extend(w.trigger for w in self._workflows)

        bound_llm = llm.bind_tools(lc_tools) if lc_tools else llm
        prompt = self._system_prompt
        workflow_triggers = {w.name for w in self._workflows}

        async def agent_node(state: AgentState, config = None) -> dict:
            cfg = dict(config) if config else {}
            metadata = cfg.get("metadata", {})
            logger.debug("[agent] config keys=%s metadata keys=%s platforms=%d",
                         list(cfg.keys()), list(metadata.keys()), len(metadata.get("connected_platforms", [])))

            # Build system prompt: static base + per-request dynamic context
            parts = [prompt]
            if self._dynamic_context:
                extra = self._dynamic_context(metadata)
                if extra:
                    parts.append(extra)

            system = SystemMessage(content="\n\n".join(parts))
            response = await bound_llm.ainvoke([system] + state["messages"])
            return {"messages": [response]}

        def should_continue(state: AgentState) -> str:
            last = state["messages"][-1]
            if isinstance(last, AIMessage) and last.tool_calls:
                # Check if any tool_call matches a workflow trigger
                for tc in last.tool_calls:
                    if tc["name"] in workflow_triggers:
                        if len(last.tool_calls) > 1:
                            other_calls = [tc2["name"] for tc2 in last.tool_calls if tc2["name"] != tc["name"]]
                            logger.warning(
                                "Workflow trigger '%s' mixed with other tool calls %s — "
                                "routing to workflow, other calls will be dropped. "
                                "The LLM should call workflow triggers alone.",
                                tc["name"], other_calls,
                            )
                        return tc["name"]  # route to the workflow sub-graph
                return "tools"
            return "end"

        graph = StateGraph(AgentState)
        graph.add_node("agent", agent_node)
        graph.add_edge(START, "agent")

        has_tools = bool(self._tools)
        has_workflows = bool(self._workflows)

        if has_tools or has_workflows:
            # Build routing map
            route_map: dict[str, str] = {"end": END}

            if has_tools:
                graph.add_node("tools", StreamingToolNode(self._tools, middlewares=self._middlewares))
                route_map["tools"] = "tools"
                graph.add_edge("tools", "agent")

            # Add workflow sub-graphs
            for workflow in self._workflows:
                sub_graph = workflow.build_graph().compile()
                graph.add_node(workflow.name, sub_graph)
                route_map[workflow.name] = workflow.name
                graph.add_edge(workflow.name, "agent")

            graph.add_conditional_edges("agent", should_continue, route_map)
        else:
            graph.add_edge("agent", END)

        compiled = graph.compile(checkpointer=checkpointer)
        logger.info("Graph built: %d tools, %d workflows", len(self._tools), len(self._workflows))
        return compiled
