"""Product Feed Management endpoints.

Implements CRUD for feed records, feed health scoring, AI title optimisation,
rule management, and feed push to channels (GMC + generic).

Tables used: product_feeds, feed_rules, Product (from sync pipeline)
All DB access uses asyncpg via get_pool(). Tables are created lazily —
endpoints return empty/mock data if tables don't exist yet.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.auth import verify_internal_key
from core.database import get_pool
from services.feed_health import compute_feed_health, compute_product_health_score
from services.feed_optimizer import assign_custom_labels, optimize_product_titles
from services.gmc_client import push_products_to_gmc, refresh_google_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feeds", tags=["feeds"])


# ── Pydantic Models ─────────────────────────────────────────────────────────


class CreateFeedBody(BaseModel):
    """Request body for POST /feeds."""

    org_id: str
    connector_id: str
    channel: str            # e.g. "google_shopping", "meta_catalog", "bing"
    name: str
    settings: dict = {}


class CreateRuleBody(BaseModel):
    """Request body for POST /feeds/{feed_id}/rules."""

    name: str
    priority: int = 0
    conditions: dict = {}   # e.g. {"field": "price", "op": "gt", "value": 50}
    actions: dict = {}      # e.g. {"set_label": "high_value"}
    is_active: bool = True


# ── DDL helpers (idempotent table creation) ─────────────────────────────────


async def _ensure_tables() -> None:
    """Create product_feeds and feed_rules tables if they don't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS product_feeds (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id       TEXT NOT NULL,
                connector_id TEXT NOT NULL,
                channel      TEXT NOT NULL,
                name         TEXT NOT NULL,
                settings     JSONB NOT NULL DEFAULT '{}',
                health_score INT  NOT NULL DEFAULT 0,
                last_pushed_at TIMESTAMPTZ,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feed_rules (
                id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                feed_id   UUID NOT NULL REFERENCES product_feeds(id) ON DELETE CASCADE,
                name      TEXT NOT NULL,
                priority  INT  NOT NULL DEFAULT 0,
                conditions JSONB NOT NULL DEFAULT '{}',
                actions    JSONB NOT NULL DEFAULT '{}',
                is_active  BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )


