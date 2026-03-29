"""Tests for tool middleware system."""

import pytest

from src.agentic_platform.core.engine.middleware import ToolMiddleware, run_middlewares


class UpperCaseMiddleware(ToolMiddleware):
    """Test middleware that uppercases a 'query' arg."""

    def applies_to(self, tool_name: str) -> bool:
        return tool_name == "search"

    async def before_execute(self, tool_name, args, config):
        args = dict(args)
        if "query" in args:
            args["query"] = args["query"].upper()
        return args


class InjectOrgMiddleware(ToolMiddleware):
    """Test middleware that injects org_id from config."""

    def applies_to(self, tool_name: str) -> bool:
        return tool_name in {"execute_sql", "search"}

    async def before_execute(self, tool_name, args, config):
        args = dict(args)
        org_id = (config.get("configurable") or {}).get("org_id", "")
        if not org_id:
            raise RuntimeError(f"org_id required for {tool_name}")
        args["org_id"] = org_id
        return args


class TestAppliesTo:
    @pytest.mark.asyncio
    async def test_middleware_only_runs_for_matching_tools(self):
        mw = UpperCaseMiddleware()
        args = {"query": "hello"}

        # Matching tool — should transform
        result = await run_middlewares([mw], "search", dict(args), {})
        assert result["query"] == "HELLO"

        # Non-matching tool — should passthrough
        result = await run_middlewares([mw], "other_tool", dict(args), {})
        assert result["query"] == "hello"


class TestArgsTransformation:
    @pytest.mark.asyncio
    async def test_before_execute_modifies_args(self):
        mw = InjectOrgMiddleware()
        config = {"configurable": {"org_id": "abc-123"}}

        result = await run_middlewares([mw], "execute_sql", {"query": "SELECT 1"}, config)
        assert result["org_id"] == "abc-123"
        assert result["query"] == "SELECT 1"


class TestMiddlewareChainOrdering:
    @pytest.mark.asyncio
    async def test_middlewares_run_in_order(self):
        """First middleware injects org_id, second uppercases query. Both apply to 'search'."""
        mw1 = InjectOrgMiddleware()
        mw2 = UpperCaseMiddleware()
        config = {"configurable": {"org_id": "org-1"}}

        result = await run_middlewares([mw1, mw2], "search", {"query": "hello"}, config)
        assert result["org_id"] == "org-1"
        assert result["query"] == "HELLO"


class TestMiddlewareErrors:
    @pytest.mark.asyncio
    async def test_middleware_error_propagates(self):
        mw = InjectOrgMiddleware()
        config = {"configurable": {}}  # no org_id

        with pytest.raises(RuntimeError, match="org_id required"):
            await run_middlewares([mw], "execute_sql", {"query": "SELECT 1"}, config)


class TestEmptyMiddlewares:
    @pytest.mark.asyncio
    async def test_empty_middlewares_noop(self):
        args = {"query": "hello"}
        result = await run_middlewares([], "any_tool", args, {})
        assert result is args  # same object, untouched
