import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional, Literal

from core.auth import verify_internal_key
from core.database import get_pool
from services.experiment_analytics import get_experiment_stats

logger = logging.getLogger(__name__)
router = APIRouter()


class ExperimentCreate(BaseModel):
    zone_id: str
    name: str
    traffic_split: int = Field(default=100, ge=0, le=100)
    holdout_pct: int = Field(default=0, ge=0, le=50)
    allocation_mode: Literal["random", "bandit"] = "random"


class VariantAllocationAdd(BaseModel):
    variant_id: str
    weight: int = Field(default=50, ge=1, le=100)
    is_control: bool = False


class WinnerSelect(BaseModel):
    variant_id: str


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_experiment(body: ExperimentCreate):
    pool = await get_pool()
    # Verify zone exists
    zone = await pool.fetchrow('SELECT id, "pageId" FROM "PersonalizationZone" WHERE id = $1', body.zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    exp_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO "Experiment" (id, "zoneId", name, status, "trafficSplit", "holdoutPct", "allocationMode", "createdAt")
           VALUES ($1, $2, $3, 'draft', $4, $5, $6, NOW())""",
        exp_id, body.zone_id, body.name, body.traffic_split, body.holdout_pct, body.allocation_mode,
    )
    return {
        "id": exp_id,
        "zoneId": body.zone_id,
        "name": body.name,
        "status": "draft",
        "trafficSplit": body.traffic_split,
        "holdoutPct": body.holdout_pct,
        "allocationMode": body.allocation_mode,
    }


@router.get("", dependencies=[Depends(verify_internal_key)])
async def list_experiments(org_id: str = Query(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT e.id, e."zoneId", e.name, e.status, e."trafficSplit", e."holdoutPct",
                  e."allocationMode", e."startedAt", e."endedAt", e."createdAt",
                  p."organizationId",
                  COALESCE(SUM(er.impressions), 0) as total_impressions,
                  COALESCE(SUM(er.conversions), 0) as total_conversions
           FROM "Experiment" e
           JOIN "PersonalizationZone" z ON z.id = e."zoneId"
           JOIN "SitePage" p ON p.id = z."pageId"
           LEFT JOIN "ExperimentResult" er ON er."experimentId" = e.id
           WHERE p."organizationId" = $1
           GROUP BY e.id, p."organizationId"
           ORDER BY e."createdAt" DESC""",
        org_id,
    )
    return {"experiments": [dict(r) for r in rows]}


