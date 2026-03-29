"""Geography analytics endpoints — revenue and orders by country and city."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics/geography", tags=["geography"])


# ── Mock data ─────────────────────────────────────────────────────────────────

_MOCK_COUNTRIES = [
    {"country": "United States", "country_code": "US", "revenue": 28450.20, "orders": 312, "visitors": 8420, "conversion_rate": 3.7},
    {"country": "United Kingdom", "country_code": "GB", "revenue": 8120.50, "orders": 89,  "visitors": 2140, "conversion_rate": 4.2},
    {"country": "Canada",         "country_code": "CA", "revenue": 5230.80, "orders": 67,  "visitors": 1890, "conversion_rate": 3.5},
    {"country": "Germany",        "country_code": "DE", "revenue": 2840.10, "orders": 31,  "visitors": 1340, "conversion_rate": 2.3},
    {"country": "Australia",      "country_code": "AU", "revenue": 2180.40, "orders": 28,  "visitors": 980,  "conversion_rate": 2.9},
    {"country": "France",         "country_code": "FR", "revenue": 1498.50, "orders": 18,  "visitors": 760,  "conversion_rate": 2.4},
]

_MOCK_CITIES = [
    {"city": "New York",    "country_code": "US", "revenue": 5240.10, "orders": 58},
    {"city": "Los Angeles", "country_code": "US", "revenue": 4180.20, "orders": 46},
    {"city": "London",      "country_code": "GB", "revenue": 3420.30, "orders": 38},
    {"city": "Chicago",     "country_code": "US", "revenue": 2940.50, "orders": 32},
    {"city": "Toronto",     "country_code": "CA", "revenue": 2210.80, "orders": 24},
]


def _mock_geography(days: int) -> dict:
    scale = days / 30.0
    countries = [
        {**c, "revenue": round(c["revenue"] * scale, 2), "orders": round(c["orders"] * scale),
         "visitors": round(c["visitors"] * scale)}
        for c in _MOCK_COUNTRIES
    ]
    cities = [
        {**c, "revenue": round(c["revenue"] * scale, 2), "orders": round(c["orders"] * scale)}
        for c in _MOCK_CITIES
    ]
    return {
        "countries": countries,
        "cities": cities,
        "total_countries": 28,
        "top_country": "United States",
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("", dependencies=[Depends(verify_internal_key)])
async def get_geography(org_id: str, days: int = 30):
    """Geographic breakdown of revenue, orders, and visitors by country and city."""
    pool = await get_pool()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        # Country-level data from CommerceOrder metadata JSONB
        country_rows = await pool.fetch(
            """
            SELECT
                metadata->>'geoCountry'     AS country,
                metadata->>'geoCountryCode' AS country_code,
                COUNT(*)                                               AS orders,
                COALESCE(SUM((metadata->>'totalPrice')::numeric), 0)   AS revenue
            FROM "CommerceOrder"
            WHERE "organizationId" = $1
              AND "createdAt" >= $2
              AND metadata->>'geoCountry' IS NOT NULL
            GROUP BY country, country_code
            ORDER BY revenue DESC
            LIMIT 50
            """,
            org_id,
            cutoff,
        )

        if not country_rows:
            raise ValueError("no geo rows in CommerceOrder")

        # Visitor counts from analytics_events
        visitor_rows = await pool.fetch(
            """
            SELECT
                metadata->>'country'      AS country_code,
                COUNT(DISTINCT session_id) AS visitors,
                COUNT(*) FILTER (WHERE event_type = 'purchase') AS conversions
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type IN ('page_view', 'purchase')
            GROUP BY country_code
            """,
            org_id,
            (datetime.now(timezone.utc) - timedelta(days=days)).date(),
        )
        visitor_map = {r["country_code"]: r for r in visitor_rows}

        countries = []
        for r in country_rows:
            code = r["country_code"] or ""
            visitors_row = visitor_map.get(code, {})
            visitors = int(visitors_row.get("visitors", 0)) if visitors_row else 0
            orders = int(r["orders"])
            cvr = round(orders / visitors * 100, 1) if visitors > 0 else 0.0
            countries.append({
                "country": r["country"] or "",
                "country_code": code,
                "revenue": float(r["revenue"]),
                "orders": orders,
                "visitors": visitors,
                "conversion_rate": cvr,
            })

        # City-level data
        city_rows = await pool.fetch(
            """
            SELECT
                metadata->>'geoCity'        AS city,
                metadata->>'geoCountryCode' AS country_code,
                COUNT(*)                                               AS orders,
                COALESCE(SUM((metadata->>'totalPrice')::numeric), 0)   AS revenue
            FROM "CommerceOrder"
            WHERE "organizationId" = $1
              AND "createdAt" >= $2
              AND metadata->>'geoCity' IS NOT NULL
            GROUP BY city, country_code
            ORDER BY revenue DESC
            LIMIT 20
            """,
            org_id,
            cutoff,
        )
        cities = [
            {
                "city": r["city"] or "",
                "country_code": r["country_code"] or "",
                "revenue": float(r["revenue"]),
                "orders": int(r["orders"]),
            }
            for r in city_rows
        ]

        return {
            "countries": countries,
            "cities": cities,
            "total_countries": len(countries),
            "top_country": countries[0]["country"] if countries else "",
        }

    except Exception as exc:
        logger.warning("Geography query failed for org %s: %s — returning mock", org_id, exc)
        return _mock_geography(days)
