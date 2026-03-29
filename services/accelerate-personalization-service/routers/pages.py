import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Optional

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()


class PageCreate(BaseModel):
    org_id: str
    name: str
    url: str


class PageUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_page(body: PageCreate):
    pool = await get_pool()
    page_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO "SitePage" (id, "organizationId", name, url, "isActive", "createdAt")
           VALUES ($1, $2, $3, $4, true, NOW())""",
        page_id, body.org_id, body.name, body.url,
    )
    return {"id": page_id, "name": body.name, "url": body.url, "isActive": True}


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_pages(org_id: str = Query(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT p.id, p.name, p.url, p."isActive", p."createdAt",
                  COUNT(DISTINCT z.id) as zone_count,
                  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'running') as active_experiments
           FROM "SitePage" p
           LEFT JOIN "PersonalizationZone" z ON z."pageId" = p.id
           LEFT JOIN "Experiment" e ON e."zoneId" = z.id
           WHERE p."organizationId" = $1
           GROUP BY p.id ORDER BY p."createdAt" DESC""",
        org_id,
    )
    return {"pages": [dict(r) for r in rows]}


@router.get("/{page_id}", dependencies=[Depends(verify_internal_key)])
async def get_page(page_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT * FROM "SitePage" WHERE id = $1', page_id)
    if not row:
        raise HTTPException(status_code=404, detail="Page not found")
    zones = await pool.fetch(
        'SELECT * FROM "PersonalizationZone" WHERE "pageId" = $1 ORDER BY "createdAt"',
        page_id,
    )
    result = dict(row)
    result["zones"] = [dict(z) for z in zones]
    return result


@router.patch("/{page_id}", dependencies=[Depends(verify_internal_key)])
async def update_page(page_id: str, body: PageUpdate):
    pool = await get_pool()
    updates = []
    params = []
    i = 1
    if body.name is not None:
        updates.append(f'name = ${i}'); params.append(body.name); i += 1
    if body.url is not None:
        updates.append(f'url = ${i}'); params.append(body.url); i += 1
    if body.is_active is not None:
        updates.append(f'"isActive" = ${i}'); params.append(body.is_active); i += 1
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(page_id)
    result = await pool.execute(
        f'UPDATE "SitePage" SET {", ".join(updates)} WHERE id = ${i}',
        *params,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Page not found")
    return {"ok": True}


@router.delete("/{page_id}", dependencies=[Depends(verify_internal_key)])
async def delete_page(page_id: str):
    pool = await get_pool()
    result = await pool.execute('DELETE FROM "SitePage" WHERE id = $1', page_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Page not found")
    return {"ok": True}
