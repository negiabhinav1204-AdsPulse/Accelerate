"""Identity Resolution — Section 1.5.

Resolution priority (highest → lowest confidence):
  1. Email exact match
  2. Phone exact match
  3. Platform ID match  (source + externalId in CustomerIdentity)
  4. Cookie/pixel ID   (source=pixel in CustomerIdentity)

When merging two profiles:
  - Keep oldest createdAt
  - Sum orderCount
  - Max totalSpend
  - Union tags

Reference: accelerate-expansion.md Section 1.5
Reference (pattern): adaptiv api/app/services/visitor_enrichment.py enrich_visitor()
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import asyncpg

logger = logging.getLogger(__name__)


async def resolve_profile(
    pool: asyncpg.Pool,
    org_id: str,
    *,
    email: str | None = None,
    phone: str | None = None,
    source: str | None = None,      # IdentitySource enum value
    external_id: str | None = None,  # platform customer ID
    pixel_id: str | None = None,
) -> str | None:
    """Find an existing CustomerProfile ID for the given signals.

    Returns the profile UUID if found, otherwise None.
    Checks signals in priority order and stops at first match.
    """
    # 1. Email
    if email:
        row = await pool.fetchrow(
            'SELECT id FROM "CustomerProfile" WHERE "organizationId" = $1 AND email = $2 LIMIT 1',
            org_id, email.lower().strip(),
        )
        if row:
            return str(row["id"])

    # 2. Phone
    if phone:
        normalized = _normalize_phone(phone)
        row = await pool.fetchrow(
            'SELECT id FROM "CustomerProfile" WHERE "organizationId" = $1 AND phone = $2 LIMIT 1',
            org_id, normalized,
        )
        if row:
            return str(row["id"])

    # 3. Platform ID (source + externalId in CustomerIdentity)
    if source and external_id:
        row = await pool.fetchrow(
            """
            SELECT ci."profileId" FROM "CustomerIdentity" ci
            JOIN "CustomerProfile" cp ON cp.id = ci."profileId"
            WHERE cp."organizationId" = $1 AND ci.source = $2::"IdentitySource" AND ci."externalId" = $3
            LIMIT 1
            """,
            org_id, source, external_id,
        )
        if row:
            return str(row["profileId"])

    # 4. Pixel / cookie ID
    if pixel_id:
        row = await pool.fetchrow(
            """
            SELECT ci."profileId" FROM "CustomerIdentity" ci
            JOIN "CustomerProfile" cp ON cp.id = ci."profileId"
            WHERE cp."organizationId" = $1 AND ci.source = 'pixel' AND ci."externalId" = $2
            LIMIT 1
            """,
            org_id, pixel_id,
        )
        if row:
            return str(row["profileId"])

    return None


async def upsert_profile(
    pool: asyncpg.Pool,
    org_id: str,
    *,
    email: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    tags: list[str] | None = None,
    total_spend: float | None = None,
    order_count: int = 0,
    last_order_at: datetime | None = None,
    first_order_at: datetime | None = None,
    source: str | None = None,
    external_id: str | None = None,
    pixel_id: str | None = None,
) -> str:
    """Resolve or create a CustomerProfile, then attach identity signals.

    Returns the profile UUID.
    """
    profile_id = await resolve_profile(
        pool, org_id,
        email=email, phone=phone,
        source=source, external_id=external_id, pixel_id=pixel_id,
    )

    now = datetime.now(timezone.utc)

    if profile_id:
        # Merge into existing profile
        await _merge_profile(
            pool, profile_id,
            name=name, tags=tags or [],
            total_spend=total_spend, order_count=order_count,
            last_order_at=last_order_at,
        )
    else:
        # Create new profile
        profile_id = await pool.fetchval(
            """
            INSERT INTO "CustomerProfile"
              (id, "organizationId", email, phone, name, tags,
               "totalSpend", "orderCount", "lastOrderAt", "firstOrderAt",
               "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
            RETURNING id
            """,
            org_id,
            email.lower().strip() if email else None,
            _normalize_phone(phone) if phone else None,
            name,
            tags or [],
            total_spend,
            order_count,
            last_order_at,
            first_order_at or last_order_at,
            now,
        )

    # Attach identity signals
    if source and external_id:
        await _upsert_identity(pool, profile_id, source, external_id)
    if pixel_id:
        await _upsert_identity(pool, profile_id, "pixel", pixel_id)

    return profile_id


async def merge_profiles(pool: asyncpg.Pool, keep_id: str, drop_id: str) -> None:
    """Merge drop_id into keep_id.

    Rules: oldest createdAt, sum orderCount, max totalSpend, union tags.
    Reassigns all relations (identities, events, segment memberships).
    """
    keep = await pool.fetchrow('SELECT * FROM "CustomerProfile" WHERE id = $1', keep_id)
    drop = await pool.fetchrow('SELECT * FROM "CustomerProfile" WHERE id = $1', drop_id)
    if not keep or not drop:
        return

    # Merge values
    merged_order_count = (keep["orderCount"] or 0) + (drop["orderCount"] or 0)
    merged_total_spend = max(
        float(keep["totalSpend"] or 0),
        float(drop["totalSpend"] or 0),
    )
    keep_tags = set(keep["tags"] or [])
    drop_tags = set(drop["tags"] or [])
    merged_tags = list(keep_tags | drop_tags)

    # Oldest createdAt wins
    keep_created = keep["createdAt"]
    drop_created = drop["createdAt"]
    oldest_created = min(keep_created, drop_created) if keep_created and drop_created else keep_created

    now = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Reassign child rows
            await conn.execute(
                'UPDATE "CustomerIdentity" SET "profileId" = $1 WHERE "profileId" = $2',
                keep_id, drop_id,
            )
            await conn.execute(
                'UPDATE "CustomerEvent" SET "profileId" = $1 WHERE "profileId" = $2',
                keep_id, drop_id,
            )
            # Segment memberships: upsert to avoid PK conflicts
            memberships = await conn.fetch(
                'SELECT "segmentId" FROM "CustomerSegmentMembership" WHERE "profileId" = $1',
                drop_id,
            )
            for m in memberships:
                await conn.execute(
                    """
                    INSERT INTO "CustomerSegmentMembership" ("profileId", "segmentId", "addedAt")
                    VALUES ($1, $2, NOW())
                    ON CONFLICT DO NOTHING
                    """,
                    keep_id, m["segmentId"],
                )
            await conn.execute(
                'DELETE FROM "CustomerSegmentMembership" WHERE "profileId" = $1',
                drop_id,
            )

            # Update the kept profile
            await conn.execute(
                """
                UPDATE "CustomerProfile"
                SET "orderCount" = $1, "totalSpend" = $2, tags = $3,
                    "createdAt" = $4, "updatedAt" = $5
                WHERE id = $6
                """,
                merged_order_count, merged_total_spend, merged_tags,
                oldest_created, now, keep_id,
            )

            # Delete the merged-away profile
            await conn.execute('DELETE FROM "CustomerProfile" WHERE id = $1', drop_id)

    logger.info("Merged profile %s into %s", drop_id, keep_id)


# ── Helpers ────────────────────────────────────────────────────────────────


async def _merge_profile(
    pool: asyncpg.Pool,
    profile_id: str,
    *,
    name: str | None,
    tags: list[str],
    total_spend: float | None,
    order_count: int,
    last_order_at: datetime | None,
) -> None:
    row = await pool.fetchrow(
        'SELECT "orderCount", "totalSpend", tags, "lastOrderAt" FROM "CustomerProfile" WHERE id = $1',
        profile_id,
    )
    if not row:
        return

    new_order_count = (row["orderCount"] or 0) + order_count
    new_total_spend = max(float(row["totalSpend"] or 0), float(total_spend or 0))
    new_tags = list(set(row["tags"] or []) | set(tags))
    new_last_order = max(
        filter(None, [row["lastOrderAt"], last_order_at]),
        default=None,
    )

    await pool.execute(
        """
        UPDATE "CustomerProfile"
        SET "orderCount" = $1, "totalSpend" = $2, tags = $3,
            "lastOrderAt" = $4, "updatedAt" = $5
        WHERE id = $6
        """,
        new_order_count, new_total_spend, new_tags,
        new_last_order, datetime.now(timezone.utc), profile_id,
    )


async def _upsert_identity(pool: asyncpg.Pool, profile_id: str, source: str, external_id: str) -> None:
    await pool.execute(
        """
        INSERT INTO "CustomerIdentity" (id, "profileId", source, "externalId", "createdAt")
        VALUES (gen_random_uuid(), $1, $2::"IdentitySource", $3, NOW())
        ON CONFLICT (source, "externalId") DO NOTHING
        """,
        profile_id, source, external_id,
    )


def _normalize_phone(phone: str) -> str:
    """Strip everything except digits and leading +."""
    import re
    digits = re.sub(r"[^\d+]", "", phone)
    return digits
