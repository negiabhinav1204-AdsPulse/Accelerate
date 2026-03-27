"""Product endpoints — Section 1.3.

GET /products?connectorId&status&search&page&limit  — paginated catalog
GET /products/suggestions?orgId&limit               — ranked by sales velocity
GET /products/:id                                   — product detail + variants
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/products", tags=["products"])


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get("/suggestions", dependencies=[Depends(verify_internal_key)])
async def product_suggestions(
    org_id: str = Query(...),
    limit: int = Query(20, ge=1, le=50),
):
    """Products ranked by 30-day sales velocity — for AI campaign targeting.

    Logic mirrors Adaptiv api/app/services/ad_creator.py get_product_suggestions():
    rank by units sold in last 30 days, annotate with tag + recommendation.
    """
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT
            p.id,
            p."externalId",
            p.title,
            p."imageUrl",
            p.price,
            p.currency,
            p.status,
            p."salesVelocity",
            p."revenueL30d",
            p.sku,
            p.brand,
            p.handle,
            COALESCE(SUM(oi.quantity), 0)        AS units_30d,
            COALESCE(SUM(oi."unitPrice" * oi.quantity), 0) AS revenue_30d,
            COUNT(DISTINCT oi."orderId")          AS orders_30d
        FROM "Product" p
        LEFT JOIN "CommerceOrderItem" oi
               ON oi."productId" = p.id
              AND oi."createdAt" >= NOW() - INTERVAL '30 days'
        WHERE p."organizationId" = $1
          AND p.status = 'active'
        GROUP BY p.id
        ORDER BY units_30d DESC, revenue_30d DESC
        LIMIT $2
        """,
        org_id,
        limit,
    )

    products = [dict(r) for r in rows]
    max_revenue = float(products[0]["revenue_30d"]) if products else 1.0
    total = len(products)

    for rank, p in enumerate(products, 1):
        p["tag"], p["ai_recommendation"] = _classify(
            rank=rank,
            total=total,
            revenue=float(p["revenue_30d"]),
            max_revenue=max_revenue,
            orders=int(p["orders_30d"]),
        )
        p["ai_recommended"] = rank <= 3

    return {"products": products, "total": total}


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_products(
    connector_id: str = Query(None),
    org_id: str = Query(None),
    status: str = Query(None),
    search: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Paginated product catalog. Filter by connector, status, or search term."""
    if not connector_id and not org_id:
        raise HTTPException(status_code=400, detail="connector_id or org_id required")

    pool = await get_pool()
    offset = (page - 1) * limit

    conditions = []
    params: list = []

    if connector_id:
        params.append(connector_id)
        conditions.append(f'"connectorId" = ${len(params)}')
    if org_id:
        params.append(org_id)
        conditions.append(f'"organizationId" = ${len(params)}')
    if status:
        params.append(status)
        conditions.append(f'status = ${len(params)}::"ProductStatus"')
    if search:
        params.append(f"%{search}%")
        conditions.append(f'(title ILIKE ${len(params)} OR sku ILIKE ${len(params)} OR brand ILIKE ${len(params)})')

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    params.extend([limit, offset])
    rows = await pool.fetch(
        f"""
        SELECT id, "connectorId", "externalId", title, description,
               price, "salePrice", currency, "imageUrl", handle,
               brand, sku, barcode, status, "inventoryQty",
               tags, "salesVelocity", "revenueL30d", "createdAt", "updatedAt"
        FROM "Product"
        {where}
        ORDER BY "createdAt" DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )

    count_params = params[:-2]
    total: int = await pool.fetchval(
        f'SELECT COUNT(*) FROM "Product" {where}',
        *count_params,
    )

    return {
        "products": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),  # ceiling division
    }


@router.get("/{product_id}", dependencies=[Depends(verify_internal_key)])
async def get_product(product_id: str):
    """Product detail with variants and 30-day performance metrics."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        SELECT p.*,
               COALESCE(SUM(oi.quantity), 0)                       AS units_30d,
               COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)      AS revenue_30d,
               COUNT(DISTINCT oi."orderId")                        AS orders_30d
        FROM "Product" p
        LEFT JOIN "CommerceOrderItem" oi
               ON oi."productId" = p.id
              AND oi."createdAt" >= NOW() - INTERVAL '30 days'
        WHERE p.id = $1
        GROUP BY p.id
        """,
        product_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    variants = await pool.fetch(
        'SELECT * FROM "ProductVariant" WHERE "productId" = $1 ORDER BY price',
        product_id,
    )

    result = dict(row)
    result["variants"] = [dict(v) for v in variants]
    return result


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _classify(rank: int, total: int, revenue: float, max_revenue: float, orders: int) -> tuple[str, str]:
    """Tag + recommendation logic — mirrors Adaptiv ecommerce.py _classify_product()."""
    pct_of_top = (revenue / max_revenue * 100) if max_revenue > 0 else 0

    if rank == 1 or pct_of_top >= 60:
        return "Top Seller", "Top Seller — scale spend aggressively. Use as hero product in broad campaigns."
    if pct_of_top >= 30:
        return "Rising", "Rising product — increase budget by 20-30%. Test new audiences."
    if orders <= 2 and revenue > 0:
        return "New", "New Product — build awareness first. Try influencer seeding before scaling."
    if pct_of_top < 20 and orders >= 3:
        return "Hidden Gem", "Hidden Gem — underexposed with loyal buyers. Great for retargeting."
    return "Steady", "Steady performer — maintain strategy. Consider bundling or upsell campaigns."
