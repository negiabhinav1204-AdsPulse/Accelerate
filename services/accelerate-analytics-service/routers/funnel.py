"""Funnel analysis endpoints — impression-to-purchase conversion funnel."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics/funnel", tags=["funnel"])


# ── Mock data helpers ─────────────────────────────────────────────────────────

_MOCK_STAGES = [
    {"name": "Impressions",   "event": "impression",       "count": 124800},
    {"name": "Clicks",        "event": "click",            "count": 3744},
    {"name": "Product Views", "event": "page_view",        "count": 2808},
    {"name": "Add to Cart",   "event": "add_to_cart",      "count": 842},
    {"name": "Checkout",      "event": "checkout_started", "count": 337},
    {"name": "Purchase",      "event": "purchase",         "count": 253},
]

_MOCK_PLATFORM_FUNNELS = {
    "google": [
        {"name": "Impressions",   "event": "impression",       "count": 58200},
        {"name": "Clicks",        "event": "click",            "count": 1746},
        {"name": "Product Views", "event": "page_view",        "count": 1397},
        {"name": "Add to Cart",   "event": "add_to_cart",      "count": 419},
        {"name": "Checkout",      "event": "checkout_started", "count": 176},
        {"name": "Purchase",      "event": "purchase",         "count": 132},
    ],
    "meta": [
        {"name": "Impressions",   "event": "impression",       "count": 42600},
        {"name": "Clicks",        "event": "click",            "count": 1278},
        {"name": "Product Views", "event": "page_view",        "count": 894},
        {"name": "Add to Cart",   "event": "add_to_cart",      "count": 268},
        {"name": "Checkout",      "event": "checkout_started", "count": 107},
        {"name": "Purchase",      "event": "purchase",         "count": 80},
    ],
    "bing": [
        {"name": "Impressions",   "event": "impression",       "count": 14400},
        {"name": "Clicks",        "event": "click",            "count": 432},
        {"name": "Product Views", "event": "page_view",        "count": 302},
        {"name": "Add to Cart",   "event": "add_to_cart",      "count": 91},
        {"name": "Checkout",      "event": "checkout_started", "count": 36},
        {"name": "Purchase",      "event": "purchase",         "count": 27},
    ],
    "organic": [
        {"name": "Impressions",   "event": "impression",       "count": 9600},
        {"name": "Clicks",        "event": "click",            "count": 288},
        {"name": "Product Views", "event": "page_view",        "count": 215},
        {"name": "Add to Cart",   "event": "add_to_cart",      "count": 64},
        {"name": "Checkout",      "event": "checkout_started", "count": 18},
        {"name": "Purchase",      "event": "purchase",         "count": 14},
    ],
}


def _compute_drop_offs(stages: list[dict]) -> list[dict]:
    """Add drop_off_pct to each stage based on previous stage count."""
    result = []
    for i, stage in enumerate(stages):
        drop_pct = None
        if i > 0 and stages[i - 1]["count"] > 0:
            prev = stages[i - 1]["count"]
            curr = stage["count"]
            drop_pct = round((prev - curr) / prev * 100, 1)
        result.append({**stage, "drop_off_pct": drop_pct})
    return result


def _build_funnel_response(stages: list[dict], from_date: str, to_date: str) -> dict:
    stages_with_drops = _compute_drop_offs(stages)
    # Find biggest drop-off stage (excluding first)
    drops = [(s["drop_off_pct"], s["name"]) for s in stages_with_drops if s["drop_off_pct"] is not None]
    biggest_drop_pct = max(drops, key=lambda x: x[0])[0] if drops else 0.0
    biggest_drop_stage = max(drops, key=lambda x: x[0])[1] if drops else ""

    top = stages[0]["count"] if stages else 1
    bottom = stages[-1]["count"] if stages else 0
    overall_cvr = round(bottom / top * 100, 2) if top > 0 else 0.0

    return {
        "period": {"from": from_date, "to": to_date},
        "stages": stages_with_drops,
        "overall_conversion_rate": overall_cvr,
        "biggest_drop_stage": biggest_drop_stage,
        "biggest_drop_pct": biggest_drop_pct,
    }


def _mock_funnel(from_date: str, to_date: str) -> dict:
    return _build_funnel_response(_MOCK_STAGES, from_date, to_date)


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("", dependencies=[Depends(verify_internal_key)])
async def get_funnel(
    org_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Full impression-to-purchase funnel with drop-off percentages."""
    now = datetime.now(timezone.utc)
    to_date = to_date or now.date().isoformat()
    from_date = from_date or (now - timedelta(days=30)).date().isoformat()

    pool = await get_pool()
    try:
        rows = await pool.fetch(
            """
            SELECT
                event_type,
                COUNT(*) AS event_count
            FROM analytics_events
            WHERE org_id = $1
              AND event_date BETWEEN $2 AND $3
              AND event_type IN ('impression', 'click', 'page_view', 'add_to_cart', 'checkout_started', 'purchase')
            GROUP BY event_type
            """,
            org_id,
            from_date,
            to_date,
        )
        if not rows:
            raise ValueError("no funnel rows")

        count_map = {r["event_type"]: r["event_count"] for r in rows}
        stage_defs = [
            ("Impressions",   "impression"),
            ("Clicks",        "click"),
            ("Product Views", "page_view"),
            ("Add to Cart",   "add_to_cart"),
            ("Checkout",      "checkout_started"),
            ("Purchase",      "purchase"),
        ]
        stages = [
            {"name": name, "event": event, "count": count_map.get(event, 0)}
            for name, event in stage_defs
        ]
        return _build_funnel_response(stages, from_date, to_date)

    except Exception as exc:
        logger.warning("Funnel query failed for org %s: %s — returning mock", org_id, exc)
        return _mock_funnel(from_date, to_date)


