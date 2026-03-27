"""Commerce connector endpoints — Section 1.3 (partial).

Implements:
  POST   /connectors              — Create connector
  GET    /connectors?orgId=       — List connectors
  GET    /connectors/:id          — Get connector + sync status
  POST   /connectors/:id/sync     — Trigger async sync via QStash (Section 1.2)
  POST   /connectors/:id/sync/job — QStash job consumer (runs actual sync)
  DELETE /connectors/:id          — Disconnect
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from adapters.factory import get_adapter
from core.auth import verify_internal_key
from core.config import get_settings
from core.crypto import decrypt_credentials, encrypt_credentials
from core.database import get_pool
from services.sync_engine import run_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/connectors", tags=["connectors"])


# ─── Pydantic models ──────────────────────────────────────────────────────────


class CreateConnectorBody(BaseModel):
    org_id: str
    platform: str          # shopify | woocommerce | wix | bigcommerce | csv | manual
    name: str
    credentials: dict      # will be AES-256 encrypted before storage


class SyncJobBody(BaseModel):
    connector_id: str
    full_backfill: bool = False


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_connector(body: CreateConnectorBody):
    """Create a new commerce connector after validating credentials."""
    pool = await get_pool()

    # Test connection before saving
    try:
        adapter = get_adapter(body.platform, body.credentials)
        ok = await adapter.test_connection()
        if not ok:
            raise HTTPException(status_code=400, detail="Could not connect — check credentials")
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    encrypted = encrypt_credentials(body.credentials)
    now = datetime.now(timezone.utc)

    # Derive metadata from credentials (non-sensitive public fields)
    metadata: dict = {
        "store_url": body.credentials.get("store_url"),
        "currency": body.credentials.get("currency", "USD"),
    }

    connector_id: str = await pool.fetchval(
        """
        INSERT INTO "CommerceConnector"
          (id, "organizationId", platform, name, credentials, "syncStatus",
           "isActive", metadata, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, 'PENDING',
                true, $5::jsonb, $6, $6)
        RETURNING id
        """,
        body.org_id,
        body.platform,
        body.name,
        json.dumps(encrypted),
        json.dumps(metadata),
        now,
    )

    return {"connector_id": connector_id, "message": "Connector created. Trigger /sync to import data."}


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_connectors(org_id: str):
    """List all active commerce connectors for an org."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, "organizationId", platform, name, "syncStatus",
               "lastSyncAt", "isActive", metadata, "createdAt"
        FROM "CommerceConnector"
        WHERE "organizationId" = $1 AND "isActive" = true
        ORDER BY "createdAt" DESC
        """,
        org_id,
    )
    return {"connectors": [dict(r) for r in rows]}


@router.get("/{connector_id}", dependencies=[Depends(verify_internal_key)])
async def get_connector(connector_id: str):
    """Get connector details including sync status."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, "organizationId", platform, name, "syncStatus",
               "lastSyncAt", "isActive", metadata, "createdAt"
        FROM "CommerceConnector"
        WHERE id = $1
        """,
        connector_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Connector not found")

    # Attach product + order counts
    counts = await pool.fetchrow(
        """
        SELECT
          (SELECT COUNT(*) FROM "Product" WHERE "connectorId" = $1) AS product_count,
          (SELECT COUNT(*) FROM "CommerceOrder" WHERE "connectorId" = $1) AS order_count
        """,
        connector_id,
    )
    result = dict(row)
    result["product_count"] = counts["product_count"]
    result["order_count"] = counts["order_count"]
    return result


@router.post("/{connector_id}/sync", dependencies=[Depends(verify_internal_key)])
async def trigger_sync(connector_id: str, full_backfill: bool = False):
    """Enqueue an async sync job via QStash (Section 1.2).

    Returns immediately — sync runs in background.
    If QStash is not configured, runs synchronously (dev mode).
    """
    settings = get_settings()

    if settings.qstash_token and settings.service_url:
        # Production path — enqueue via QStash
        job_url = f"{settings.service_url}/connectors/{connector_id}/sync/job"
        payload = json.dumps({"connector_id": connector_id, "full_backfill": full_backfill})
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.qstash_url}/v2/publish/{job_url}",
                headers={
                    "Authorization": f"Bearer {settings.qstash_token}",
                    "Content-Type": "application/json",
                },
                content=payload,
            )
        if resp.status_code not in (200, 201, 202):
            logger.error("QStash enqueue failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Failed to enqueue sync job")

        return {"status": "queued", "connector_id": connector_id, "full_backfill": full_backfill}

    # Dev mode — run synchronously
    logger.info("QStash not configured — running sync synchronously (dev mode)")
    result = await run_sync(connector_id, full_backfill=full_backfill)
    return result


@router.post("/{connector_id}/sync/job")
async def sync_job_consumer(connector_id: str, body: SyncJobBody):
    """QStash webhook callback — executes the actual sync.

    This endpoint is called by QStash (no INTERNAL_API_KEY, uses QStash signature).
    In dev mode it's called directly by trigger_sync above.
    """
    # TODO: verify QStash signature (add upstash-qstash library)
    result = await run_sync(body.connector_id or connector_id, full_backfill=body.full_backfill)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@router.delete("/{connector_id}", dependencies=[Depends(verify_internal_key)])
async def delete_connector(connector_id: str, org_id: str):
    """Soft-delete a connector (set isActive=False)."""
    pool = await get_pool()
    result = await pool.execute(
        """
        UPDATE "CommerceConnector"
        SET "isActive" = false, "updatedAt" = $1
        WHERE id = $2 AND "organizationId" = $3
        """,
        datetime.now(timezone.utc),
        connector_id,
        org_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Connector not found")
    return {"success": True}
