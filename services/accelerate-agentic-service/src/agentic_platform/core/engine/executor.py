"""StreamingToolNode — replaces LangGraph's ToolNode.

Auto-emits thinking, step, and UI block events via StreamWriter.
HITL gate: pre-execution (policy) and post-execution (tool response).
Tools return ToolResponse — zero streaming or interrupt code in tools.
"""

import asyncio
import json
import logging

from langchain_core.messages import AIMessage, ToolMessage
from langgraph.types import StreamWriter

from langgraph.errors import GraphInterrupt

from src.agentic_platform.core.stream_emitter import StreamEmitter
from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, UIBlock, AgentState
from src.agentic_platform.core.engine.hitl import (
    request_human_input, build_confirmation, HITLRequest, HITLPolicy,
    HITLAction, is_rejection,
)
from src.agentic_platform.core.engine.middleware import run_middlewares

logger = logging.getLogger(__name__)


def _tool_msg(tool_call: dict, content: str) -> ToolMessage:
    return ToolMessage(content=content, name=tool_call["name"], tool_call_id=tool_call["id"])


def _handle_hitl_decision(
    tool_call: dict, tool_response: ToolResponse, decision: dict,
) -> ToolMessage:
    """Route the user's HITL decision to the right ToolMessage."""
    action = decision.get("action", "")
    if is_rejection(action):
        return _tool_msg(
            tool_call, f"Rejected by user: {decision.get('reason', '')}",
        )
    if action == HITLAction.SUBMIT and decision.get("modifications"):
        return _tool_msg(
            tool_call, f"User input: {json.dumps(decision['modifications'])}",
        )
    # Approved — use the tool's own output
    return _tool_msg(tool_call, tool_response.for_llm())


