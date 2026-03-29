"""BigQuery org_id data isolation middleware.

Programmatically injects organization_id filters into every execute_sql
call before it reaches BigQuery — the LLM cannot be trusted for this.

Bundled with the bigquery_analytics MCP server definition in
domains/common/mcp_servers.py:

    "bigquery_analytics": {
        "transport": "sse",
        "url": "...",
        "middlewares": [BigQueryOrgFilter()],
    }
"""

from __future__ import annotations

import logging
import re

from src.agentic_platform.core.engine.middleware import ToolMiddleware

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

# Tool names from --prebuilt=bigquery that accept a SQL string.
_BQ_SQL_TOOLS = {"execute_sql"}

# org_id must be a UUID (hex digits and hyphens only). Validated before SQL
# injection to prevent the org_id value itself from being a SQL injection vector.
_ORG_ID_RE = re.compile(r'^[0-9a-fA-F\-]{1,64}$')

# Strip SQL comments before checking for existing filter, so a comment like
# "-- organization_id is scoped" doesn't fool the guard.
_SQL_COMMENT_RE = re.compile(r'--[^\n]*|/\*.*?\*/', re.DOTALL)


# ── SQL helpers ──────────────────────────────────────────────────────────────

def _strip_sql_comments(sql: str) -> str:
    return _SQL_COMMENT_RE.sub(" ", sql)


def _find_outer_keyword(sql: str, keyword_pattern: str) -> re.Match | None:
    """Return the first regex match of keyword_pattern at parenthesis depth 0."""
    depth = 0
    for m in re.finditer(r"[()]|" + keyword_pattern, sql, re.IGNORECASE | re.DOTALL):
        token = m.group()
        if token == "(":
            depth += 1
        elif token == ")":
            depth -= 1
        elif depth == 0:
            return m
    return None


def _inject_org_filter(sql: str, org_id: str) -> str:
    """Ensure every BigQuery SQL query has an organization_id = '<org_id>' filter.

    Handles:
    - CTEs (WITH ... AS (...) SELECT ...) — injects into the outer SELECT
    - Queries with an existing outer WHERE — prepends filter after WHERE
    - Queries without WHERE — inserts before QUALIFY / GROUP BY / ORDER BY / LIMIT
    - Already-filtered queries — left untouched

    Raises ValueError if org_id fails UUID format validation.
    """
    if not _ORG_ID_RE.match(org_id):
        raise ValueError(
            f"org_id '{org_id}' failed format validation — refusing to inject into SQL"
        )

    # Check against comment-stripped SQL to avoid false positives
    if re.search(r"\borganization_id\b", _strip_sql_comments(sql), re.IGNORECASE):
        return sql  # already filtered

    filter_clause = f"organization_id = '{org_id}'"

    # If there's an outer WHERE, inject right after it
    where_match = _find_outer_keyword(sql, r"\bWHERE\b")
    if where_match:
        pos = where_match.end()
        injected = sql[:pos] + f" {filter_clause} AND" + sql[pos:]
        logger.info("Injected org filter after existing WHERE")
        return injected

    # No outer WHERE — insert before QUALIFY / GROUP BY / ORDER BY / LIMIT
    for keyword in (r"\bQUALIFY\b", r"\bGROUP\s+BY\b", r"\bORDER\s+BY\b", r"\bLIMIT\b"):
        match = _find_outer_keyword(sql, keyword)
        if match:
            pos = match.start()
            injected = sql[:pos] + f"WHERE {filter_clause}\n" + sql[pos:]
            logger.info("Injected org filter before %s clause", match.group().upper())
            return injected

    # Nothing to anchor to — append at end
    injected = sql.rstrip().rstrip(";") + f"\nWHERE {filter_clause}"
    logger.info("Injected org filter at end of query")
    return injected


# ── Middleware ────────────────────────────────────────────────────────────────

class BigQueryOrgFilter(ToolMiddleware):
    """Pre-execution middleware that enforces org_id data isolation on BigQuery SQL tools.

    Extracts org_id from LangGraph config and programmatically injects
    `WHERE organization_id = '<org_id>'` into every execute_sql call.
    Raises RuntimeError if org_id is missing — blocks unfiltered queries.
    """

    def applies_to(self, tool_name: str) -> bool:
        return tool_name in _BQ_SQL_TOOLS

    async def before_execute(self, tool_name: str, args: dict, config) -> dict:
        cfg = dict(config) if config else {}
        org_id: str = (
            cfg.get("configurable", {}).get("org_id")
            or cfg.get("metadata", {}).get("org_id")
            or ""
        )

        sql_key = next((k for k in ("query", "sql", "statement") if k in args), None)
        if not sql_key:
            return args

        if not org_id:
            raise RuntimeError(
                f"Refusing to execute {tool_name}: org_id is empty. "
                "Cannot enforce data isolation without a valid organization context."
            )

        args = dict(args)
        original = args[sql_key]
        filtered = _inject_org_filter(original, org_id)
        if filtered != original:
            logger.warning(
                "org_id filter was missing from %s — injected programmatically", tool_name
            )
        args[sql_key] = filtered

        # Log BQ SQL at INFO for auditability
        logger.info("BQ tool call [%s] SQL:\n%s", tool_name, filtered)
        return args
