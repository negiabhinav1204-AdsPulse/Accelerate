"""Tests for AgentRegistry guardrails."""

import pytest
from langchain_core.tools import tool

from src.agentic_platform.core.engine.models import AgenticTool, ToolTag
from src.agentic_platform.core.engine.registry import AgentRegistry


@tool("good_tool")
async def _good_tool(query: str) -> str:
    """A good tool with a docstring."""
    return "ok"


@tool("another_tool")
async def _another_tool(x: str) -> str:
    """Another tool."""
    return "ok"


def _bare_function(x: str) -> str:
    return "not a tool"


class TestAgenticToolGuardrails:
    def test_missing_tool_decorator(self):
        with pytest.raises(TypeError, match="use @tool decorator"):
            AgenticTool(func=_bare_function)

    def test_empty_thinking_messages(self):
        with pytest.raises(ValueError, match="thinking_messages must not be empty"):
            AgenticTool(func=_good_tool, thinking_messages=[])

    def test_zero_timeout(self):
        with pytest.raises(ValueError, match="timeout must be > 0"):
            AgenticTool(func=_good_tool, timeout=0)

    def test_valid_tool(self):
        t = AgenticTool(func=_good_tool, tags=[ToolTag.ANALYTICS])
        assert t.name == "good_tool"


class TestRegistryGuardrails:
    def test_register_wrong_type(self):
        registry = AgentRegistry()
        with pytest.raises(TypeError, match="Expected AgenticTool"):
            registry.register_tool("not a tool")

    def test_duplicate_name(self):
        registry = AgentRegistry()
        registry.register_tool(AgenticTool(func=_good_tool))
        with pytest.raises(ValueError, match="Duplicate name"):
            registry.register_tool(AgenticTool(func=_good_tool))

    def test_register_valid_tools(self):
        registry = AgentRegistry()
        registry.register_tool(AgenticTool(func=_good_tool))
        registry.register_tool(AgenticTool(func=_another_tool))