# ── Feed CRUD ────────────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_feed(body: CreateFeedBody):
    """Create a new product feed record.

    Inserts into product_feeds and returns the new feed id.
    """
    try:
        await _ensure_tables()
        pool = await get_pool()
        feed_id = await pool.fetchval(
            """
            INSERT INTO product_feeds (id, org_id, connector_id, channel, name, settings, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6)
            RETURNING id
            """,
            body.org_id,
            body.connector_id,
            body.channel,
            body.name,
            json.dumps(body.settings),
            datetime.now(timezone.utc),
        )
        return {"feed_id": str(feed_id), "message": "Feed created"}
    except Exception as exc:
        logger.error("create_feed error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_feeds(org_id: str = Query(...)):
    """List all feeds for an org, with health_score and rule count."""
    try:
        await _ensure_tables()
        pool = await get_pool()
        rows = await pool.fetch(
            """
            SELECT f.id, f.org_id, f.connector_id, f.channel, f.name,
                   f.settings, f.health_score, f.last_pushed_at, f.created_at,
                   COUNT(r.id) AS rule_count
            FROM product_feeds f
            LEFT JOIN feed_rules r ON r.feed_id = f.id
            WHERE f.org_id = $1
            GROUP BY f.id
            ORDER BY f.created_at DESC
            """,
            org_id,
        )
        feeds = []
        for row in rows:
            d = dict(row)
            d["id"] = str(d["id"])
            feeds.append(d)
        return {"feeds": feeds}
    except Exception as exc:
        logger.warning("list_feeds error: %s", exc)
        return {"feeds": []}


@router.get("/{feed_id}", dependencies=[Depends(verify_internal_key)])
async def get_feed(feed_id: str):
    """Get feed detail including its rules array."""
    try:
        await _ensure_tables()
        pool = await get_pool()
        row = await pool.fetchrow(
            """
            SELECT id, org_id, connector_id, channel, name, settings,
                   health_score, last_pushed_at, created_at
            FROM product_feeds
            WHERE id = $1
            """,
            feed_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Feed not found")

        rules = await pool.fetch(
            """
            SELECT id, feed_id, name, priority, conditions, actions, is_active, created_at
            FROM feed_rules
            WHERE feed_id = $1
            ORDER BY priority DESC, created_at
            """,
            feed_id,
        )

        result = dict(row)
        result["id"] = str(result["id"])
        result["rules"] = [dict(r) | {"id": str(r["id"]), "feed_id": str(r["feed_id"])} for r in rules]
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_feed error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{feed_id}", dependencies=[Depends(verify_internal_key)])
async def delete_feed(feed_id: str):
    """Delete a feed and all its rules (CASCADE)."""
    try:
        await _ensure_tables()
        pool = await get_pool()
        result = await pool.execute(
            "DELETE FROM product_feeds WHERE id = $1",
            feed_id,
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Feed not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("delete_feed error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Feed Health ───────────────────────────────────────────────────────────────


@router.get("/{feed_id}/health", dependencies=[Depends(verify_internal_key)])
async def feed_health(feed_id: str):
    """Compute health score for all products attached to this feed's connector.

    Queries the Product table for the feed's connector_id, runs
    compute_feed_health(), and returns aggregated scores + distribution.
    """
    try:
        await _ensure_tables()
        pool = await get_pool()

        feed_row = await pool.fetchrow(
            'SELECT connector_id FROM product_feeds WHERE id = $1',
            feed_id,
        )
        if not feed_row:
            raise HTTPException(status_code=404, detail="Feed not found")

        connector_id = feed_row["connector_id"]

        product_rows = await pool.fetch(
            """
            SELECT id, title, description, price, "imageUrl", sku, barcode,
                   tags
            FROM "Product"
            WHERE "connectorId" = $1
            """,
            connector_id,
        )
        products = [dict(r) for r in product_rows]

        health = compute_feed_health(products)

        # Persist score back to the feed record
        await pool.execute(
            "UPDATE product_feeds SET health_score = $1 WHERE id = $2",
            health["avg_score"],
            feed_id,
        )

        return {
            "feed_id": feed_id,
            "score": health["avg_score"],
            "total_products": health["total_products"],
            "issues": health["critical_issues"],
            "distribution": health["distribution"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("feed_health error: %s", exc)
        return {"feed_id": feed_id, "score": 0, "issues": [], "distribution": {}}


# ── AI Generate (Title Optimisation) ─────────────────────────────────────────


@router.post("/{feed_id}/generate", dependencies=[Depends(verify_internal_key)])
async def generate_feed(feed_id: str, org_id: str = Query(...)):
    """AI-optimise product titles for this feed.

    Fetches products from the connector, calls optimize_product_titles(),
    and returns a sample of optimised titles.
    """
    try:
        await _ensure_tables()
        pool = await get_pool()

        feed_row = await pool.fetchrow(
            'SELECT connector_id FROM product_feeds WHERE id = $1',
            feed_id,
        )
        if not feed_row:
            raise HTTPException(status_code=404, detail="Feed not found")

        connector_id = feed_row["connector_id"]
        product_rows = await pool.fetch(
            """
            SELECT id, title, description, brand, "imageUrl", price
            FROM "Product"
            WHERE "connectorId" = $1
            LIMIT 100
            """,
            connector_id,
        )
        products = [dict(r) for r in product_rows]

        if not products:
            return {"optimized_count": 0, "samples": []}

        optimized = await optimize_product_titles(products, org_id)

        return {
            "optimized_count": len(optimized),
            "samples": optimized[:5],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("generate_feed error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Push Feed ─────────────────────────────────────────────────────────────────


@router.post("/{feed_id}/push", dependencies=[Depends(verify_internal_key)])
async def push_feed(feed_id: str, org_id: str = Query(...)):
    """Push feed to its configured channel.

    For GMC channel: transforms products and calls push_products_to_gmc().
    For all channels: marks last_pushed_at = now().

    Returns {success, pushed_count, errors}.
    """
    try:
        await _ensure_tables()
        pool = await get_pool()

        feed_row = await pool.fetchrow(
            'SELECT connector_id, channel, settings FROM product_feeds WHERE id = $1',
            feed_id,
        )
        if not feed_row:
            raise HTTPException(status_code=404, detail="Feed not found")

        connector_id = str(feed_row["connector_id"])
        channel = str(feed_row["channel"])
        settings: dict = feed_row["settings"] or {}

        product_rows = await pool.fetch(
            """
            SELECT id, title, description, price, currency, "imageUrl",
                   handle, brand, sku, barcode, tags, "inventoryQty"
            FROM "Product"
            WHERE "connectorId" = $1 AND status = 'active'
            """,
            connector_id,
        )
        products = [dict(r) for r in product_rows]
        now = datetime.now(timezone.utc)

        push_result: dict = {"success": True, "pushed_count": 0, "errors": []}

        if channel == "google_shopping" and settings.get("merchant_id"):
            # Load GMC credentials
            gmc_row = await pool.fetchrow(
                """
                SELECT credentials FROM merchant_center_accounts
                WHERE org_id = $1 AND is_active = true
                LIMIT 1
                """,
                org_id,
            )
            if gmc_row:
                creds = gmc_row["credentials"]
                if isinstance(creds, str):
                    creds = json.loads(creds)

                access_token = await refresh_google_token(
                    creds.get("refresh_token", ""),
                    creds.get("client_id", ""),
                    creds.get("client_secret", ""),
                )

                if access_token:
                    merchant_id = creds.get("merchant_id", settings.get("merchant_id", ""))
                    gmc_products = [_transform_for_gmc(p, merchant_id) for p in products]
                    result = await push_products_to_gmc(merchant_id, access_token, gmc_products)
                    push_result.update({
                        "pushed_count": result["success_count"],
                        "errors": result["errors"],
                        "success": result["error_count"] == 0,
                    })
                else:
                    push_result["errors"] = ["Could not refresh Google OAuth token"]
                    push_result["success"] = False
            else:
                push_result["errors"] = ["No active GMC account found for this org"]
                push_result["success"] = False
        else:
            # Generic channel — just mark as pushed
            push_result["pushed_count"] = len(products)

        # Update last_pushed_at
        await pool.execute(
            "UPDATE product_feeds SET last_pushed_at = $1 WHERE id = $2",
            now,
            feed_id,
        )

        return push_result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("push_feed error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Feed Products ─────────────────────────────────────────────────────────────


@router.get("/{feed_id}/products", dependencies=[Depends(verify_internal_key)])
async def feed_products(
    feed_id: str,
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Paginated list of products in this feed with custom labels.

    Custom labels are computed on-the-fly from order performance data.
    """
    try:
        await _ensure_tables()
        pool = await get_pool()

        feed_row = await pool.fetchrow(
            'SELECT connector_id FROM product_feeds WHERE id = $1',
            feed_id,
        )
        if not feed_row:
            raise HTTPException(status_code=404, detail="Feed not found")

        connector_id = str(feed_row["connector_id"])

        product_rows = await pool.fetch(
            """
            SELECT id, title, description, price, currency, "imageUrl",
                   handle, brand, sku, barcode, tags, "inventoryQty",
                   "createdAt", "salesVelocity", "revenueL30d"
            FROM "Product"
            WHERE "connectorId" = $1
            ORDER BY "createdAt" DESC
            LIMIT $2 OFFSET $3
            """,
            connector_id,
            limit,
            offset,
        )
        total: int = await pool.fetchval(
            'SELECT COUNT(*) FROM "Product" WHERE "connectorId" = $1',
            connector_id,
        )

        products = [dict(r) for r in product_rows]

        # Build a lightweight orders_summary from revenueL30d / salesVelocity
        orders_summary: dict[str, dict] = {}
        for p in products:
            pid = str(p["id"])
            revenue = float(p.get("revenueL30d") or 0)
            orders_summary[pid] = {
                "revenue_total": revenue,
                "revenue_l7d": revenue / 4.3,  # rough weekly estimate
                "revenue_p7d": 0.0,
                "last_sale_at": None,
            }

        labels = assign_custom_labels(products, orders_summary)
        label_map = {item["product_id"]: item["custom_labels"] for item in labels}

        result_products = []
        for p in products:
            pid = str(p["id"])
            p["id"] = pid
            p["custom_labels"] = label_map.get(pid, {})
            result_products.append(p)

        return {
            "products": result_products,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("feed_products error: %s", exc)
        return {"products": [], "total": 0, "limit": limit, "offset": offset}


# ── Feed Rules ────────────────────────────────────────────────────────────────


@router.post("/{feed_id}/rules", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def add_rule(feed_id: str, body: CreateRuleBody):
    """Add a transformation/filter rule to a feed."""
    try:
        await _ensure_tables()
        pool = await get_pool()

        # Verify feed exists
        exists = await pool.fetchval(
            'SELECT 1 FROM product_feeds WHERE id = $1',
            feed_id,
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Feed not found")

        rule_id = await pool.fetchval(
            """
            INSERT INTO feed_rules (id, feed_id, name, priority, conditions, actions, is_active, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
            RETURNING id
            """,
            feed_id,
            body.name,
            body.priority,
            json.dumps(body.conditions),
            json.dumps(body.actions),
            body.is_active,
            datetime.now(timezone.utc),
        )
        return {"rule_id": str(rule_id), "message": "Rule added"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("add_rule error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{feed_id}/rules", dependencies=[Depends(verify_internal_key)])
async def list_rules(feed_id: str):
    """List all rules for a feed, ordered by priority descending."""
    try:
        await _ensure_tables()
        pool = await get_pool()
        rows = await pool.fetch(
            """
            SELECT id, feed_id, name, priority, conditions, actions, is_active, created_at
            FROM feed_rules
            WHERE feed_id = $1
            ORDER BY priority DESC, created_at
            """,
            feed_id,
        )
        rules = [dict(r) | {"id": str(r["id"]), "feed_id": str(r["feed_id"])} for r in rows]
        return {"rules": rules}
    except Exception as exc:
        logger.warning("list_rules error: %s", exc)
        return {"rules": []}


@router.delete("/{feed_id}/rules/{rule_id}", dependencies=[Depends(verify_internal_key)])
async def delete_rule(feed_id: str, rule_id: str):
    """Delete a rule from a feed."""
    try:
        await _ensure_tables()
        pool = await get_pool()
        result = await pool.execute(
            "DELETE FROM feed_rules WHERE id = $1 AND feed_id = $2",
            rule_id,
            feed_id,
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Rule not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("delete_rule error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Internal Helpers ──────────────────────────────────────────────────────────


def _transform_for_gmc(product: dict, merchant_id: str) -> dict:
    """Transform an internal Product row into GMC product insert format."""
    handle = product.get("handle") or str(product.get("id", ""))
    price = float(product.get("price") or 0)
    currency = product.get("currency") or "USD"

    return {
        "offerId": str(product.get("id", "")),
        "title": product.get("title") or "",
        "description": product.get("description") or "",
        "link": f"https://example.com/products/{handle}",
        "imageLink": product.get("imageUrl") or "",
        "price": {
            "value": f"{price:.2f}",
            "currency": currency,
        },
        "availability": "in stock" if int(product.get("inventoryQty") or 0) > 0 else "out of stock",
        "brand": product.get("brand") or "",
        "channel": "online",
        "contentLanguage": "en",
        "targetCountry": "US",
        "condition": "new",
    }
