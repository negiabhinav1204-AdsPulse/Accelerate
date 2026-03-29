import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional

from core.auth import verify_internal_key
from core.database import get_pool
from services.variant_engine import generate_variants

logger = logging.getLogger(__name__)
router = APIRouter()


class VariantCreate(BaseModel):
    zone_id: str
    name: str
    html: str
    is_control: bool = False


class VariantUpdate(BaseModel):
    name: Optional[str] = None
    html: Optional[str] = None


class VariantGenerateRequest(BaseModel):
    zone_id: str
    count: int = Field(default=2, ge=1, le=5)
    context: str = ""


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_variant(body: VariantCreate):
    pool = await get_pool()
    # Verify zone exists
    zone = await pool.fetchrow('SELECT id FROM "PersonalizationZone" WHERE id = $1', body.zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    variant_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO "PageVariant" (id, "zoneId", name, html, "isControl", "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())""",
        variant_id, body.zone_id, body.name, body.html, body.is_control,
    )
    return {
        "id": variant_id,
        "zoneId": body.zone_id,
        "name": body.name,
        "html": body.html,
        "isControl": body.is_control,
    }


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_variants(zone_id: str = Query(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, "zoneId", name, html, "isControl", "createdAt"
           FROM "PageVariant"
           WHERE "zoneId" = $1
           ORDER BY "isControl" DESC, "createdAt" ASC""",
        zone_id,
    )
    return {"variants": [dict(r) for r in rows]}


@router.get("/{variant_id}", dependencies=[Depends(verify_internal_key)])
async def get_variant(variant_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT * FROM "PageVariant" WHERE id = $1', variant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Variant not found")
    return dict(row)


@router.patch("/{variant_id}", dependencies=[Depends(verify_internal_key)])
async def update_variant(variant_id: str, body: VariantUpdate):
    pool = await get_pool()
    updates = []
    params = []
    i = 1
    if body.name is not None:
        updates.append(f'name = ${i}'); params.append(body.name); i += 1
    if body.html is not None:
        updates.append(f'html = ${i}'); params.append(body.html); i += 1
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(variant_id)
    result = await pool.execute(
        f'UPDATE "PageVariant" SET {", ".join(updates)} WHERE id = ${i}',
        *params,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Variant not found")
    return {"ok": True}


@router.delete("/{variant_id}", dependencies=[Depends(verify_internal_key)])
async def delete_variant(variant_id: str):
    pool = await get_pool()
    result = await pool.execute('DELETE FROM "PageVariant" WHERE id = $1', variant_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Variant not found")
    return {"ok": True}


@router.post("/generate", dependencies=[Depends(verify_internal_key)])
async def generate_ai_variants(body: VariantGenerateRequest):
    pool = await get_pool()
    # Fetch zone details
    zone = await pool.fetchrow(
        'SELECT id, "pageId", name, selector, "defaultHtml" FROM "PersonalizationZone" WHERE id = $1',
        body.zone_id,
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone_data = dict(zone)
    try:
        generated = await generate_variants(
            zone_data=zone_data,
            count=body.count,
            context=body.context,
        )
    except Exception as e:
        logger.error("Variant generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")

    # Persist generated variants
    saved = []
    for item in generated:
        variant_id = str(uuid.uuid4())
        await pool.execute(
            """INSERT INTO "PageVariant" (id, "zoneId", name, html, "isControl", "createdAt")
               VALUES ($1, $2, $3, $4, false, NOW())""",
            variant_id, body.zone_id, item["name"], item["html"],
        )
        saved.append({
            "id": variant_id,
            "zoneId": body.zone_id,
            "name": item["name"],
            "html": item["html"],
            "rationale": item.get("rationale", ""),
            "isControl": False,
        })

    return {"variants": saved, "count": len(saved)}
