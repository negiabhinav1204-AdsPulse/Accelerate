"""Customer profile endpoints — Section 1.4.

GET  /profiles?orgId&search&segment&page&limit   — paginated profile list
GET  /profiles/:id                               — profile detail + identity graph + recent events
POST /profiles/ingest/events                     — pixel event ingestion
POST /profiles/ingest/upload                     — CSV bulk upload (email, name, phone, spend)

Reference: Adaptiv api/app/routers/cdp.py /customers endpoints
Reference: Adaptiv api/app/services/visitor_enrichment.py build_enrichment_context()
"""
from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from core.auth import verify_internal_key
from core.database import get_pool
from services.identity_resolver import upsert_profile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profiles", tags=["profiles"])


# ── Pydantic models ────────────────────────────────────────────────────────

class EventIngestBody(BaseModel):
    org_id: str
    profile_id: str | None = None
    pixel_id: str | None = None
    email: str | None = None
    event_type: str          # page_view | add_to_cart | purchase | form_submit | custom
    properties: dict = {}
    occurred_at: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_profiles(
    org_id: str = Query(...),
    search: str = Query(None),
    segment_id: str = Query(None),
    is_vip: bool = Query(None),
    is_lapsed: bool = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Paginated customer profile list with optional search and segment filter."""
    pool = await get_pool()
    offset = (page - 1) * limit

    conditions = ['"organizationId" = $1']
    params: list = [org_id]

    if search:
        params.append(f"%{search}%")
        conditions.append(
            f'(email ILIKE ${len(params)} OR name ILIKE ${len(params)} OR phone ILIKE ${len(params)})'
        )
    if is_vip is not None:
        params.append(is_vip)
        conditions.append(f'"isVip" = ${len(params)}')
    if is_lapsed is not None:
        params.append(is_lapsed)
        conditions.append(f'"isLapsed" = ${len(params)}')

    where = "WHERE " + " AND ".join(conditions)

    # Segment filter: join CustomerSegmentMembership
    if segment_id:
        join_clause = f"""
        JOIN "CustomerSegmentMembership" csm ON csm."profileId" = cp.id AND csm."segmentId" = ${len(params) + 1}
        """
        params.append(segment_id)
        query_from = f'FROM "CustomerProfile" cp {join_clause} {where}'
    else:
        query_from = f'FROM "CustomerProfile" cp {where}'

    params.extend([limit, offset])
    rows = await pool.fetch(
        f"""
        SELECT cp.id, cp.email, cp.phone, cp.name, cp."totalSpend", cp."orderCount",
               cp."lastOrderAt", cp."firstOrderAt", cp."isVip", cp."isLapsed",
               cp.tags, cp.aov, cp."createdAt"
        {query_from}
        ORDER BY cp."lastOrderAt" DESC NULLS LAST
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )

    count_params = params[:-2]
    total: int = await pool.fetchval(f'SELECT COUNT(*) {query_from}', *count_params)

    return {
        "profiles": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
    }


