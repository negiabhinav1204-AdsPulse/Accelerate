"""Revenue endpoints — Section 1.3.

GET /revenue/summary?orgId&days         — KPI summary (revenue, orders, AOV, by-channel)
GET /revenue/daily?orgId&from&to        — Daily time series
GET /revenue/by-product?orgId&days      — Top products by revenue
GET /revenue/by-channel?orgId&days      — Revenue by channel

Reference: Adaptiv api/app/routers/ecommerce.py /overview endpoint (lines 254-355)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/revenue", tags=["revenue"])


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get("/summary", dependencies=[Depends(verify_internal_key)])
async def revenue_summary(
    org_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
):
    """KPI summary card data — total revenue, orders, AOV, repeat rate, channel breakdown.

    Reads from DailyRevenueSummary (fast pre-aggregated) + CommerceOrder for
    customer-level metrics. Mirrors Adaptiv ecommerce.py /overview structure.
    """
    pool = await get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    prev_cutoff = cutoff - timedelta(days=days)

    # Current period from DailyRevenueSummary
    current = await pool.fetchrow(
        """
        SELECT
            COALESCE(SUM(revenue), 0)          AS total_revenue,
            COALESCE(SUM(orders), 0)           AS total_orders,
            COALESCE(SUM("newCustomers"), 0)   AS new_customers
        FROM "DailyRevenueSummary"
        WHERE "organizationId" = $1 AND date >= $2
        """,
        org_id,
        cutoff.date(),
    )

    # Previous period for % change
    prev = await pool.fetchrow(
        """
        SELECT COALESCE(SUM(revenue), 0) AS total_revenue,
               COALESCE(SUM(orders), 0)  AS total_orders
        FROM "DailyRevenueSummary"
        WHERE "organizationId" = $1 AND date >= $2 AND date < $3
        """,
        org_id,
        prev_cutoff.date(),
        cutoff.date(),
    )

    total_rev = float(current["total_revenue"])
    total_orders = int(current["total_orders"])
    prev_rev = float(prev["total_revenue"])
    prev_orders = int(prev["total_orders"])

    aov = round(total_rev / total_orders, 2) if total_orders > 0 else 0.0
    prev_aov = round(prev_rev / prev_orders, 2) if prev_orders > 0 else 0.0

    def pct_change(curr: float, prev: float) -> float | None:
        if prev == 0:
            return None
        return round((curr - prev) / prev * 100, 1)

    # Channel breakdown from CommerceOrder
    channel_rows = await pool.fetch(
        """
        SELECT channel,
               COUNT(*)             AS orders,
               SUM("totalAmount")   AS revenue
        FROM "CommerceOrder"
        WHERE "organizationId" = $1
          AND "placedAt" >= $2
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY channel
        ORDER BY revenue DESC
        """,
        org_id,
        cutoff,
    )

    by_channel = {
        r["channel"]: {
            "orders": int(r["orders"]),
            "revenue": round(float(r["revenue"]), 2),
        }
        for r in channel_rows
    }

    return {
        "period_days": days,
        "revenue": {
            "current": round(total_rev, 2),
            "previous": round(prev_rev, 2),
            "change_pct": pct_change(total_rev, prev_rev),
        },
        "orders": {
            "current": total_orders,
            "previous": prev_orders,
            "change_pct": pct_change(total_orders, prev_orders),
        },
        "aov": {
            "current": aov,
            "previous": prev_aov,
            "change_pct": pct_change(aov, prev_aov),
        },
        "new_customers": int(current["new_customers"]),
        "by_channel": by_channel,
    }


@router.get("/daily", dependencies=[Depends(verify_internal_key)])
async def revenue_daily(
    org_id: str = Query(...),
    from_date: date = Query(None, alias="from"),
    to_date: date = Query(None, alias="to"),
    days: int = Query(30, ge=1, le=365),
):
    """Daily revenue + orders time series for charts."""
    pool = await get_pool()

    if from_date and to_date:
        start, end = from_date, to_date
    else:
        end = date.today()
        start = end - timedelta(days=days)

    rows = await pool.fetch(
        """
        SELECT date, SUM(revenue) AS revenue, SUM(orders) AS orders,
               SUM("netRevenue") AS net_revenue
        FROM "DailyRevenueSummary"
        WHERE "organizationId" = $1 AND date >= $2 AND date <= $3
        GROUP BY date
        ORDER BY date
        """,
        org_id,
        start,
        end,
    )

    return {
        "data": [
            {
                "date": str(r["date"]),
                "revenue": round(float(r["revenue"]), 2),
                "orders": int(r["orders"]),
                "net_revenue": round(float(r["net_revenue"]), 2),
            }
            for r in rows
        ],
        "from": str(start),
        "to": str(end),
    }


@router.get("/by-product", dependencies=[Depends(verify_internal_key)])
async def revenue_by_product(
    org_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
):
    """Top products by revenue — for leaderboard / campaign targeting."""
    pool = await get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await pool.fetch(
        """
        SELECT
            oi."productId"                        AS product_id,
            oi.title,
            SUM(oi.quantity)                      AS units_sold,
            ROUND(SUM(oi."unitPrice" * oi.quantity)::numeric, 2) AS revenue,
            COUNT(DISTINCT oi."orderId")           AS orders,
            p."imageUrl"                          AS image_url,
            p.handle
        FROM "CommerceOrderItem" oi
        LEFT JOIN "Product" p ON p.id = oi."productId"
        JOIN "CommerceOrder" o ON o.id = oi."orderId"
        WHERE o."organizationId" = $1
          AND o."placedAt" >= $2
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi."productId", oi.title, p."imageUrl", p.handle
        ORDER BY revenue DESC
        LIMIT $3
        """,
        org_id,
        cutoff,
        limit,
    )

    return {
        "products": [
            {
                "product_id": str(r["product_id"]) if r["product_id"] else None,
                "title": r["title"],
                "units_sold": int(r["units_sold"]),
                "revenue": float(r["revenue"]),
                "orders": int(r["orders"]),
                "image_url": r["image_url"],
                "handle": r["handle"],
                "aov": round(float(r["revenue"]) / int(r["orders"]), 2) if r["orders"] else 0,
            }
            for r in rows
        ],
        "period_days": days,
    }


@router.get("/by-channel", dependencies=[Depends(verify_internal_key)])
async def revenue_by_channel(
    org_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
):
    """Revenue breakdown by channel — Online Store, POS, B2B, etc."""
    pool = await get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await pool.fetch(
        """
        SELECT
            channel,
            COUNT(*)                AS orders,
            SUM("totalAmount")      AS revenue,
            AVG("totalAmount")      AS aov
        FROM "CommerceOrder"
        WHERE "organizationId" = $1
          AND "placedAt" >= $2
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY channel
        ORDER BY revenue DESC
        """,
        org_id,
        cutoff,
    )

    total_rev = sum(float(r["revenue"]) for r in rows)

    return {
        "channels": [
            {
                "channel": r["channel"],
                "orders": int(r["orders"]),
                "revenue": round(float(r["revenue"]), 2),
                "aov": round(float(r["aov"]), 2),
                "share_pct": round(float(r["revenue"]) / total_rev * 100, 1) if total_rev > 0 else 0,
            }
            for r in rows
        ],
        "total_revenue": round(total_rev, 2),
        "period_days": days,
    }