@router.get("/{experiment_id}", dependencies=[Depends(verify_internal_key)])
async def get_experiment(experiment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT * FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")

    allocations = await pool.fetch(
        """SELECT eva.id, eva."variantId", eva.weight, eva."isControl", v.name as "variantName"
           FROM "ExperimentVariantAllocation" eva
           JOIN "PageVariant" v ON v.id = eva."variantId"
           WHERE eva."experimentId" = $1
           ORDER BY eva."isControl" DESC, eva."createdAt" ASC""",
        experiment_id,
    )
    result = dict(row)
    result["allocations"] = [dict(a) for a in allocations]
    return result


@router.post("/{experiment_id}/start", dependencies=[Depends(verify_internal_key)])
async def start_experiment(experiment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT id, status FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if row["status"] == "running":
        raise HTTPException(status_code=400, detail="Experiment is already running")
    if row["status"] == "ended":
        raise HTTPException(status_code=400, detail="Cannot restart an ended experiment")

    # Ensure at least 2 variant allocations
    alloc_count = await pool.fetchval(
        'SELECT COUNT(*) FROM "ExperimentVariantAllocation" WHERE "experimentId" = $1',
        experiment_id,
    )
    if alloc_count < 2:
        raise HTTPException(status_code=400, detail="Experiment needs at least 2 variant allocations to start")

    await pool.execute(
        'UPDATE "Experiment" SET status = $1, "startedAt" = $2 WHERE id = $3',
        "running", datetime.now(timezone.utc), experiment_id,
    )
    return {"ok": True, "status": "running"}


@router.post("/{experiment_id}/pause", dependencies=[Depends(verify_internal_key)])
async def pause_experiment(experiment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT id, status FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if row["status"] != "running":
        raise HTTPException(status_code=400, detail="Only running experiments can be paused")

    await pool.execute(
        'UPDATE "Experiment" SET status = $1 WHERE id = $2',
        "paused", experiment_id,
    )
    return {"ok": True, "status": "paused"}


@router.post("/{experiment_id}/end", dependencies=[Depends(verify_internal_key)])
async def end_experiment(experiment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT id, status FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if row["status"] == "ended":
        raise HTTPException(status_code=400, detail="Experiment is already ended")

    await pool.execute(
        'UPDATE "Experiment" SET status = $1, "endedAt" = $2 WHERE id = $3',
        "ended", datetime.now(timezone.utc), experiment_id,
    )
    return {"ok": True, "status": "ended"}


@router.get("/{experiment_id}/results", dependencies=[Depends(verify_internal_key)])
async def get_experiment_results(experiment_id: str):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT * FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")

    results = await pool.fetch(
        'SELECT * FROM "ExperimentResult" WHERE "experimentId" = $1',
        experiment_id,
    )
    allocations = await pool.fetch(
        """SELECT eva."variantId", eva."isControl", v.name as "variantName"
           FROM "ExperimentVariantAllocation" eva
           JOIN "PageVariant" v ON v.id = eva."variantId"
           WHERE eva."experimentId" = $1""",
        experiment_id,
    )

    result_dicts = [dict(r) for r in results]
    alloc_dicts = [dict(a) for a in allocations]

    stats = get_experiment_stats(result_dicts, alloc_dicts)

    return {
        "experimentId": experiment_id,
        "status": row["status"],
        "isSignificant": stats.is_significant,
        "confidence": stats.confidence,
        "winningVariantId": stats.winning_variant_id,
        "liftPct": stats.lift_pct,
        "variants": [
            {
                "variantId": v.variant_id,
                "name": v.name,
                "impressions": v.impressions,
                "conversions": v.conversions,
                "revenue": v.revenue,
                "isControl": v.is_control,
                "conversionRate": round(v.conversions / max(1, v.impressions) * 100, 2),
            }
            for v in stats.variants
        ],
    }


@router.post("/{experiment_id}/winner", dependencies=[Depends(verify_internal_key)])
async def set_winner(experiment_id: str, body: WinnerSelect):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT id FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Verify variant belongs to this experiment
    alloc = await pool.fetchrow(
        'SELECT id FROM "ExperimentVariantAllocation" WHERE "experimentId" = $1 AND "variantId" = $2',
        experiment_id, body.variant_id,
    )
    if not alloc:
        raise HTTPException(status_code=400, detail="Variant is not part of this experiment")

    await pool.execute(
        'UPDATE "Experiment" SET "winnerVariantId" = $1, status = $2, "endedAt" = $3 WHERE id = $4',
        body.variant_id, "ended", datetime.now(timezone.utc), experiment_id,
    )
    return {"ok": True, "winnerVariantId": body.variant_id, "status": "ended"}


@router.post("/{experiment_id}/variants", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def add_variant_to_experiment(experiment_id: str, body: VariantAllocationAdd):
    pool = await get_pool()
    row = await pool.fetchrow('SELECT id, status FROM "Experiment" WHERE id = $1', experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if row["status"] == "ended":
        raise HTTPException(status_code=400, detail="Cannot modify an ended experiment")

    # Verify variant exists
    variant = await pool.fetchrow('SELECT id FROM "PageVariant" WHERE id = $1', body.variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    # Check for duplicate
    existing = await pool.fetchrow(
        'SELECT id FROM "ExperimentVariantAllocation" WHERE "experimentId" = $1 AND "variantId" = $2',
        experiment_id, body.variant_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Variant already added to this experiment")

    alloc_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO "ExperimentVariantAllocation" (id, "experimentId", "variantId", weight, "isControl", "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())""",
        alloc_id, experiment_id, body.variant_id, body.weight, body.is_control,
    )
    return {
        "id": alloc_id,
        "experimentId": experiment_id,
        "variantId": body.variant_id,
        "weight": body.weight,
        "isControl": body.is_control,
    }
