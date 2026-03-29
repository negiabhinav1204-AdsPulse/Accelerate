"""Tool context helpers — extract runtime context from RunnableConfig."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.runnables import RunnableConfig
    from src.agentic_platform.core.stream_emitter import StreamEmitter


def get_emitter(config: "RunnableConfig") -> "StreamEmitter | None":
    """Extract the StreamEmitter injected by executor (Phase 2)."""
    return (config.get("metadata") or {}).get("__stream_emitter")


def get_org_id(config: "RunnableConfig") -> str:
    """Extract org_id from RunnableConfig.configurable (set by orchestrator)."""
    return (config.get("configurable") or {}).get("org_id", "unknown")
