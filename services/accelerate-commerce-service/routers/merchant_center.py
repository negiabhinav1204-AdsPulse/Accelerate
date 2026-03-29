"""Google Merchant Center integration endpoints.

Handles GMC account connection, status checks, product diagnostics,
and full product sync (Accelerate catalog → GMC).

Table used: merchant_center_accounts
  - id UUID PK
  - org_id TEXT
  - merchant_id TEXT
  - account_name TEXT
  - credentials JSONB  (encrypted via core.crypto: {merchant_id, refresh_token, client_id, client_secret})
  - is_active BOOLEAN
  - last_sync_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ

All endpoints gracefully handle missing tables / GMC API errors.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.auth import verify_internal_key
from core.crypto import decrypt_credentials, encrypt_credentials
from core.database import get_pool
from services.feed_optimizer import optimize_product_titles
from services.gmc_client import (
    get_gmc_account_info,
    get_gmc_diagnostics,
    list_gmc_products,
    push_products_to_gmc,
    refresh_google_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/merchant-center", tags=["merchant-center"])


# ── Pydantic Models ─────────────────────────────────────────────────────────


class ConnectGMCBody(BaseModel):
    """Request body for POST /merchant-center/connect."""

    org_id: str
    merchant_id: str
    account_name: str = ""
    refresh_token: str
    client_id: str
    client_secret: str


# ── DDL helper ───────────────────────────────────────────────────────────────


async def _ensure_table() -> None:
    """Create merchant_center_accounts table if it doesn't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS merchant_center_accounts (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id       TEXT NOT NULL,
                merchant_id  TEXT NOT NULL,
                account_name TEXT NOT NULL DEFAULT '',
                credentials  JSONB NOT NULL DEFAULT '{}',
                is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                last_sync_at TIMESTAMPTZ,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/connect", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_internal_key)])
async def connect_merchant_center(body: ConnectGMCBody):
    """Save or update a Google Merchant Center account connection.

    Credentials are AES-256 encrypted before storage. Returns {ok, merchant_id}.
    """
    try:
        await _ensure_table()
        pool = await get_pool()

        # Store sensitive fields encrypted
        raw_creds = {
            "merchant_id": body.merchant_id,
            "refresh_token": body.refresh_token,
            "client_id": body.client_id,
            "client_secret": body.client_secret,
        }
        encrypted = encrypt_credentials(raw_creds)

        now = datetime.now(timezone.utc)

        existing = await pool.fetchrow(
            "SELECT id FROM merchant_center_accounts WHERE org_id = $1 AND merchant_id = $2",
            body.org_id,
            body.merchant_id,
        )

        if existing:
            await pool.execute(
                """
                UPDATE merchant_center_accounts
                SET account_name = $1,
                    credentials  = $2::jsonb,
                    is_active    = TRUE
                WHERE id = $3
                """,
                body.account_name or body.merchant_id,
                json.dumps({"encrypted": encrypted}),
                str(existing["id"]),
            )
            logger.info("Updated GMC account %s for org %s", body.merchant_id, body.org_id)
        else:
            await pool.execute(
                """
                INSERT INTO merchant_center_accounts
                  (id, org_id, merchant_id, account_name, credentials, is_active, created_at)
                VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, TRUE, $5)
                """,
                body.org_id,
                body.merchant_id,
                body.account_name or body.merchant_id,
                json.dumps({"encrypted": encrypted}),
                now,
            )
            logger.info("Created GMC account %s for org %s", body.merchant_id, body.org_id)

        return {"ok": True, "merchant_id": body.merchant_id}

    except Exception as exc:
        logger.error("connect_merchant_center error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/status", dependencies=[Depends(verify_internal_key)])
