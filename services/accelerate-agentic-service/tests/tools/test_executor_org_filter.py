"""Unit tests for BigQuery org_id enforcement helpers.

Tests _inject_org_filter and _enforce_org_filter without importing any heavy
LangGraph/LLM dependencies — only the pure SQL manipulation functions.
"""

import pytest

from src.agentic_platform.core.engine.mcp.bq_middleware import (
    _inject_org_filter,
    _strip_sql_comments,
)

from src.agentic_platform.core.engine.mcp.bq_middleware import _BQ_SQL_TOOLS


def _enforce_org_filter(tool_name: str, args: dict, org_id: str) -> dict:
    """Test helper — mirrors the old _enforce_org_filter function signature."""
    if tool_name not in _BQ_SQL_TOOLS:
        return args
    sql_key = next((k for k in ("query", "sql", "statement") if k in args), None)
    if not sql_key:
        return args
    if not org_id:
        raise RuntimeError(
            f"Refusing to execute {tool_name}: org_id is empty. "
            "Cannot enforce data isolation without a valid organization context."
        )
    original = args[sql_key]
    filtered = _inject_org_filter(original, org_id)
    return {**args, sql_key: filtered}

ORG = "abc12345-0000-0000-0000-000000000001"


# ── _strip_sql_comments ─────────────────────────────────────────────────────


class TestStripSqlComments:
    def test_removes_single_line_comment(self):
        sql = "SELECT 1 -- this is a comment\nFROM t"
        result = _strip_sql_comments(sql)
        assert "--" not in result
        assert "this is a comment" not in result

    def test_removes_block_comment(self):
        sql = "SELECT /* block comment */ 1"
        result = _strip_sql_comments(sql)
        assert "block comment" not in result

    def test_preserves_rest_of_query(self):
        sql = "SELECT a -- comment\nFROM t"
        result = _strip_sql_comments(sql)
        assert "SELECT a" in result
        assert "FROM t" in result


# ── _inject_org_filter ───────────────────────────────────────────────────────


class TestInjectOrgFilter:
    def test_raises_on_invalid_org_id(self):
        with pytest.raises(ValueError, match="org_id"):
            _inject_org_filter("SELECT 1", "'; DROP TABLE x; --")

    def test_no_injection_when_already_filtered(self):
        sql = f"SELECT * FROM t WHERE organization_id = '{ORG}' AND spend > 0"
        result = _inject_org_filter(sql, ORG)
        assert result == sql

    def test_no_injection_when_filter_in_comment(self):
        """Comment containing organization_id should NOT fool the guard."""
        sql = f"-- organization_id is scoped elsewhere\nSELECT * FROM t"
        result = _inject_org_filter(sql, ORG)
        # Filter should be injected since the real SQL body has no filter
        assert f"organization_id = '{ORG}'" in result

    def test_injects_after_where(self):
        sql = "SELECT * FROM t WHERE spend > 0"
        result = _inject_org_filter(sql, ORG)
        # Filter must come right after WHERE, before existing condition
        assert f"organization_id = '{ORG}' AND" in result

    def test_injects_before_group_by(self):
        sql = "SELECT platform, SUM(spend) FROM t GROUP BY platform"
        result = _inject_org_filter(sql, ORG)
        assert f"WHERE organization_id = '{ORG}'" in result
        where_pos = result.index("WHERE")
        group_pos = result.upper().index("GROUP BY")
        assert where_pos < group_pos

    def test_injects_before_order_by(self):
        sql = "SELECT * FROM t ORDER BY spend DESC"
        result = _inject_org_filter(sql, ORG)
        where_pos = result.index("WHERE")
        order_pos = result.upper().index("ORDER BY")
        assert where_pos < order_pos

    def test_injects_before_limit(self):
        sql = "SELECT * FROM t LIMIT 100"
        result = _inject_org_filter(sql, ORG)
        where_pos = result.index("WHERE")
        limit_pos = result.upper().index("LIMIT")
        assert where_pos < limit_pos

    def test_injects_before_qualify(self):
        sql = "SELECT *, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY date DESC) AS rn FROM t QUALIFY rn = 1"
        result = _inject_org_filter(sql, ORG)
        where_pos = result.index("WHERE")
        qualify_pos = result.upper().index("QUALIFY")
        assert where_pos < qualify_pos

    def test_appends_at_end_when_no_anchor(self):
        sql = "SELECT * FROM t"
        result = _inject_org_filter(sql, ORG)
        assert result.endswith(f"WHERE organization_id = '{ORG}'")

    def test_strips_trailing_semicolon_before_append(self):
        sql = "SELECT * FROM t;"
        result = _inject_org_filter(sql, ORG)
        assert not result.startswith(";")
        assert f"WHERE organization_id = '{ORG}'" in result

    def test_cte_outer_select_without_where(self):
        """CTE with no outer WHERE — filter injected before GROUP BY or at end."""
        sql = (
            "WITH base AS (SELECT * FROM t WHERE x = 1) "
            "SELECT platform, SUM(spend) FROM base GROUP BY platform"
        )
        result = _inject_org_filter(sql, ORG)
        assert f"organization_id = '{ORG}'" in result
        # The filter should be OUTSIDE the CTE (outer scope)
        cte_end = result.index("SELECT platform")
        filter_pos = result.index(f"organization_id = '{ORG}'")
        assert filter_pos > cte_end

    def test_subquery_where_not_treated_as_outer_where(self):
        """WHERE inside a subquery must not be used as anchor for outer filter."""
        sql = "SELECT * FROM (SELECT * FROM t WHERE x = 1) sub"
        result = _inject_org_filter(sql, ORG)
        # Filter should be appended at end (no outer WHERE)
        assert f"organization_id = '{ORG}'" in result
        # The injected filter should appear after the subquery closes
        close_paren = result.rindex(")")
        filter_pos = result.index(f"organization_id = '{ORG}'")
        assert filter_pos > close_paren

    def test_idempotent_when_run_twice(self):
        sql = "SELECT * FROM t"
        once = _inject_org_filter(sql, ORG)
        twice = _inject_org_filter(once, ORG)
        assert once == twice


