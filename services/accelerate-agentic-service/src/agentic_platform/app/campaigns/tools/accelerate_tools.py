"""Accelerate proxy tool factory.

`make_accelerate_tool(name, description, field_definitions)` returns an
`AgenticTool` that calls the Accelerate Next.js internal endpoint
(`/api/internal/tools`) to execute one of the 38 server-side data tools.

Auth and context flow:
- org_id and user_id are read from the LangGraph RunnableConfig (injected by
  the orchestrator from UserContext).
- The Bearer token is read from the `request_auth_token` ContextVar (set once
  per request by AuthMiddleware).
- An x-internal-api-key header authenticates the service-to-service call.

Implementation notes:
- We use `StructuredTool.from_function` so we can supply a custom Pydantic
  args_schema while keeping a simple async coroutine.
- The `config` (RunnableConfig) is injected by LangGraph and excluded from the
  schema via InjectedToolArg so the LLM never sees it.
"""

from __future__ import annotations

import logging
from typing import Any, Type

import httpx
from langchain_core.tools import BaseTool, InjectedToolArg, StructuredTool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field, create_model
from typing import Annotated

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.auth import request_auth_token
from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, ToolTag

logger = logging.getLogger(__name__)

# Default thinking messages reused across all proxy tools
_THINKING_MESSAGES = [
    "Fetching your data...",
    "Looking that up...",
    "Pulling live data...",
    "Checking the latest numbers...",
]


def _get_org_user(config: RunnableConfig | None) -> tuple[str, str]:
    """Extract org_id and user_id from LangGraph RunnableConfig."""
    configurable = (config or {}).get("configurable") or {}
    metadata = (config or {}).get("metadata") or {}
    org_id = configurable.get("org_id") or metadata.get("org_id") or "unknown"
    user_id = configurable.get("user_id") or metadata.get("user_id") or "anonymous"
    return org_id, user_id


def _build_headers() -> dict[str, str]:
    """Build request headers including auth token and internal API key."""
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "x-internal-api-key": settings.internal_api_key,
    }
    token = request_auth_token.get()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _call_accelerate_tool(
    tool_name: str,
    args: dict[str, Any],
    config: RunnableConfig | None,
) -> dict[str, Any]:
    """POST to the Accelerate internal tools endpoint and return the result."""
    org_id, user_id = _get_org_user(config)
    url = f"{settings.accelerate_internal_url.rstrip('/')}/api/internal/tools"

    # Filter out None values — optional fields not provided by the LLM
    clean_args = {k: v for k, v in args.items() if v is not None}

    payload = {
        "tool_name": tool_name,
        "args": clean_args,
        "org_id": org_id,
        "user_id": user_id,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=payload, headers=_build_headers())
            response.raise_for_status()
            body = response.json()
            if "error" in body:
                logger.error(
                    "[accelerate-tools] tool=%s org=%s error=%s",
                    tool_name, org_id, body["error"],
                )
                return {"error": body["error"]}
            return body.get("result", body)
        except httpx.TimeoutException:
            logger.error("[accelerate-tools] tool=%s timed out after 60s", tool_name)
            return {"error": f"Tool {tool_name} timed out"}
        except httpx.HTTPStatusError as exc:
            logger.error(
                "[accelerate-tools] tool=%s HTTP %s: %s",
                tool_name, exc.response.status_code, exc.response.text[:200],
            )
            return {"error": f"Tool {tool_name} returned HTTP {exc.response.status_code}"}
        except Exception as exc:  # noqa: BLE001
            logger.exception("[accelerate-tools] tool=%s unexpected error", tool_name)
            return {"error": str(exc)}


def _make_args_schema(
    tool_name: str,
    field_definitions: dict[str, tuple[type, Any]],
) -> Type[BaseModel]:
    """Dynamically create a Pydantic model for the tool's args schema."""
    # Always inject the hidden config field so LangGraph can pass it
    all_fields: dict[str, Any] = {
        **field_definitions,
        "config": (
            Annotated[RunnableConfig, InjectedToolArg()],
            None,
        ),
    }
    return create_model(
        f"{tool_name.replace('_', ' ').title().replace(' ', '')}Args",
        **all_fields,
    )


def make_accelerate_tool(
    name: str,
    description: str,
    field_definitions: dict[str, tuple[type, Any]] | None = None,
    thinking_messages: list[str] | None = None,
    tags: list[ToolTag] | None = None,
    timeout: int = 60,
) -> AgenticTool:
    """Factory: create an AgenticTool that proxies one Accelerate data tool.

    Args:
        name: Exact tool name (must match the Next.js tool dispatcher key).
        description: LLM-visible description. Copy verbatim from route.ts.
        field_definitions: Pydantic field definitions dict:
            ``{"field_name": (python_type, Field(default=..., description="..."))}``
            Pass ``None`` or ``{}`` for tools with no args.
        thinking_messages: Optional loading messages shown while the tool runs.
        tags: Optional ToolTag list for categorisation.
        timeout: Displayed timeout in AgenticTool (actual HTTP timeout is 60s).

    Returns:
        AgenticTool ready to register in AgentConfig.tools.
    """
    _name = name  # capture in closure
    args_schema = _make_args_schema(name, field_definitions or {})

    async def _run(**kwargs: Any) -> dict:
        config = kwargs.pop("config", None)
        result = await _call_accelerate_tool(_name, kwargs, config)
        return ToolResponse(data=result).model_dump()

    # StructuredTool.from_function lets us supply a custom Pydantic schema
    # while keeping a plain async coroutine
    langchain_tool: BaseTool = StructuredTool.from_function(
        coroutine=_run,
        name=name,
        description=description,
        args_schema=args_schema,
    )

    return AgenticTool(
        func=langchain_tool,
        thinking_messages=thinking_messages or list(_THINKING_MESSAGES),
        tags=tags or [],
        timeout=timeout,
    )
