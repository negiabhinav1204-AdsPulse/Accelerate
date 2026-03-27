"""Inventory health endpoints — Section 1.3.

GET /inventory/health?orgId&threshold   — Low-stock + out-of-stock alerts with velocity

Reference: Adaptiv api/app/routers/ecommerce.py /inventory endpoint (lines 757-820)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/health", dependencies=[Depends(verify_internal_key)])
async def inventory_health(
    org_id: str = Query(...),
    threshold: int = Query(10, ge=0, description="Low-stock threshold (units)"),
    connector_id: str = Query(None),
):
    """Low-stock and out-of-stock alerts with 30-day sales velocity.

    For each low-stock product, computes:
    - weekly_velocity (units/week over last 30d)
    - days_until_stockout = inventoryQty / (weekly_velocity / 7)

    Logic mirrors Adaptiv ecommerce.py /inventory.
    """
    pool = await get_pool()
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)

    conditions = ['"organizationId" = $1', '"inventoryQty" IS NOT NULL', f'"inventoryQty" < $2']
    params: list = [org_id, threshold]

    if connector_id:
        params.append(connector_id)
        conditions.append(f'"connectorId" = ${len(params)}')

    where = " AND ".join(conditions)

    low_stock_rows = await pool.fetch(
        f"""
        SELECT id, "connectorId", "externalId", title, "imageUrl",
               handle, sku, price, "inventoryQty", "salesVelocity", status
        FROM "Product"
        WHERE {where}
        ORDER BY "inventoryQty" ASC
        LIMIT 200
        """,
        *params,
    )

    if not low_stock_rows:
        return {
            "low_stock": [],
            "out_of_stock": [],
            "summary": {"low_stock_count": 0, "out_of_stock_count": 0, "at_risk_revenue": 0},
            "threshold": threshold,
        }

    # Fetch 30-day velocity from order items for each product
    product_ids = [r["id"] for r in low_stock_rows]
    velocity_rows = await pool.fetch(
        """
        SELECT oi."productId", SUM(oi.quantity) AS units_30d
        FROM "CommerceOrderItem" oi
        JOIN "CommerceOrder" o ON o.id = oi."orderId"
        WHERE oi."productId" = ANY($1::uuid[])
          AND o."placedAt" >= $2
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi."productId"
        """,
        product_ids,
        cutoff_30d,
    )
    velocity_map: dict[str, float] = {str(r["productId"]): float(r["units_30d"]) for r in velocity_rows}

    low_stock = []
    out_of_stock = []

    for r in low_stock_rows:
        pid = str(r["id"])
        inv_qty = int(r["inventoryQty"] or 0)
        units_30d = velocity_map.get(pid, 0.0)
        weekly_vel = round(units_30d / 4.3, 1)  # 30d ÷ 4.3 weeks

        days_until_stockout: float | None = None
        if weekly_vel > 0 and inv_qty > 0:
            days_until_stockout = round(inv_qty / (weekly_vel / 7), 1)

        item = {
            "product_id": pid,
            "connector_id": str(r["connectorId"]),
            "external_id": r["externalId"],
            "title": r["title"],
            "image_url": r["imageUrl"],
            "handle": r["handle"],
            "sku": r["sku"],
            "price": float(r["price"]) if r["price"] else None,
            "inventory_qty": inv_qty,
            "weekly_velocity": weekly_vel,
            "days_until_stockout": days_until_stockout,
            "status": r["status"],
        }

        if inv_qty == 0:
            out_of_stock.append(item)
        else:
            low_stock.append(item)

    # Sort by highest velocity first (most urgent)
    low_stock.sort(key=lambda x: x["weekly_velocity"] or 0, reverse=True)
    out_of_stock.sort(key=lambda x: x["weekly_velocity"] or 0, reverse=True)

    # At-risk revenue = weekly velocity × price for low-stock items
    at_risk = sum(
        (i["weekly_velocity"] or 0) * (i["price"] or 0)
        for i in low_stock + out_of_stock
    )

    return {
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "summary": {
            "low_stock_count": len(low_stock),
            "out_of_stock_count": len(out_of_stock),
            "at_risk_revenue": round(at_risk, 2),
        },
        "threshold": threshold,
    }