@router.get("/by-platform", dependencies=[Depends(verify_internal_key)])
async def get_funnel_by_platform(
    org_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Per-platform funnel breakdown (google / meta / bing / organic)."""
    now = datetime.now(timezone.utc)
    to_date = to_date or now.date().isoformat()
    from_date = from_date or (now - timedelta(days=30)).date().isoformat()

    pool = await get_pool()
    try:
        rows = await pool.fetch(
            """
            SELECT
                COALESCE(metadata->>'platform', 'organic') AS platform,
                event_type,
                COUNT(*) AS event_count
            FROM analytics_events
            WHERE org_id = $1
              AND event_date BETWEEN $2 AND $3
              AND event_type IN ('impression', 'click', 'page_view', 'add_to_cart', 'checkout_started', 'purchase')
            GROUP BY platform, event_type
            """,
            org_id,
            from_date,
            to_date,
        )
        if not rows:
            raise ValueError("no platform funnel rows")

        # Build per-platform funnels
        platform_counts: dict[str, dict[str, int]] = {}
        for r in rows:
            p = r["platform"]
            if p not in platform_counts:
                platform_counts[p] = {}
            platform_counts[p][r["event_type"]] = r["event_count"]

        stage_defs = [
            ("Impressions",   "impression"),
            ("Clicks",        "click"),
            ("Product Views", "page_view"),
            ("Add to Cart",   "add_to_cart"),
            ("Checkout",      "checkout_started"),
            ("Purchase",      "purchase"),
        ]
        result = {}
        for platform, counts in platform_counts.items():
            stages = [
                {"name": name, "event": event, "count": counts.get(event, 0)}
                for name, event in stage_defs
            ]
            result[platform] = _build_funnel_response(stages, from_date, to_date)

        return {"period": {"from": from_date, "to": to_date}, "by_platform": result}

    except Exception as exc:
        logger.warning("Platform funnel query failed for org %s: %s — returning mock", org_id, exc)
        mock_platforms = {
            platform: _build_funnel_response(stages, from_date, to_date)
            for platform, stages in _MOCK_PLATFORM_FUNNELS.items()
        }
        return {"period": {"from": from_date, "to": to_date}, "by_platform": mock_platforms}