@router.get("/overview", dependencies=[Depends(verify_internal_key)])
async def profiles_overview(org_id: str = Query(...)):
    """Summary stats: total, VIP, lapsed, avg LTV.
    Mirrors Adaptiv cdp.py /dashboard/overview structure.
    """
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*)                                  AS total,
            SUM(CASE WHEN "isVip" THEN 1 ELSE 0 END) AS vip_count,
            SUM(CASE WHEN "isLapsed" THEN 1 ELSE 0 END) AS lapsed_count,
            AVG("totalSpend")                         AS avg_ltv,
            AVG("orderCount")                         AS avg_orders,
            SUM(CASE WHEN "orderCount" > 1 THEN 1 ELSE 0 END) AS returning_count
        FROM "CustomerProfile"
        WHERE "organizationId" = $1
        """,
        org_id,
    )
    return {
        "total_profiles": int(row["total"] or 0),
        "vip_count": int(row["vip_count"] or 0),
        "lapsed_count": int(row["lapsed_count"] or 0),
        "returning_count": int(row["returning_count"] or 0),
        "avg_ltv": round(float(row["avg_ltv"] or 0), 2),
        "avg_orders": round(float(row["avg_orders"] or 0), 1),
    }


@router.get("/{profile_id}", dependencies=[Depends(verify_internal_key)])
async def get_profile(profile_id: str):
    """Profile detail — includes identity graph + recent events + enrichment context.

    Enrichment structure mirrors Adaptiv visitor_enrichment.py build_enrichment_context().
    """
    pool = await get_pool()

    profile = await pool.fetchrow(
        'SELECT * FROM "CustomerProfile" WHERE id = $1',
        profile_id,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    identities = await pool.fetch(
        'SELECT source, "externalId", metadata, "createdAt" FROM "CustomerIdentity" WHERE "profileId" = $1',
        profile_id,
    )

    events = await pool.fetch(
        """
        SELECT id, "eventType", properties, "occurredAt"
        FROM "CustomerEvent"
        WHERE "profileId" = $1
        ORDER BY "occurredAt" DESC
        LIMIT 50
        """,
        profile_id,
    )

    segments = await pool.fetch(
        """
        SELECT s.id, s.name, s.type, csm."addedAt"
        FROM "CustomerSegmentMembership" csm
        JOIN "AudienceSegment" s ON s.id = csm."segmentId"
        WHERE csm."profileId" = $1
        """,
        profile_id,
    )

    p = dict(profile)
    enrichment = _build_enrichment(p)

    return {
        "profile": p,
        "identities": [dict(i) for i in identities],
        "events": [dict(e) for e in events],
        "segments": [dict(s) for s in segments],
        "enrichment": enrichment,
    }


@router.post("/ingest/events", dependencies=[Depends(verify_internal_key)])
async def ingest_event(body: EventIngestBody):
    """Ingest a pixel or server-side event into a customer's timeline.

    If profile_id is unknown, resolves via email or pixel_id.
    Creates a new profile if no match found.
    """
    pool = await get_pool()

    profile_id = body.profile_id

    if not profile_id:
        profile_id = await upsert_profile(
            pool, body.org_id,
            email=body.email,
            pixel_id=body.pixel_id,
        )

    occurred_at = (
        datetime.fromisoformat(body.occurred_at.replace("Z", "+00:00"))
        if body.occurred_at
        else datetime.now(timezone.utc)
    )

    await pool.execute(
        """
        INSERT INTO "CustomerEvent" (id, "profileId", "orgId", "eventType", properties, "occurredAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5)
        """,
        profile_id,
        body.org_id,
        body.event_type,
        json.dumps(body.properties),
        occurred_at,
    )

    return {"ok": True, "profile_id": profile_id}


@router.post("/ingest/upload", dependencies=[Depends(verify_internal_key)])
async def ingest_csv(
    org_id: str = Query(...),
    file: UploadFile = File(...),
):
    """Bulk-import customers from CSV.

    Expected columns (any order, all optional except at least one of email/phone):
      email, phone, name, total_spend, order_count, tags
    """
    pool = await get_pool()

    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    merged = 0
    errors = 0

    for row in reader:
        try:
            email = (row.get("email") or "").strip() or None
            phone = (row.get("phone") or "").strip() or None
            if not email and not phone:
                continue

            name = (row.get("name") or "").strip() or None
            total_spend_raw = row.get("total_spend") or row.get("total_spent") or "0"
            total_spend = float(total_spend_raw) if total_spend_raw else None
            order_count = int(row.get("order_count") or 0)
            tags_raw = row.get("tags") or ""
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()]

            from services.identity_resolver import resolve_profile
            existing_id = await resolve_profile(pool, org_id, email=email, phone=phone)

            await upsert_profile(
                pool, org_id,
                email=email, phone=phone, name=name, tags=tags,
                total_spend=total_spend, order_count=order_count,
            )

            if existing_id:
                merged += 1
            else:
                created += 1

        except Exception as exc:
            logger.warning("CSV row error: %s — %s", row, exc)
            errors += 1

    return {
        "ok": True,
        "created": created,
        "merged": merged,
        "errors": errors,
        "total_rows": created + merged + errors,
    }


# ── Enrichment helper ──────────────────────────────────────────────────────

def _build_enrichment(profile: dict) -> dict:
    """Build personalization context from a profile.
    Structure mirrors Adaptiv visitor_enrichment.py build_enrichment_context().
    """
    total_orders = int(profile.get("orderCount") or 0)
    total_spend = float(profile.get("totalSpend") or 0)
    aov = float(profile.get("aov") or 0)

    # Loyalty tier
    if profile.get("isVip") or total_spend >= 500:
        tier = "vip"
    elif total_spend >= 200:
        tier = "high"
    elif total_spend >= 50:
        tier = "medium"
    else:
        tier = "low"

    hints: list[str] = []
    if profile.get("name"):
        hints.append(f"Customer's name is {profile['name']} — use for personalization")
    tier_hints = {
        "vip": "VIP customer — offer exclusive perks and gratitude",
        "high": "High-value returning customer — emphasize loyalty rewards",
        "medium": "Regular customer — encourage next purchase",
        "low": "New or infrequent customer — focus on trust and first-buy incentives",
    }
    hints.append(tier_hints[tier])
    if total_orders == 0:
        hints.append("Has never purchased — focus on first-buy conversion")
    elif total_orders == 1:
        hints.append("First-time buyer — encourage second purchase")
    elif total_orders >= 10:
        hints.append(f"Loyal repeat buyer ({total_orders} orders)")
    if profile.get("isLapsed"):
        hints.append("Lapsed customer — use win-back messaging")

    return {
        "loyalty_tier": tier,
        "purchase_history": {
            "total_orders": total_orders,
            "total_spend": total_spend,
            "aov": aov,
            "first_order_at": profile.get("firstOrderAt"),
            "last_order_at": profile.get("lastOrderAt"),
        },
        "personalization_hints": hints,
        "is_vip": bool(profile.get("isVip")),
        "is_lapsed": bool(profile.get("isLapsed")),
        "tags": profile.get("tags") or [],
    }
