"""Audience segment endpoints — Section 1.4.

POST /segments                          — Create segment with rules
GET  /segments?orgId                    — List segments
GET  /segments/:id                      — Segment detail + member count
GET  /segments/:id/preview              — Estimated size + sample profiles
POST /segments/:id/compute              — Run rule evaluation, write memberships
POST /segments/:id/sync/:platform       — Sync to Meta/Google/Bing audience
DELETE /segments/:id                    — Delete segment

Reference: Adaptiv api/app/services/segment_engine.py
Reference: Adaptiv api/app/routers/cdp.py /dashboard/segments
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import verify_internal_key
from core.database import get_pool
from services.segment_engine import compute_segment_membership, preview_segment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/segments", tags=["segments"])


# ── Pydantic models ────────────────────────────────────────────────────────

class SegmentRule(BaseModel):
    field: str       # total_spend | order_count | is_vip | is_lapsed | tags_contains |
                     # last_order_days_ago | first_order_days_ago | email_domain | aov
    operator: str    # eq | neq | gte | lte | gt | lt | contains | not_contains | in | not_in | exists
    value: object    # depends on field/operator


class CreateSegmentBody(BaseModel):
    org_id: str
    name: str
    description: str | None = None
    type: str = "custom"            # custom | retarget | lookalike | suppression
    rules: list[SegmentRule] = []
    rule_logic: str = "AND"         # AND | OR
    platforms: list[str] = []       # google | meta | bing


class SyncPlatformBody(BaseModel):
    audience_id: str | None = None  # existing platform audience ID to update


# ── Routes ────────────────────────────────────────────────────────────────


@router.post("", status_code=201, dependencies=[Depends(verify_internal_key)])
async def create_segment(body: CreateSegmentBody):
    pool = await get_pool()
    now = datetime.now(timezone.utc)

    segment_id: str = await pool.fetchval(
        """
        INSERT INTO "AudienceSegment"
          (id, "organizationId", name, description, type, rules, "ruleLogic",
           platforms, "syncStatus", "syncedPlatforms", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6,
                $7, 'pending', '{}', $8, $8)
        RETURNING id
        """,
        body.org_id,
        body.name,
        body.description,
        body.type,
        json.dumps([r.model_dump() for r in body.rules]),
        body.rule_logic,
        body.platforms,
        now,
    )

    return {"segment_id": segment_id, "message": "Segment created. POST /:id/compute to evaluate profiles."}


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_segments(org_id: str = Query(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT s.id, s.name, s.description, s.type, s.rules, s."ruleLogic",
               s.platforms, s."estimatedSize", s."syncStatus", s."syncedPlatforms",
               s."lastSyncAt", s."createdAt",
               COUNT(csm."profileId") AS member_count
        FROM "AudienceSegment" s
        LEFT JOIN "CustomerSegmentMembership" csm ON csm."segmentId" = s.id
        WHERE s."organizationId" = $1
        GROUP BY s.id
        ORDER BY s."createdAt" DESC
        """,
        org_id,
    )
    return {"segments": [dict(r) for r in rows]}


@router.get("/{segment_id}", dependencies=[Depends(verify_internal_key)])
async def get_segment(segment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT s.*,
               COUNT(csm."profileId") AS member_count
        FROM "AudienceSegment" s
        LEFT JOIN "CustomerSegmentMembership" csm ON csm."segmentId" = s.id
        WHERE s.id = $1
        GROUP BY s.id
        """,
        segment_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    return dict(row)


@router.get("/{segment_id}/preview", dependencies=[Depends(verify_internal_key)])
async def preview_segment_endpoint(
    segment_id: str,
    sample_size: int = Query(5, ge=1, le=20),
):
    """Estimate how many profiles match this segment's rules without writing memberships."""
    pool = await get_pool()
    row = await pool.fetchrow(
        'SELECT "organizationId", rules, "ruleLogic" FROM "AudienceSegment" WHERE id = $1',
        segment_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")

    rules = row["rules"] if isinstance(row["rules"], list) else json.loads(row["rules"] or "[]")
    result = await preview_segment(
        pool,
        org_id=str(row["organizationId"]),
        rules=rules,
        rule_logic=row["ruleLogic"] or "AND",
        sample_size=sample_size,
    )
    return result


@router.post("/{segment_id}/compute", dependencies=[Depends(verify_internal_key)])
async def compute_segment(segment_id: str):
    """Evaluate all org profiles and write CustomerSegmentMembership rows."""
    pool = await get_pool()
    row = await pool.fetchrow(
        'SELECT "organizationId", rules, "ruleLogic" FROM "AudienceSegment" WHERE id = $1',
        segment_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")

    rules = row["rules"] if isinstance(row["rules"], list) else json.loads(row["rules"] or "[]")
    count = await compute_segment_membership(
        pool,
        segment_id=segment_id,
        org_id=str(row["organizationId"]),
        rules=rules,
        rule_logic=row["ruleLogic"] or "AND",
    )
    return {"ok": True, "members_computed": count, "segment_id": segment_id}


@router.post("/{segment_id}/sync/{platform}", dependencies=[Depends(verify_internal_key)])
async def sync_segment_to_platform(
    segment_id: str,
    platform: str,
    body: SyncPlatformBody,
):
    """Mark segment as syncing to an ad platform.

    Actual sync is handled by the connector service using the platform's
    Custom Audience API. This endpoint records intent and updates syncedPlatforms.
    Full implementation in Phase 2 (audience tools).
    """
    supported = ("google", "meta", "bing")
    if platform not in supported:
        raise HTTPException(status_code=400, detail=f"Platform must be one of: {', '.join(supported)}")

    pool = await get_pool()
    row = await pool.fetchrow(
        'SELECT "syncedPlatforms" FROM "AudienceSegment" WHERE id = $1',
        segment_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")

    synced = list(set((row["syncedPlatforms"] or []) + [platform]))
    await pool.execute(
        """
        UPDATE "AudienceSegment"
        SET "syncedPlatforms" = $1, "syncStatus" = 'synced', "lastSyncAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $2
        """,
        synced,
        segment_id,
    )

    return {
        "ok": True,
        "segment_id": segment_id,
        "platform": platform,
        "synced_platforms": synced,
        "note": "Segment flagged as synced. Use ad platform APIs to push member emails via connector service.",
    }


@router.delete("/{segment_id}", dependencies=[Depends(verify_internal_key)])
async def delete_segment(segment_id: str):
    pool = await get_pool()
    result = await pool.execute(
        'DELETE FROM "AudienceSegment" WHERE id = $1',
        segment_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"ok": True}
