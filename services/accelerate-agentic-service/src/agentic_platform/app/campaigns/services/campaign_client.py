"""Campaign service client — ServiceClient wrapper.

Provides typed methods for media plan CRUD, campaign creation, and
connections retrieval. Uses the platform's ServiceClient for retries,
circuit breakers, and metrics.

Auth token is read automatically from the request-scoped ContextVar
(`request_auth_token`) — no need to pass it through function arguments.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from functools import lru_cache

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.auth import request_auth_token
from src.agentic_platform.core.infra.http_client import ServiceClient
from src.agentic_platform.app.campaigns.models import ConnectionsResponse

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> ServiceClient:
    # Use accelerate_internal_url (the Next.js dashboard) as the campaign-service backend.
    # CAMPAIGN_SERVICE_URL is kept for future dedicated microservice; if it points to localhost
    # (the default), fall back to the internal dashboard URL to avoid circuit-breaker trips.
    base_url = settings.campaign_service_url
    if not base_url or "localhost" in base_url:
        base_url = settings.accelerate_internal_url
    logger.info("[campaign-client] init → %s", base_url)
    return ServiceClient("campaign-service", base_url=base_url)


def _build_headers(
    org_id: str,
    user_id: str = "",
    google_account_id: str = "",
    bing_account_id: str = "",
) -> dict[str, str]:
    headers: dict[str, str] = {"X-Org-Id": org_id}
    if user_id:
        headers["X-User-Id"] = user_id
    if google_account_id:
        headers["X-Google-Account-Id"] = google_account_id
    if bing_account_id:
        headers["X-Bing-Account-Id"] = bing_account_id
    # Internal API key — allows the Next.js dashboard to trust service-to-service calls
    if settings.internal_api_key:
        headers["X-Internal-Api-Key"] = settings.internal_api_key
    # Auto-inject auth token from request context (if present)
    token = request_auth_token.get()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ── Connections ───────────────────────────────────────────────────

async def get_connections(org_id: str) -> ConnectionsResponse:
    """Fetch connected platform accounts for an organization."""
    client = _get_client()
    headers = _build_headers(org_id)
    headers["Accept"] = "application/json"
    resp = await client.get(
        f"/api/v1/auth/{org_id}/connections",
        headers=headers,
    )
    logger.info("[campaign-client] GET connections org=%s → %s (%sms)", org_id, resp["status_code"], resp.get("elapsed_ms", "?"))
    if resp["status_code"] != 200:
        raise RuntimeError(f"Failed to fetch connections: {resp['status_code']}")
    body = resp.get("body", {})
    if not body:
        return ConnectionsResponse(organization_id=org_id, platforms={}, total_connections=0)
    return ConnectionsResponse.model_validate(body)


# ── Media Plan ────────────────────────────────────────────────────

async def create_media_plan(
    name: str, url: str, org_id: str, user_id: str = "",
    google_account_id: str = "", bing_account_id: str = "",
) -> Dict[str, Any]:
    """Create a new media plan. Returns the created plan data with 'id'."""
    client = _get_client()
    resp = await client.post(
        "/api/v3/media-plan",
        json={"name": name, "url": url},
        headers=_build_headers(org_id, user_id, google_account_id, bing_account_id),
    )
    logger.info("[campaign-client] POST /api/v3/media-plan → %s (%sms)", resp["status_code"], resp.get("elapsed_ms", "?"))
    if resp["status_code"] >= 400:
        raise RuntimeError(f"Create media plan failed ({resp['status_code']})")
    result = resp["body"].get("data", resp["body"])
    logger.info("[campaign-client] media plan created: id=%s", result.get("id"))
    return result


# ── Campaigns ─────────────────────────────────────────────────────

async def create_campaigns(
    media_plan_id: str,
    campaigns: List[Dict[str, Any]],
    org_id: str,
    user_id: str = "",
    google_account_id: str = "",
    bing_account_id: str = "",
) -> Dict[str, Any]:
    """Batch-create campaigns within a media plan."""
    url = f"/api/v3/media-plan/{media_plan_id}/campaign"
    headers = _build_headers(org_id, user_id, google_account_id, bing_account_id)
    payload = {"campaigns": campaigns}

    client = _get_client()
    resp = await client.post(url, json=payload, headers=headers, timeout=60)

    logger.info(
        "[campaign-client] POST %s → %s (%sms) [%d campaigns]",
        url, resp["status_code"], resp.get("elapsed_ms", "?"), len(campaigns),
    )
    if resp["status_code"] >= 400:
        raise RuntimeError(f"Create campaigns failed ({resp['status_code']})")
    return resp["body"]