async def merchant_center_status(org_id: str = Query(...)):
    """Get GMC connection status and live account stats.

    Loads account from DB, refreshes token, calls GMC account info and
    product list endpoints. Returns {connected, merchant_id, account_name,
    product_count, last_sync_at}.
    """
    try:
        await _ensure_table()
        pool = await get_pool()

        row = await pool.fetchrow(
            """
            SELECT merchant_id, account_name, credentials, last_sync_at
            FROM merchant_center_accounts
            WHERE org_id = $1 AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
            """,
            org_id,
        )

        if not row:
            return {
                "connected": False,
                "merchant_id": None,
                "account_name": None,
                "product_count": 0,
                "last_sync_at": None,
            }

        merchant_id = str(row["merchant_id"])
        account_name = str(row["account_name"])
        last_sync_at = row["last_sync_at"]

        creds = _load_creds(row["credentials"])
        access_token = await refresh_google_token(
            creds.get("refresh_token", ""),
            creds.get("client_id", ""),
            creds.get("client_secret", ""),
        )

        product_count = 0
        if access_token:
            # Get live product count from GMC
            gmc_products = await list_gmc_products(merchant_id, access_token, max_results=1)
            # GMC doesn't return total count in list — use a broader fetch
            all_products = await list_gmc_products(merchant_id, access_token, max_results=250)
            product_count = len(all_products)

            # Refresh account name from GMC if available
            account_info = await get_gmc_account_info(merchant_id, access_token)
            if account_info.get("name"):
                account_name = account_info["name"]

        return {
            "connected": True,
            "merchant_id": merchant_id,
            "account_name": account_name,
            "product_count": product_count,
            "last_sync_at": last_sync_at.isoformat() if last_sync_at else None,
        }

    except Exception as exc:
        logger.warning("merchant_center_status error: %s", exc)
        return {
            "connected": False,
            "merchant_id": None,
            "account_name": None,
            "product_count": 0,
            "last_sync_at": None,
        }


@router.get("/diagnostics", dependencies=[Depends(verify_internal_key)])
async def merchant_center_diagnostics(org_id: str = Query(...)):
    """Fetch product disapproval issues from Google Merchant Center.

    Returns {issues[], total_disapproved, top_issues[]}.
    """
    try:
        await _ensure_table()
        pool = await get_pool()

        row = await pool.fetchrow(
            """
            SELECT merchant_id, credentials
            FROM merchant_center_accounts
            WHERE org_id = $1 AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
            """,
            org_id,
        )

        if not row:
            return {"issues": [], "total_disapproved": 0, "top_issues": []}

        merchant_id = str(row["merchant_id"])
        creds = _load_creds(row["credentials"])

        access_token = await refresh_google_token(
            creds.get("refresh_token", ""),
            creds.get("client_id", ""),
            creds.get("client_secret", ""),
        )
        if not access_token:
            return {"issues": [], "total_disapproved": 0, "top_issues": [], "error": "Token refresh failed"}

        issues = await get_gmc_diagnostics(merchant_id, access_token)

        # Aggregate top issues by reason/detail
        issue_types: list[str] = []
        for product_issue in issues:
            for issue in product_issue.get("issues", []):
                desc = issue.get("detail") or issue.get("attribute_name") or "Unknown issue"
                issue_types.append(desc)

        top_issues_counter = Counter(issue_types).most_common(10)
        top_issues = [{"issue": k, "count": v} for k, v in top_issues_counter]

        return {
            "issues": issues,
            "total_disapproved": len(issues),
            "top_issues": top_issues,
        }

    except Exception as exc:
        logger.warning("merchant_center_diagnostics error: %s", exc)
        return {"issues": [], "total_disapproved": 0, "top_issues": []}


