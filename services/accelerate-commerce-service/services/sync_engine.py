"""Sync engine — orchestrates product + order sync from adapter → Postgres.

Section 1.2 — Sync Pipeline (accelerate-expansion.md):
  POST /connectors/:id/sync  →  QStash job  →  this engine executes the sync
  Tracks sync state via CommerceConnector.syncStatus in Postgres.
  Reference pattern: Adaptiv api/app/services/shopify_sync.py
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

from adapters.base import CommerceAdapter
from adapters.factory import get_adapter
from core.crypto import decrypt_credentials
from core.database import get_pool

logger = logging.getLogger(__name__)

# ─── Public entry point ───────────────────────────────────────────────────────


async def run_sync(connector_id: str, full_backfill: bool = False) -> dict[str, Any]:
    """Execute full sync for a connector: products + orders → Postgres.

    Called by the QStash job consumer (POST /connectors/:id/sync/job).
    """
    pool = await get_pool()

    connector = await _load_connector(pool, connector_id)
    if not connector:
        return {"error": f"Connector {connector_id} not found", "status": "error"}

    credentials = decrypt_credentials(connector["credentials"])
    adapter = get_adapter(connector["platform"], credentials)

    # Mark as SYNCING
    await _set_sync_status(pool, connector_id, "SYNCING")

    try:
        products_result = await _sync_products(pool, adapter, connector, full_backfill)
        orders_result = await _sync_orders(pool, adapter, connector, full_backfill)
        await _sync_daily_revenue(pool, connector_id, connector["organization_id"])
        await _set_sync_status(pool, connector_id, "SYNCED")

        return {
            "status": "success",
            "connector_id": connector_id,
            "products_synced": products_result["products_synced"],
            "variants_synced": products_result["variants_synced"],
            "orders_synced": orders_result["orders_synced"],
        }

    except Exception as exc:
        logger.exception("Sync failed for connector %s", connector_id)
        await _set_sync_status(pool, connector_id, "FAILED")
        return {"error": str(exc), "status": "error", "connector_id": connector_id}


# ─── Sync helpers ─────────────────────────────────────────────────────────────


async def _load_connector(pool: asyncpg.Pool, connector_id: str) -> dict | None:
    row = await pool.fetchrow(
        """
        SELECT id, "organizationId" as organization_id, platform,
               credentials, "lastSyncAt" as last_sync_at, metadata
        FROM "CommerceConnector"
        WHERE id = $1 AND "isActive" = true
        """,
        connector_id,
    )
    return dict(row) if row else None


async def _set_sync_status(pool: asyncpg.Pool, connector_id: str, status: str) -> None:
    now = datetime.now(timezone.utc)
    if status == "SYNCED":
        await pool.execute(
            """
            UPDATE "CommerceConnector"
            SET "syncStatus" = $1, "lastSyncAt" = $2, "updatedAt" = $2
            WHERE id = $3
            """,
            status, now, connector_id,
        )
    else:
        await pool.execute(
            """
            UPDATE "CommerceConnector"
            SET "syncStatus" = $1, "updatedAt" = $2
            WHERE id = $3
            """,
            status, now, connector_id,
        )


async def _sync_products(
    pool: asyncpg.Pool,
    adapter: CommerceAdapter,
    connector: dict,
    full_backfill: bool,
) -> dict[str, int]:
    connector_id = connector["id"]
    organization_id = connector["organization_id"]

    since: datetime | None = None
    if not full_backfill and connector.get("last_sync_at"):
        since = connector["last_sync_at"]
        if isinstance(since, str):
            since = datetime.fromisoformat(since)

    logger.info("Fetching products for connector %s (since=%s)", connector_id, since)
    products = await adapter.fetch_products(since=since)

    products_synced = 0
    variants_synced = 0

    for p in products:
        await _upsert_product(pool, connector_id, organization_id, p)
        products_synced += 1
        variants_synced += len(p.get("variants", []))
        for v in p.get("variants", []):
            await _upsert_variant(pool, p["external_id"], connector_id, v)

    logger.info("Products synced: %d, variants: %d", products_synced, variants_synced)
    return {"products_synced": products_synced, "variants_synced": variants_synced}


async def _sync_orders(
    pool: asyncpg.Pool,
    adapter: CommerceAdapter,
    connector: dict,
    full_backfill: bool,
) -> dict[str, int]:
    connector_id = connector["id"]
    organization_id = connector["organization_id"]

    now = datetime.now(timezone.utc)
    if full_backfill:
        since = datetime(2015, 1, 1, tzinfo=timezone.utc)
    elif connector.get("last_sync_at"):
        last = connector["last_sync_at"]
        since = last if isinstance(last, datetime) else datetime.fromisoformat(last)
    else:
        since = now - timedelta(days=90)

    logger.info("Fetching orders for connector %s (since=%s)", connector_id, since)
    orders = await adapter.fetch_orders(since=since, until=now)

    orders_synced = 0
    for o in orders:
        await _upsert_order(pool, connector_id, organization_id, o)
        orders_synced += 1

    logger.info("Orders synced: %d", orders_synced)
    return {"orders_synced": orders_synced}


async def _sync_daily_revenue(
    pool: asyncpg.Pool,
    connector_id: str,
    organization_id: str,
) -> None:
    """Recompute DailyRevenueSummary from CommerceOrder table."""
    rows = await pool.fetch(
        """
        SELECT
            date_trunc('day', "placedAt")::date AS date,
            channel,
            COALESCE(SUM(CASE WHEN status NOT IN ('voided','refunded') THEN "totalAmount" ELSE 0 END), 0) AS revenue,
            COUNT(*) FILTER (WHERE status NOT IN ('voided','refunded')) AS orders,
            currency
        FROM "CommerceOrder"
        WHERE "connectorId" = $1
        GROUP BY 1, 2, 3
        """,
        connector_id,
    )
    now = datetime.now(timezone.utc)
    for row in rows:
        await pool.execute(
            """
            INSERT INTO "DailyRevenueSummary"
              (id, "organizationId", "connectorId", date, revenue, orders, channel, currency, "createdAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT ("connectorId", date, channel) DO UPDATE
              SET revenue = EXCLUDED.revenue, orders = EXCLUDED.orders
            """,
            organization_id,
            connector_id,
            row["date"],
            row["revenue"],
            row["orders"],
            row["channel"],
            row["currency"] or "USD",
            now,
        )


# ─── Upsert helpers ───────────────────────────────────────────────────────────


async def _upsert_product(
    pool: asyncpg.Pool,
    connector_id: str,
    organization_id: str,
    p: dict,
) -> None:
    import json as _json

    now = datetime.now(timezone.utc)
    await pool.execute(
        """
        INSERT INTO "Product" (
          id, "connectorId", "organizationId", "externalId", title, description,
          price, "salePrice", currency, "imageUrl", "additionalImages",
          handle, brand, sku, barcode, status,
          "inventoryQty", tags, "customLabels", metadata, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10::text[],
          $11, $12, $13, $14, $15,
          $16, $17::text[], $18::jsonb, $19::jsonb, $20, $20
        )
        ON CONFLICT ("connectorId", "externalId") DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          "salePrice" = EXCLUDED."salePrice",
          "imageUrl" = EXCLUDED."imageUrl",
          "additionalImages" = EXCLUDED."additionalImages",
          brand = EXCLUDED.brand,
          sku = EXCLUDED.sku,
          barcode = EXCLUDED.barcode,
          status = EXCLUDED.status,
          "inventoryQty" = EXCLUDED."inventoryQty",
          tags = EXCLUDED.tags,
          metadata = EXCLUDED.metadata,
          "updatedAt" = EXCLUDED."updatedAt"
        """,
        connector_id,
        organization_id,
        p["external_id"],
        p["title"],
        p.get("description"),
        p.get("price", 0),
        p.get("sale_price"),
        p.get("currency", "USD"),
        p.get("image_url"),
        p.get("additional_images", []),
        p.get("handle"),
        p.get("brand"),
        p.get("sku"),
        p.get("barcode"),
        p.get("status", "active").upper(),
        p.get("inventory_qty"),
        p.get("tags", []),
        _json.dumps(p.get("custom_labels", {})),
        _json.dumps(p.get("metadata", {})),
        now,
    )


async def _upsert_variant(
    pool: asyncpg.Pool,
    product_external_id: str,
    connector_id: str,
    v: dict,
) -> None:
    # Look up product UUID from external_id
    row = await pool.fetchrow(
        'SELECT id FROM "Product" WHERE "connectorId" = $1 AND "externalId" = $2',
        connector_id,
        product_external_id,
    )
    if not row:
        return
    product_id = row["id"]
    await pool.execute(
        """
        INSERT INTO "ProductVariant" (id, "productId", "externalId", title, price, sku, inventory)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        """,
        product_id,
        v["external_id"],
        v.get("title", "Default"),
        v.get("price", 0),
        v.get("sku"),
        v.get("inventory"),
    )


async def _upsert_order(
    pool: asyncpg.Pool,
    connector_id: str,
    organization_id: str,
    o: dict,
) -> None:
    import json as _json

    now = datetime.now(timezone.utc)
    placed_at = o.get("placed_at")
    if isinstance(placed_at, str):
        placed_at = datetime.fromisoformat(placed_at.replace("Z", "+00:00"))
    placed_at = placed_at or now

    order_id: str = await pool.fetchval(
        """
        INSERT INTO "CommerceOrder" (
          id, "connectorId", "organizationId", "externalId",
          "customerEmail", "customerName", "totalAmount", currency,
          channel, status, "placedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        ON CONFLICT ("connectorId", "externalId") DO UPDATE SET
          "customerEmail" = EXCLUDED."customerEmail",
          "totalAmount" = EXCLUDED."totalAmount",
          status = EXCLUDED.status
        RETURNING id
        """,
        connector_id,
        organization_id,
        o["external_id"],
        o.get("customer_email"),
        o.get("customer_name"),
        o.get("total_amount", 0),
        o.get("currency", "USD"),
        o.get("channel"),
        o.get("status", "paid"),
        placed_at,
    )

    for item in o.get("items", []):
        await pool.execute(
            """
            INSERT INTO "CommerceOrderItem" (
              id, "orderId", "externalProductId", title, quantity, price
            ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            """,
            order_id,
            item.get("external_product_id"),
            item.get("title", ""),
            item.get("quantity", 1),
            item.get("price", 0),
        )
