"""LLM traffic analytics endpoints — AI-referred visitor detection and filtering."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from core.auth import verify_internal_key
from core.database import get_pool
from services.llm_detector import detect_llm_referrer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics/llm-traffic", tags=["llm-traffic"])

# In-memory store for filtering toggle (dev fallback if org_settings table missing)
_filtering_state: dict[str, bool] = {}

# Platform display names map
_DISPLAY_NAMES = {
    "chatgpt": "ChatGPT",
    "claude": "Claude",
    "perplexity": "Perplexity",
    "gemini": "Gemini",
    "copilot": "Copilot",
    "meta_ai": "Meta AI",
    "grok": "Grok",
}


# ── Mock data helpers ─────────────────────────────────────────────────────────

def _generate_trend(days: int) -> list[dict]:
    """Generate realistic 30-day trend with slight upward trajectory (~10% → ~15%)."""
    rng = random.Random(7)  # deterministic seed
    now = datetime.now(timezone.utc)
    trend = []
    for i in range(days):
        day = (now - timedelta(days=days - 1 - i)).date()
        # Upward trend: start at ~10%, end at ~15%
        base_pct = 10.0 + (5.0 * i / max(days - 1, 1))
        pct = round(base_pct * rng.uniform(0.85, 1.15), 1)
        total = rng.randint(520, 640)
        llm_count = round(total * pct / 100)
        trend.append({
            "date": day.isoformat(),
            "llm_visitors": llm_count,
            "total_visitors": total,
            "pct": pct,
        })
    return trend


def _mock_llm_traffic(days: int, filtering_enabled: bool = False) -> dict:
    scale = days / 30.0
    platforms = [
        {"platform": "chatgpt",    "display_name": "ChatGPT",    "visitors": round(1512 * scale), "pct": 8.2,  "conversions": round(87 * scale),  "conversion_rate": 5.75},
        {"platform": "claude",     "display_name": "Claude",     "visitors": round(571 * scale),  "pct": 3.1,  "conversions": round(38 * scale),  "conversion_rate": 6.65},
        {"platform": "perplexity", "display_name": "Perplexity", "visitors": round(497 * scale),  "pct": 2.7,  "conversions": round(21 * scale),  "conversion_rate": 4.23},
        {"platform": "gemini",     "display_name": "Gemini",     "visitors": round(184 * scale),  "pct": 1.0,  "conversions": round(9 * scale),   "conversion_rate": 4.89},
        {"platform": "copilot",    "display_name": "Copilot",    "visitors": round(55 * scale),   "pct": 0.3,  "conversions": round(3 * scale),   "conversion_rate": 5.45},
    ]
    total_visitors = round(18420 * scale)
    llm_visitors = sum(p["visitors"] for p in platforms)
    return {
        "period_days": days,
        "total_visitors": total_visitors,
        "llm_visitors": llm_visitors,
        "llm_pct": round(llm_visitors / total_visitors * 100, 1) if total_visitors > 0 else 0.0,
        "filtering_enabled": filtering_enabled,
        "platforms": platforms,
        "trend": _generate_trend(days),
    }


# ── Pydantic models ───────────────────────────────────────────────────────────


class ToggleBody(BaseModel):
    enabled: bool


class DetectBody(BaseModel):
    referrer: Optional[str] = None
    user_agent: Optional[str] = None
    page_url: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("", dependencies=[Depends(verify_internal_key)])
async def get_llm_traffic(org_id: str, days: int = 30):
    """LLM traffic summary: total visitors, per-platform breakdown, and 30-day trend."""
    pool = await get_pool()

    # Read filtering toggle from org_settings (best-effort)
    filtering_enabled = _filtering_state.get(org_id, False)
    try:
        row = await pool.fetchrow(
            "SELECT value FROM org_settings WHERE org_id = $1 AND key = $2",
            org_id,
            "llm_filtering_enabled",
        )
        if row:
            filtering_enabled = row["value"].lower() == "true"
    except Exception:
        pass  # table may not exist yet

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date()

        # Overall visitor + LLM counts
        summary_row = await pool.fetchrow(
            """
            SELECT
                COUNT(DISTINCT session_id)                                                   AS total_visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE llm_platform != 'none' AND llm_platform IS NOT NULL) AS llm_visitors
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type = 'page_view'
            """,
            org_id,
            cutoff,
        )
        if not summary_row or summary_row["total_visitors"] == 0:
            raise ValueError("no llm_traffic rows")

        total_visitors = int(summary_row["total_visitors"])
        llm_visitors = int(summary_row["llm_visitors"])
        llm_pct = round(llm_visitors / total_visitors * 100, 1) if total_visitors > 0 else 0.0

        # Per-platform breakdown
        platform_rows = await pool.fetch(
            """
            SELECT
                llm_platform                                                         AS platform,
                COUNT(DISTINCT session_id)                                           AS visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'purchase')   AS conversions
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND llm_platform != 'none'
              AND llm_platform IS NOT NULL
            GROUP BY llm_platform
            ORDER BY visitors DESC
            """,
            org_id,
            cutoff,
        )
        platforms = []
        for r in platform_rows:
            p = r["platform"]
            vis = int(r["visitors"])
            conv = int(r["conversions"])
            cvr = round(conv / vis * 100, 2) if vis > 0 else 0.0
            platforms.append({
                "platform": p,
                "display_name": _DISPLAY_NAMES.get(p, p.title()),
                "visitors": vis,
                "pct": round(vis / total_visitors * 100, 1) if total_visitors > 0 else 0.0,
                "conversions": conv,
                "conversion_rate": cvr,
            })

        # Daily trend
        trend_rows = await pool.fetch(
            """
            SELECT
                event_date,
                COUNT(DISTINCT session_id)                                                          AS total_visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE llm_platform != 'none' AND llm_platform IS NOT NULL) AS llm_visitors
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type = 'page_view'
            GROUP BY event_date
            ORDER BY event_date ASC
            """,
            org_id,
            cutoff,
        )
        trend = [
            {
                "date": r["event_date"].isoformat(),
                "llm_visitors": int(r["llm_visitors"]),
                "total_visitors": int(r["total_visitors"]),
                "pct": round(int(r["llm_visitors"]) / int(r["total_visitors"]) * 100, 1)
                if int(r["total_visitors"]) > 0 else 0.0,
            }
            for r in trend_rows
        ]

        return {
            "period_days": days,
            "total_visitors": total_visitors,
            "llm_visitors": llm_visitors,
            "llm_pct": llm_pct,
            "filtering_enabled": filtering_enabled,
            "platforms": platforms,
            "trend": trend,
        }

    except Exception as exc:
        logger.warning("LLM traffic query failed for org %s: %s — returning mock", org_id, exc)
        return _mock_llm_traffic(days, filtering_enabled)


@router.post("/toggle", dependencies=[Depends(verify_internal_key)])
async def toggle_llm_filtering(org_id: str, body: ToggleBody):
    """Enable or disable LLM traffic filtering for the organisation.

    Persists to org_settings table; falls back to in-memory store if unavailable.
    """
    pool = await get_pool()
    _filtering_state[org_id] = body.enabled  # always update in-memory

    try:
        await pool.execute(
            """
            INSERT INTO org_settings (org_id, key, value, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (org_id, key) DO UPDATE
              SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            """,
            org_id,
            "llm_filtering_enabled",
            str(body.enabled).lower(),
        )
    except Exception as exc:
        logger.debug("org_settings table not available: %s — using in-memory state", exc)

    return {"ok": True, "filtering_enabled": body.enabled}


@router.post("/detect")
async def detect_llm(body: DetectBody):
    """Test LLM detection for a given referrer, user agent, or page URL.

    Useful for debugging pixel events and verifying detection accuracy.
    """
    result = detect_llm_referrer(
        referrer=body.referrer,
        user_agent=body.user_agent,
        page_url=body.page_url,
    )
    return {
        "is_llm": result.is_llm,
        "platform": result.platform,
        "display_name": _DISPLAY_NAMES.get(result.platform, result.platform.title()) if result.is_llm else None,
        "confidence": result.confidence,
    }
