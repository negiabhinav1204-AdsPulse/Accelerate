"""Tests for agent graph — agent node + checkpointer integration."""

import pytest

from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver

from src.agentic_platform.core.engine.registry import AgentRegistry


class FakeLLM:
    def __init__(self, response_text: str = "Hello!"):
        self.response_text = response_text
        self.call_count = 0
        self.last_messages = None

    def bind_tools(self, tools):
        return self

    async def ainvoke(self, messages):
        self.call_count += 1
        self.last_messages = messages
        return AIMessage(content=self.response_text)


def _build_graph(llm, checkpointer, prompt="You are a test assistant."):
    registry = AgentRegistry(system_prompt=prompt)
    return registry.build_graph(llm, checkpointer)


class TestAgentGraph:
    async def test_single_turn(self):
        llm = FakeLLM("Nice to meet you!")
        graph = _build_graph(llm, MemorySaver())

        result = await graph.ainvoke(
            {"messages": [HumanMessage(content="Hi")]},
            config={"configurable": {"thread_id": "test-1"}},
        )

        assert len(result["messages"]) == 2
        assert result["messages"][-1].content == "Nice to meet you!"
        assert llm.call_count == 1

    async def test_multi_turn_memory(self):
        llm = FakeLLM()
        graph = _build_graph(llm, MemorySaver())
        config = {"configurable": {"thread_id": "test-memory"}}

        llm.response_text = "Nice to meet you, Ganapathy!"
        await graph.ainvoke(
            {"messages": [HumanMessage(content="My name is Ganapathy")]},
            config=config,
        )

        llm.response_text = "Your name is Ganapathy!"
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content="What is my name?")]},
            config=config,
        )

        assert llm.call_count == 2
        assert len(llm.last_messages) >= 4
        assert result["messages"][-1].content == "Your name is Ganapathy!"

    async def test_separate_threads_isolated(self):
        llm = FakeLLM("Response")
        graph = _build_graph(llm, MemorySaver())

        for i in range(3):
            await graph.ainvoke(
                {"messages": [HumanMessage(content=f"Message {i}")]},
                config={"configurable": {"thread_id": "thread-A"}},
            )

        await graph.ainvoke(
            {"messages": [HumanMessage(content="First message")]},
            config={"configurable": {"thread_id": "thread-B"}},
        )

        assert len(llm.last_messages) == 2

    async def test_system_prompt_present(self):
        llm = FakeLLM("Hi!")
        graph = _build_graph(llm, MemorySaver(), prompt="You are an advertising assistant.")

        await graph.ainvoke(
            {"messages": [HumanMessage(content="Hello")]},
            config={"configurable": {"thread_id": "test-sys"}},
        )

        assert llm.last_messages[0].content.startswith("You are an advertising")
