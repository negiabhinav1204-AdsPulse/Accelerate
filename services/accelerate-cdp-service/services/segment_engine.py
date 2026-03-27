"""Rules-based segment evaluation engine — Section 1.4.

Evaluates CustomerProfile records against AudienceSegment rule sets.
Populates CustomerSegmentMembership for matching profiles.

Supported rule fields:
  total_spend, order_count, last_order_days_ago, first_order_days_ago,
  is_vip, is_lapsed, tags_contains, email_domain, aov

Operators: eq, neq, gte, lte, gt, lt, contains, not_contains, in, not_in, exists

Rule logic: AND | OR (per segment)

Reference: Adaptiv api/app/services/segment_engine.py evaluate_segment()
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)


# ── Rule evaluation ────────────────────────────────────────────────────────

def _get_profile_value(field: str, profile: dict) -> Any:
    now = datetime.now(timezone.utc)

    direct = {
        "total_spend": float(profile.get("totalSpend") or 0),
        "order_count": int(profile.get("orderCount") or 0),
        "is_vip": bool(profile.get("isVip")),
        "is_lapsed": bool(profile.get("isLapsed")),
        "tags": profile.get("tags") or [],
        "aov": float(profile.get("aov") or 0),
    }
    if field in direct:
        return direct[field]

    if field == "last_order_days_ago":
        lo = profile.get("lastOrderAt")
        if not lo:
            return None
        if isinstance(lo, str):
            lo = datetime.fromisoformat(lo.replace("Z", "+00:00"))
        if lo.tzinfo is None:
            lo = lo.replace(tzinfo=timezone.utc)
        return (now - lo).days

    if field == "first_order_days_ago":
        fo = profile.get("firstOrderAt")
        if not fo:
            return None
        if isinstance(fo, str):
            fo = datetime.fromisoformat(fo.replace("Z", "+00:00"))
        if fo.tzinfo is None:
            fo = fo.replace(tzinfo=timezone.utc)
        return (now - fo).days

    if field == "email_domain":
        email = profile.get("email") or ""
        return email.split("@")[-1] if "@" in email else ""

    if field == "tags_contains":
        return profile.get("tags") or []

    return profile.get(field)


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    if actual is None and operator not in ("exists", "not_exists"):
        return False
    try:
        if operator == "eq":
            return actual == expected
        if operator == "neq":
            return actual != expected
        if operator == "gte":
            return float(actual) >= float(expected)
        if operator == "lte":
            return float(actual) <= float(expected)
        if operator == "gt":
            return float(actual) > float(expected)
        if operator == "lt":
            return float(actual) < float(expected)
        if operator == "contains":
            if isinstance(actual, list):
                return expected in actual
            return str(expected).lower() in str(actual).lower()
        if operator == "not_contains":
            if isinstance(actual, list):
                return expected not in actual
            return str(expected).lower() not in str(actual).lower()
        if operator == "in":
            if isinstance(expected, list):
                return actual in expected
            return False
        if operator == "not_in":
            if isinstance(expected, list):
                return actual not in expected
            return True
        if operator == "exists":
            return actual is not None and actual != "" and actual != []
        if operator == "not_exists":
            return actual is None or actual == "" or actual == []
    except (ValueError, TypeError):
        return False
    return False


def evaluate_segment(rules: list[dict], rule_logic: str, profile: dict) -> bool:
    """Return True if profile matches the segment's rules."""
    if not rules:
        return False
    logic = rule_logic.upper() if rule_logic else "AND"
    for rule in rules:
        field = rule.get("field", "")
        operator = rule.get("operator", "eq")
        expected = rule.get("value")
        actual = _get_profile_value(field, profile)
        match = _compare(actual, operator, expected)
        if logic == "OR" and match:
            return True
        if logic == "AND" and not match:
            return False
    return logic == "AND"


# ── Segment preview (count + sample) ──────────────────────────────────────

async def preview_segment(
    pool: asyncpg.Pool,
    org_id: str,
    rules: list[dict],
    rule_logic: str,
    sample_size: int = 5,
) -> dict:
    """Estimate how many profiles match the segment rules.

    Fetches all profiles for the org and evaluates in Python.
    For large orgs (>50k profiles) this should be moved to SQL.
    """
    rows = await pool.fetch(
        """
        SELECT id, email, name, "totalSpend", "orderCount", "lastOrderAt",
               "firstOrderAt", "isVip", "isLapsed", tags, aov
        FROM "CustomerProfile"
        WHERE "organizationId" = $1
        """,
        org_id,
    )

    matching = [dict(r) for r in rows if evaluate_segment(rules, rule_logic, dict(r))]
    sample = matching[:sample_size]

    return {
        "estimated_size": len(matching),
        "total_profiles": len(rows),
        "sample": [
            {
                "id": str(p["id"]),
                "email": p.get("email"),
                "name": p.get("name"),
                "totalSpend": float(p.get("totalSpend") or 0),
                "orderCount": p.get("orderCount"),
                "isVip": p.get("isVip"),
            }
            for p in sample
        ],
    }


async def compute_segment_membership(
    pool: asyncpg.Pool,
    segment_id: str,
    org_id: str,
    rules: list[dict],
    rule_logic: str,
) -> int:
    """Evaluate all profiles and write CustomerSegmentMembership rows.

    Returns count of members added/confirmed.
    """
    rows = await pool.fetch(
        """
        SELECT id, email, name, "totalSpend", "orderCount", "lastOrderAt",
               "firstOrderAt", "isVip", "isLapsed", tags, aov
        FROM "CustomerProfile"
        WHERE "organizationId" = $1
        """,
        org_id,
    )

    matching_ids = [
        r["id"] for r in rows
        if evaluate_segment(rules, rule_logic, dict(r))
    ]

    if not matching_ids:
        return 0

    # Bulk upsert memberships
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Remove stale memberships not in current result
            await conn.execute(
                """
                DELETE FROM "CustomerSegmentMembership"
                WHERE "segmentId" = $1 AND "profileId" != ALL($2::uuid[])
                """,
                segment_id, matching_ids,
            )
            # Add new memberships
            await conn.executemany(
                """
                INSERT INTO "CustomerSegmentMembership" ("profileId", "segmentId", "addedAt")
                VALUES ($1, $2, NOW())
                ON CONFLICT DO NOTHING
                """,
                [(pid, segment_id) for pid in matching_ids],
            )
            # Update estimated size on the segment
            await conn.execute(
                'UPDATE "AudienceSegment" SET "estimatedSize" = $1, "updatedAt" = NOW() WHERE id = $2',
                len(matching_ids), segment_id,
            )

    return len(matching_ids)