@router.post("/push", dependencies=[Depends(verify_internal_key)])
async def merchant_center_push(org_id: str = Query(...)):
    """Full sync: fetch org products → AI-optimise titles → push to GMC.

    Updates last_sync_at on success. Returns {pushed, errors, message}.
    """
    try:
        await _ensure_table()
        pool = await get_pool()

        row = await pool.fetchrow(
            """
            SELECT id, merchant_id, credentials
            FROM merchant_center_accounts
            WHERE org_id = $1 AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
            """,
            org_id,
        )

        if not row:
            raise HTTPException(status_code=404, detail="No active GMC account found. Connect first via POST /merchant-center/connect")

        account_id = str(row["id"])
        merchant_id = str(row["merchant_id"])
        creds = _load_creds(row["credentials"])

        access_token = await refresh_google_token(
            creds.get("refresh_token", ""),
            creds.get("client_id", ""),
            creds.get("client_secret", ""),
        )
        if not access_token:
            raise HTTPException(status_code=401, detail="Could not refresh Google OAuth token — please reconnect GMC account")

        # Fetch active products for this org
        product_rows = await pool.fetch(
            """
            SELECT p.id, p.title, p.description, p.price, p.currency,
                   p."imageUrl", p.handle, p.brand, p.sku, p.barcode,
                   p.tags, p."inventoryQty"
            FROM "Product" p
            JOIN "CommerceConnector" c ON c.id = p."connectorId"
            WHERE c."organizationId" = $1
              AND p.status = 'active'
            """,
            org_id,
        )
        products = [dict(r) for r in product_rows]

        if not products:
            return {"pushed": 0, "errors": [], "message": "No active products found for this org"}

        # AI-optimise titles
        try:
            optimized = await optimize_product_titles(products, org_id)
            opt_map = {item["product_id"]: item for item in optimized}
        except Exception as exc:
            logger.warning("Title optimisation failed, using originals: %s", exc)
            opt_map = {}

        # Transform to GMC format
        gmc_products = []
        for p in products:
            pid = str(p["id"])
            opt = opt_map.get(pid, {})
            gmc_products.append(_transform_for_gmc(p, opt, merchant_id))

        # Push to GMC
        result = await push_products_to_gmc(merchant_id, access_token, gmc_products)

        # Update last_sync_at
        now = datetime.now(timezone.utc)
        await pool.execute(
            "UPDATE merchant_center_accounts SET last_sync_at = $1 WHERE id = $2",
            now,
            account_id,
        )

        message = (
            f"Pushed {result['success_count']} products to GMC"
            + (f" with {result['error_count']} errors" if result["error_count"] else " successfully")
        )

        return {
            "pushed": result["success_count"],
            "errors": result["errors"],
            "message": message,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("merchant_center_push error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Internal Helpers ──────────────────────────────────────────────────────────


def _load_creds(credentials_field) -> dict:
    """Decode and decrypt credentials stored in the merchant_center_accounts table.

    The credentials column stores JSON: {"encrypted": "<base64-encrypted-string>"}.
    Falls back to returning the raw dict if decryption fails (dev/test path).
    """
    if isinstance(credentials_field, str):
        try:
            credentials_field = json.loads(credentials_field)
        except json.JSONDecodeError:
            return {}

    if isinstance(credentials_field, dict):
        encrypted_str = credentials_field.get("encrypted")
        if encrypted_str:
            try:
                return decrypt_credentials(encrypted_str)
            except Exception as exc:
                logger.warning("Credential decryption failed, returning raw: %s", exc)
                # Return without the 'encrypted' wrapper key
                return {k: v for k, v in credentials_field.items() if k != "encrypted"}
        return credentials_field

    return {}


def _transform_for_gmc(product: dict, optimized: dict, merchant_id: str) -> dict:
    """Transform an internal Product row + optimised titles into GMC product format."""
    handle = product.get("handle") or str(product.get("id", ""))
    price = float(product.get("price") or 0)
    currency = product.get("currency") or "USD"
    inventory = int(product.get("inventoryQty") or 0)

    return {
        "offerId": str(product.get("id", "")),
        "title": (optimized.get("optimized_title") or product.get("title") or "")[:150],
        "description": (optimized.get("optimized_description") or product.get("description") or "")[:5000],
        "link": f"https://example.com/products/{handle}",
        "imageLink": product.get("imageUrl") or "",
        "price": {
            "value": f"{price:.2f}",
            "currency": currency,
        },
        "availability": "in stock" if inventory > 0 else "out of stock",
        "brand": product.get("brand") or "",
        "channel": "online",
        "contentLanguage": "en",
        "targetCountry": "US",
        "condition": "new",
    }
