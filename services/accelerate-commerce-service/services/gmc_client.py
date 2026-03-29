"""Google Merchant Center API client.

Thin async wrapper around the Google Content API for Shopping v2.1.
All methods return empty / error dicts if the GMC API is unavailable,
so callers can degrade gracefully.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GMC_BASE_URL = "https://shoppingcontent.googleapis.com/content/v2.1"
BATCH_SIZE = 100  # Max products per custombatch request


# ── OAuth Token Refresh ─────────────────────────────────────────────────────


async def refresh_google_token(refresh_token: str, client_id: str, client_secret: str) -> str | None:
    """Refresh a Google OAuth2 access token.

    POSTs to https://oauth2.googleapis.com/token with the given credentials
    and returns the new access token, or None on failure.

    Args:
        refresh_token: The stored Google OAuth2 refresh token.
        client_id: Google OAuth2 client ID.
        client_secret: Google OAuth2 client secret.

    Returns:
        A fresh access token string, or None if the refresh failed.
    """
    if not refresh_token or not client_id or not client_secret:
        logger.warning("refresh_google_token: missing credentials — skipping refresh")
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            access_token = data.get("access_token")
            if access_token:
                logger.info("Google OAuth token refreshed successfully")
            return access_token
    except Exception as exc:
        logger.error("Google token refresh failed: %s", exc)
        return None


# ── Account Info ────────────────────────────────────────────────────────────


async def get_gmc_account_info(merchant_id: str, access_token: str) -> dict:
    """Fetch basic account info from Google Merchant Center.

    GET {GMC_BASE_URL}/{merchantId}/accounts/{merchantId}

    Args:
        merchant_id: The numeric Merchant Center account ID (as string).
        access_token: A valid Google OAuth2 access token.

    Returns:
        Dict with at least 'name' and 'websiteUrl', or {} on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{GMC_BASE_URL}/{merchant_id}/accounts/{merchant_id}",
                headers=_auth_headers(access_token),
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "merchant_id": merchant_id,
                    "name": data.get("name", ""),
                    "website_url": data.get("websiteUrl", ""),
                    "raw": data,
                }
            logger.warning("get_gmc_account_info: status %d for merchant %s", resp.status_code, merchant_id)
            return {}
    except Exception as exc:
        logger.error("get_gmc_account_info failed: %s", exc)
        return {}


# ── List Products ───────────────────────────────────────────────────────────


async def list_gmc_products(merchant_id: str, access_token: str, max_results: int = 250) -> list[dict]:
    """List products currently in Google Merchant Center.

    GET {GMC_BASE_URL}/{merchantId}/products

    Args:
        merchant_id: The numeric Merchant Center account ID.
        access_token: A valid Google OAuth2 access token.
        max_results: Maximum number of products to return (default 250).

    Returns:
        List of GMC product dicts, or [] on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GMC_BASE_URL}/{merchant_id}/products",
                headers=_auth_headers(access_token),
                params={"maxResults": max_results},
            )
            if resp.status_code == 200:
                return resp.json().get("resources", [])
            logger.warning("list_gmc_products: status %d for merchant %s", resp.status_code, merchant_id)
            return []
    except Exception as exc:
        logger.error("list_gmc_products failed: %s", exc)
        return []


# ── Push Products (Batch) ───────────────────────────────────────────────────


async def push_products_to_gmc(merchant_id: str, access_token: str, products: list[dict]) -> dict:
    """Batch insert/update products in Google Merchant Center.

    Uses the products.custombatch endpoint to push up to BATCH_SIZE products
    per request. Multiple requests are made for larger catalogs.

    Args:
        merchant_id: The numeric Merchant Center account ID.
        access_token: A valid Google OAuth2 access token.
        products: List of GMC-formatted product dicts (see _transform_product_for_gmc
                  in routers/merchant_center.py for the expected shape).

    Returns:
        {success_count: int, error_count: int, errors: list[dict]}
    """
    if not products:
        return {"success_count": 0, "error_count": 0, "errors": []}

    success_count = 0
    error_count = 0
    all_errors: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            for batch_start in range(0, len(products), BATCH_SIZE):
                batch = products[batch_start: batch_start + BATCH_SIZE]
                entries = [
                    {
                        "batchId": i,
                        "merchantId": merchant_id,
                        "method": "insert",
                        "product": p,
                    }
                    for i, p in enumerate(batch)
                ]
                payload = {"entries": entries}
                resp = await client.post(
                    f"{GMC_BASE_URL}/products/custombatch",
                    headers=_auth_headers(access_token),
                    json=payload,
                )

                if resp.status_code not in (200, 201):
                    logger.error(
                        "push_products_to_gmc batch error %d: %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    error_count += len(batch)
                    all_errors.append({"batch_start": batch_start, "http_status": resp.status_code})
                    continue

                response_data = resp.json()
                for entry in response_data.get("entries", []):
                    if entry.get("errors"):
                        error_count += 1
                        for err in entry["errors"].get("errors", []):
                            all_errors.append({
                                "batch_id": entry.get("batchId"),
                                "reason": err.get("reason"),
                                "message": err.get("message"),
                            })
                    else:
                        success_count += 1

    except Exception as exc:
        logger.error("push_products_to_gmc failed: %s", exc)
        return {
            "success_count": success_count,
            "error_count": error_count + (len(products) - success_count - error_count),
            "errors": all_errors + [{"error": str(exc)}],
        }

    return {"success_count": success_count, "error_count": error_count, "errors": all_errors}


# ── Product Diagnostics ─────────────────────────────────────────────────────


async def get_gmc_diagnostics(merchant_id: str, access_token: str) -> list[dict]:
    """Fetch product status / disapproval issues from Google Merchant Center.

    GET {GMC_BASE_URL}/{merchantId}/productstatuses

    Args:
        merchant_id: The numeric Merchant Center account ID.
        access_token: A valid Google OAuth2 access token.

    Returns:
        List of {product_id, title, issues: list[{servability, resolution, detail}]},
        or [] on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GMC_BASE_URL}/{merchant_id}/productstatuses",
                headers=_auth_headers(access_token),
                params={"maxResults": 250},
            )
            if resp.status_code != 200:
                logger.warning(
                    "get_gmc_diagnostics: status %d for merchant %s", resp.status_code, merchant_id
                )
                return []

            resources = resp.json().get("resources", [])
            result = []
            for item in resources:
                issues_raw = item.get("itemLevelIssues", [])
                issues = [
                    {
                        "servability": issue.get("servability", ""),
                        "resolution": issue.get("resolution", ""),
                        "detail": issue.get("detail", ""),
                        "attribute_name": issue.get("attributeName", ""),
                    }
                    for issue in issues_raw
                ]
                if issues:
                    result.append({
                        "product_id": item.get("productId", ""),
                        "title": item.get("title", ""),
                        "issues": issues,
                    })
            return result
    except Exception as exc:
        logger.error("get_gmc_diagnostics failed: %s", exc)
        return []


# ── Internal Helpers ────────────────────────────────────────────────────────


def _auth_headers(access_token: str) -> dict[str, str]:
    """Return standard GMC auth headers."""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