# ── _enforce_org_filter ──────────────────────────────────────────────────────


class TestEnforceOrgFilter:
    def test_non_bq_tool_passes_through_unchanged(self):
        args = {"foo": "bar"}
        result = _enforce_org_filter("list_campaigns", args, ORG)
        assert result is args  # exact same object, no copy

    def test_bq_tool_without_sql_arg_passes_through(self):
        args = {"dataset": "accelerate_ingestion_store"}
        result = _enforce_org_filter("execute_sql", args, ORG)
        assert result == args

    def test_bq_tool_injects_filter_into_query_key(self):
        sql = "SELECT * FROM analytics.google_unified"
        result = _enforce_org_filter("execute_sql", {"query": sql}, ORG)
        assert f"organization_id = '{ORG}'" in result["query"]

    def test_bq_tool_injects_filter_into_sql_key(self):
        sql = "SELECT * FROM analytics.google_unified"
        result = _enforce_org_filter("execute_sql", {"sql": sql}, ORG)
        assert f"organization_id = '{ORG}'" in result["sql"]

    def test_bq_tool_injects_filter_into_statement_key(self):
        sql = "SELECT * FROM analytics.google_unified"
        result = _enforce_org_filter("execute_sql", {"statement": sql}, ORG)
        assert f"organization_id = '{ORG}'" in result["statement"]

    def test_bq_tool_raises_when_org_id_empty(self):
        with pytest.raises(RuntimeError, match="org_id is empty"):
            _enforce_org_filter("execute_sql", {"query": "SELECT 1"}, "")

    def test_bq_tool_raises_when_org_id_none_coerced(self):
        with pytest.raises(RuntimeError, match="org_id is empty"):
            _enforce_org_filter("execute_sql", {"query": "SELECT 1"}, None)

    def test_other_args_preserved_after_injection(self):
        args = {"query": "SELECT * FROM t", "timeout": 30, "project": "my-proj"}
        result = _enforce_org_filter("execute_sql", args, ORG)
        assert result["timeout"] == 30
        assert result["project"] == "my-proj"

    def test_already_filtered_query_not_double_injected(self):
        sql = f"SELECT * FROM t WHERE organization_id = '{ORG}'"
        result = _enforce_org_filter("execute_sql", {"query": sql}, ORG)
        # Count occurrences of the filter clause
        assert result["query"].count(f"organization_id = '{ORG}'") == 1