class StreamingToolNode:
    """LangGraph node that executes tools with auto-streaming + HITL gate.

    HITL gate has two checkpoints:
      - PRE-EXECUTION: if hitl_policy="always", confirm before running
      - POST-EXECUTION: if ToolResponse.hitl is set, confirm after running

    Both use request_human_input() — the single place interrupt() is called.

    Tools with hitl_policy="always" are executed sequentially (not gathered)
    to avoid concurrent interrupt() calls within a single node execution.
    """

    def __init__(self, tools: list[AgenticTool], middlewares=None):
        self.tools_by_name = {t.name: t for t in tools}
        self.middlewares = middlewares or []

    async def __call__(self, state: AgentState, writer: StreamWriter, config=None) -> dict:
        last_message = state["messages"][-1]
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return {"messages": []}

        emitter = StreamEmitter(writer)

        hitl_calls = []
        safe_calls = []
        for tc in last_message.tool_calls:
            tool = self.tools_by_name[tc["name"]]
            if tool.hitl_policy == HITLPolicy.ALWAYS:
                hitl_calls.append(tc)
            else:
                safe_calls.append(tc)

        # Safe tools run concurrently; HITL tools run sequentially to avoid
        # concurrent interrupt() calls within a single node execution.
        tool_messages: list[ToolMessage] = []
        if safe_calls:
            tool_messages.extend(
                await asyncio.gather(*(self._execute(tc, emitter, config) for tc in safe_calls))
            )
        for tc in hitl_calls:
            tool_messages.append(await self._execute(tc, emitter, config))

        return {"messages": tool_messages}

    async def _execute(self, tool_call: dict, emitter: StreamEmitter, config=None) -> ToolMessage:
        """Execute a single tool call with streaming, HITL gates, and error handling."""
        name = tool_call["name"]
        tool = self.tools_by_name[name]

        emitter.thinking(tool.get_thinking_message())
        emitter.step_started(name)

        try:
            return await self._run_with_gates(tool_call, tool, emitter, config)
        except GraphInterrupt:
            raise  # LangGraph pause — must propagate, not an error
        except asyncio.TimeoutError:
            logger.warning("Tool %s timed out after %ds", name, tool.timeout)
            return _tool_msg(tool_call, f"Error: Tool timed out after {tool.timeout}s")
        except Exception as e:
            logger.exception("Tool %s failed", name)
            return _tool_msg(tool_call, f"Error: {e}")
        finally:
            emitter.step_finished(name)

    async def _run_with_gates(
        self, tool_call: dict, tool: AgenticTool, emitter: StreamEmitter,
        config=None,
    ) -> ToolMessage:
        """Core execution: pre-gate -> middlewares -> run -> emit blocks -> post-gate -> result."""
        # Pre-execution HITL gate (policy-based)
        if tool.hitl_policy == HITLPolicy.ALWAYS:
            decision = request_human_input(build_confirmation(
                title=f"Run {tool_call['name'].replace('_', ' ').title()}?",
                description=f"Arguments: {json.dumps(tool_call['args'])}",
                payload=tool_call["args"],
            ))
            if is_rejection(decision.get("action", "")):
                return _tool_msg(tool_call, f"Cancelled by user: {decision.get('reason', '')}")

        # Run pre-execution middlewares (e.g. org_id injection for BQ tools)
        args = dict(tool_call["args"])
        if self.middlewares:
            args = await run_middlewares(self.middlewares, tool_call["name"], args, config or {})

        # Execute — merge emitter into LangGraph config so tools can stream mid-execution
        exec_config = dict(config) if config else {}
        exec_config.setdefault("metadata", {})
        exec_config["metadata"]["__stream_emitter"] = emitter
        raw_result = await asyncio.wait_for(
            tool.func.ainvoke(args, config=exec_config),
            timeout=tool.timeout,
        )
        tool_response = _parse_tool_response(raw_result, tool_call["name"])

        # Emit UI blocks
        for block in tool_response.ui_blocks:
            emitter.block(
                block.type, block.data,
                display=block.display.value,
                inline_trigger=block.inline_trigger,
            )

        # Post-execution HITL gate (tool-initiated)
        if tool_response.hitl:
            if not isinstance(tool_response.hitl, HITLRequest):
                raise TypeError(
                    f"ToolResponse.hitl must be an HITLRequest instance, got {type(tool_response.hitl).__name__}. "
                    f"Use build_confirmation() or HITLRequest(...) from tools.hitl."
                )
            decision = request_human_input(tool_response.hitl)
            return _handle_hitl_decision(tool_call, tool_response, decision)

        return _tool_msg(tool_call, tool_response.for_llm())


def _parse_tool_response(raw_result, tool_name: str = "") -> ToolResponse:
    """Reconstruct ToolResponse from a tool's return value.

    Raises TypeError for dicts that look like a ToolResponse but have
    schema errors (e.g. typos in field names). Only wraps truly opaque
    values (str, int, etc.) as ToolResponse.data.

    Coerces nested types:
      - hitl dict -> HITLRequest (tools serialize via .model_dump())
      - ui_blocks list[dict] -> list[UIBlock] (MCP transformers may return dicts)
    """
    if isinstance(raw_result, ToolResponse):
        return raw_result
    if isinstance(raw_result, dict):
        # If the dict has any ToolResponse field names, treat it as an
        # intentional ToolResponse — fail loudly on schema errors.
        tool_response_fields = {"summary", "data", "ui_blocks", "metadata", "hitl"}
        if tool_response_fields & raw_result.keys():
            raw_result = dict(raw_result)

            # Auto-coerce hitl dict -> HITLRequest (tools serialize via .model_dump())
            if isinstance(raw_result.get("hitl"), dict):
                raw_result["hitl"] = HITLRequest(**raw_result["hitl"])

            # Auto-coerce ui_blocks list[dict] -> list[UIBlock]
            # MCP result transformers return dicts from ToolResponse.model_dump(),
            # but executor expects UIBlock objects with .type, .display.value, etc.
            if raw_result.get("ui_blocks"):
                raw_result["ui_blocks"] = [
                    UIBlock(**b) if isinstance(b, dict) else b
                    for b in raw_result["ui_blocks"]
                ]

            return ToolResponse(**raw_result)
        return ToolResponse(data=raw_result)
    return ToolResponse(data=str(raw_result))
