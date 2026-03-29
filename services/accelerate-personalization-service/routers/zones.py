import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Optional

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()


class ZoneCreate(BaseModel):
    page_id: str
    name: str
    selector: str
    default_html: Optional[str] = None


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    selector: Optional[str] = None
    default_html: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_zone(body: ZoneCreate):
    pool = await get_pool()
    zone_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO "PersonalizationZone" (id, "pageId", name, selector, "defaultHtml", "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())""",
        zone_id, body.page_id, body.name, body.selector, body.default_html,
    )
    return {
        "id": zone_id,
        "pageId": body.page_id,
        "name": body.name,
        "selector": body.selector,
        "defaultHtml": body.default_html,
    }


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_zones(page_id: str = Query(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT z.id, z."pageId", z.name, z.selector, z."defaultHtml", z."createdAt",
                  COUNT(DISTINCT v.id) as variant_count,
                  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'running') as active_experiments
           FROM "PersonalizationZone" z
           LEFT JOIN "PageVariant" v ON v."zoneId" = z.id
           LEFT JOIN "Experiment" e ON e."zoneId" = z.id
           WHERE z."pageId" = $1
           GROUP BY z.id ORDER BY z."createdAt" ASC""",
        page_id,
    )
    return {"zones": [dict(r) for r in rows]}


@router.get("/{zone_id}", dependencies=[Depends(verify_internal_key)])
async def get_zone(zone_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT * FROM "PersonalizationZone" WHERE id = $1', zone_id)
    if not row:
        raise HTTPException(status_code=404, detail="Zone not found")
    return dict(row)


@router.patch("/{zone_id}", dependencies=[Depends(verify_internal_key)])
async def update_zone(zone_id: str, body: ZoneUpdate):
    pool = await get_pool()
    updates = []
    params = []
    i = 1
    if body.name is not None:
        updates.append(f'name = ${i}'); params.append(body.name); i += 1
    if body.selector is not None:
        updates.append(f'selector = ${i}'); params.append(body.selector); i += 1
    if body.default_html is not None:
        updates.append(f'"defaultHtml" = ${i}'); params.append(body.default_html); i += 1
    if body.is_active is not None:
        updates.append(f'"isActive" = ${i}'); params.append(body.is_active); i += 1
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(zone_id)
    result = await pool.execute(
        f'UPDATE "PersonalizationZone" SET {", ".join(updates)} WHERE id = ${i}',
        *params,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"ok": True}


@router.delete("/{zone_id}", dependencies=[Depends(verify_internal_key)])
async def delete_zone(zone_id: str):
    pool = await get_pool()
    result = await pool.execute('DELETE FROM "PersonalizationZone" WHERE id = $1', zone_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"ok": True}


@router.get("/{zone_id}/variants", dependencies=[Depends(verify_internal_key)])
async def list_zone_variants(zone_id: str):
    pool = await get_pool()
    # Verify zone exists
    zone = await pool.fetchrow('SELECT id FROM "PersonalizationZone" WHERE id = $1', zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    rows = await pool.fetch(
        """SELECT v.id, v."zoneId", v.name, v.html, v."isControl", v."createdAt"
           FROM "PageVariant" v
           WHERE v."zoneId" = $1
           ORDER BY v."isControl" DESC, v."createdAt" ASC""",
        zone_id,
    )
    return {"variants": [dict(r) for r in rows]}
