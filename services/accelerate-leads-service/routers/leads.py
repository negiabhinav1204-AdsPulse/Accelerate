"""Lead form management and submission capture endpoints."""
from __future__ import annotations

import csv
import io
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.auth import verify_internal_key
from core.database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])


# ─── Pydantic models ──────────────────────────────────────────────────────────


class FormField(BaseModel):
    name: str
    type: str  # text | email | phone | select | textarea | checkbox
    label: str
    required: bool = False
    options: list[str] = []  # for select fields
    placeholder: str = ""


class LeadFormCreate(BaseModel):
    org_id: str
    title: str
    description: str = ""
    incentive: str = ""
    fields: list[FormField]
    hosting_type: str = "own_domain"  # own_domain | shopify | typeform | hubspot
    external_form_id: str = ""


class LeadFormUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    incentive: str | None = None
    fields: list[FormField] | None = None
    hosting_type: str | None = None
    is_active: bool | None = None


class PublishRequest(BaseModel):
    hosting_type: str


class LeadCaptureRequest(BaseModel):
    data: dict
    source_url: str = ""
    ip_address: str = ""
    visitor_id: str = ""
    utm: dict = {}


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.post("/forms", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_internal_key)])
async def create_form(body: LeadFormCreate):
    """Create a new lead capture form."""
    pool = await get_pool()
    form_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    published_url = f"https://app.accelerate.inmobi.com/forms/{form_id}" if body.hosting_type == "own_domain" else ""

    try:
        await pool.execute(
            """
            INSERT INTO lead_forms
              (id, org_id, title, description, incentive, fields, hosting_type,
               published_url, external_form_id, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, true, $10)
            """,
            form_id,
            body.org_id,
            body.title,
            body.description,
            body.incentive,
            json.dumps([f.model_dump() for f in body.fields]),
            body.hosting_type,
            published_url,
            body.external_form_id,
            now,
        )
    except Exception as exc:
        logger.error("Failed to create lead form: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create form")

    return {
        "id": form_id,
        "org_id": body.org_id,
        "title": body.title,
        "description": body.description,
        "incentive": body.incentive,
        "fields": [f.model_dump() for f in body.fields],
        "hosting_type": body.hosting_type,
        "published_url": published_url,
        "external_form_id": body.external_form_id,
        "is_active": True,
        "created_at": now.isoformat(),
    }


@router.get("/forms", dependencies=[Depends(verify_internal_key)])
async def list_forms(org_id: str = Query(...)):
    """List all lead forms for an org with submission counts."""
    pool = await get_pool()
    try:
        rows = await pool.fetch(
            """
            SELECT
              f.id, f.org_id, f.title, f.description, f.incentive, f.fields,
              f.hosting_type, f.published_url, f.external_form_id, f.is_active, f.created_at,
              COUNT(s.id) AS submission_count
            FROM lead_forms f
            LEFT JOIN lead_submissions s ON s.form_id = f.id
            WHERE f.org_id = $1
            GROUP BY f.id
            ORDER BY f.created_at DESC
            """,
            org_id,
        )
    except Exception as exc:
        logger.warning("lead_forms table may not exist yet: %s", exc)
        return {"forms": [], "total": 0}

    forms = []
    for row in rows:
        d = dict(row)
        if isinstance(d.get("fields"), str):
            d["fields"] = json.loads(d["fields"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        d["submission_count"] = int(d["submission_count"])
        forms.append(d)

    return {"forms": forms, "total": len(forms)}


@router.get("/forms/{form_id}", dependencies=[Depends(verify_internal_key)])
async def get_form(form_id: str):
    """Get form detail including the 5 most recent submissions."""
    pool = await get_pool()

    try:
        row = await pool.fetchrow(
            "SELECT * FROM lead_forms WHERE id = $1",
            form_id,
        )
    except Exception as exc:
        logger.warning("lead_forms table may not exist yet: %s", exc)
        raise HTTPException(status_code=404, detail="Form not found")

    if not row:
        raise HTTPException(status_code=404, detail="Form not found")

    form = dict(row)
    if isinstance(form.get("fields"), str):
        form["fields"] = json.loads(form["fields"])
    if form.get("created_at"):
        form["created_at"] = form["created_at"].isoformat()

    # Fetch last 5 submissions
    try:
        sub_rows = await pool.fetch(
            """
            SELECT id, form_id, data, source_url, ip_address, submitted_at
            FROM lead_submissions
            WHERE form_id = $1
            ORDER BY submitted_at DESC
            LIMIT 5
            """,
            form_id,
        )
        submissions = []
        for s in sub_rows:
            sd = dict(s)
            if isinstance(sd.get("data"), str):
                sd["data"] = json.loads(sd["data"])
            if sd.get("submitted_at"):
                sd["submitted_at"] = sd["submitted_at"].isoformat()
            submissions.append(sd)
    except Exception as exc:
        logger.warning("lead_submissions table may not exist yet: %s", exc)
        submissions = []

    form["recent_submissions"] = submissions
    return form


@router.put("/forms/{form_id}", dependencies=[Depends(verify_internal_key)])
async def update_form(form_id: str, body: LeadFormUpdate):
    """Update lead form fields."""
    pool = await get_pool()

    try:
        existing = await pool.fetchrow("SELECT * FROM lead_forms WHERE id = $1", form_id)
    except Exception as exc:
        logger.error("Failed to fetch form: %s", exc)
        raise HTTPException(status_code=404, detail="Form not found")

    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")

    # Build update clauses from non-None fields
    updates: list[str] = []
    params: list = []
    idx = 1

    if body.title is not None:
        updates.append(f"title = ${idx}")
        params.append(body.title)
        idx += 1
    if body.description is not None:
        updates.append(f"description = ${idx}")
        params.append(body.description)
        idx += 1
    if body.incentive is not None:
        updates.append(f"incentive = ${idx}")
        params.append(body.incentive)
        idx += 1
    if body.fields is not None:
        updates.append(f"fields = ${idx}::jsonb")
        params.append(json.dumps([f.model_dump() for f in body.fields]))
        idx += 1
    if body.hosting_type is not None:
        updates.append(f"hosting_type = ${idx}")
        params.append(body.hosting_type)
        idx += 1
    if body.is_active is not None:
        updates.append(f"is_active = ${idx}")
        params.append(body.is_active)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(form_id)
    sql = f"UPDATE lead_forms SET {', '.join(updates)} WHERE id = ${idx} RETURNING *"

    try:
        row = await pool.fetchrow(sql, *params)
    except Exception as exc:
        logger.error("Failed to update form: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update form")

    updated = dict(row)
    if isinstance(updated.get("fields"), str):
        updated["fields"] = json.loads(updated["fields"])
    if updated.get("created_at"):
        updated["created_at"] = updated["created_at"].isoformat()
    return updated


@router.delete("/forms/{form_id}", dependencies=[Depends(verify_internal_key)])
async def delete_form(form_id: str):
    """Delete a lead form and all its submissions."""
    pool = await get_pool()

    try:
        result = await pool.execute(
            "DELETE FROM lead_forms WHERE id = $1",
            form_id,
        )
    except Exception as exc:
        logger.error("Failed to delete form: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete form")

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Form not found")

    # Cascade delete submissions (handle separately if no FK cascade)
    try:
        await pool.execute("DELETE FROM lead_submissions WHERE form_id = $1", form_id)
    except Exception as exc:
        logger.warning("Could not delete submissions: %s", exc)

    return {"ok": True, "deleted": form_id}


@router.post("/forms/{form_id}/publish", dependencies=[Depends(verify_internal_key)])
async def publish_form(form_id: str, body: PublishRequest):
    """Publish a lead form and set its hosted URL."""
    pool = await get_pool()

    if body.hosting_type == "own_domain":
        published_url = f"https://app.accelerate.inmobi.com/forms/{form_id}"
    elif body.hosting_type == "typeform":
        published_url = f"https://form.typeform.com/to/{form_id}"
    elif body.hosting_type == "hubspot":
        published_url = f"https://share.hsforms.com/{form_id}"
    else:
        published_url = f"https://app.accelerate.inmobi.com/forms/{form_id}"

    try:
        result = await pool.execute(
            """
            UPDATE lead_forms
            SET hosting_type = $1, published_url = $2, is_active = true
            WHERE id = $3
            """,
            body.hosting_type,
            published_url,
            form_id,
        )
    except Exception as exc:
        logger.error("Failed to publish form: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to publish form")

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Form not found")

    return {"ok": True, "published_url": published_url}


@router.get("/forms/{form_id}/submissions", dependencies=[Depends(verify_internal_key)])
async def list_submissions(
    form_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Paginated list of submissions for a form."""
    pool = await get_pool()

    try:
        total = await pool.fetchval(
            "SELECT COUNT(*) FROM lead_submissions WHERE form_id = $1",
            form_id,
        )
        rows = await pool.fetch(
            """
            SELECT id, form_id, data, source_url, ip_address, submitted_at
            FROM lead_submissions
            WHERE form_id = $1
            ORDER BY submitted_at DESC
            LIMIT $2 OFFSET $3
            """,
            form_id,
            limit,
            offset,
        )
    except Exception as exc:
        logger.warning("lead_submissions table may not exist yet: %s", exc)
        return {"submissions": [], "total": 0}

    submissions = []
    for row in rows:
        sd = dict(row)
        if isinstance(sd.get("data"), str):
            sd["data"] = json.loads(sd["data"])
        if sd.get("submitted_at"):
            sd["submitted_at"] = sd["submitted_at"].isoformat()
        submissions.append(sd)

    return {"submissions": submissions, "total": int(total or 0)}


@router.get("/forms/{form_id}/submissions/export", dependencies=[Depends(verify_internal_key)])
async def export_submissions(form_id: str):
    """Export all submissions for a form as CSV."""
    pool = await get_pool()

    # Fetch form to get field definitions
    try:
        form_row = await pool.fetchrow("SELECT fields FROM lead_forms WHERE id = $1", form_id)
    except Exception as exc:
        logger.error("Failed to fetch form for export: %s", exc)
        raise HTTPException(status_code=404, detail="Form not found")

    if not form_row:
        raise HTTPException(status_code=404, detail="Form not found")

    raw_fields = form_row["fields"]
    fields = json.loads(raw_fields) if isinstance(raw_fields, str) else raw_fields
    field_names = [f["name"] for f in fields]

    # Fetch all submissions
    try:
        rows = await pool.fetch(
            """
            SELECT id, data, source_url, submitted_at
            FROM lead_submissions
            WHERE form_id = $1
            ORDER BY submitted_at DESC
            """,
            form_id,
        )
    except Exception as exc:
        logger.warning("lead_submissions table may not exist yet: %s", exc)
        rows = []

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)

        # Header row
        writer.writerow(field_names + ["source_url", "submitted_at"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for row in rows:
            data = json.loads(row["data"]) if isinstance(row["data"], str) else (row["data"] or {})
            submitted_at = row["submitted_at"].isoformat() if row["submitted_at"] else ""
            writer.writerow(
                [data.get(name, "") for name in field_names]
                + [row["source_url"] or "", submitted_at]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads_{form_id}.csv"},
    )


@router.post("/capture/{form_id}")
async def capture_lead(form_id: str, body: LeadCaptureRequest):
    """Public endpoint — receive a lead submission from a hosted form."""
    pool = await get_pool()

    # Validate form exists and is active
    try:
        form_row = await pool.fetchrow(
            "SELECT id, is_active FROM lead_forms WHERE id = $1",
            form_id,
        )
    except Exception as exc:
        logger.error("Failed to fetch form during capture: %s", exc)
        raise HTTPException(status_code=404, detail="Form not found")

    if not form_row:
        raise HTTPException(status_code=404, detail="Form not found")
    if not form_row["is_active"]:
        raise HTTPException(status_code=400, detail="Form is not active")

    submission_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    try:
        await pool.execute(
            """
            INSERT INTO lead_submissions
              (id, form_id, data, source_url, ip_address, submitted_at)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6)
            """,
            submission_id,
            form_id,
            json.dumps(body.data),
            body.source_url,
            body.ip_address,
            now,
        )
    except Exception as exc:
        logger.error("Failed to insert submission: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to store submission")

    # Track as event in customer_events (non-blocking)
    try:
        event_id = str(uuid.uuid4())
        await pool.execute(
            """
            INSERT INTO customer_events
              (id, org_id, event_type, entity_id, metadata, occurred_at)
            VALUES ($1,
                    (SELECT org_id FROM lead_forms WHERE id = $2),
                    'lead_capture', $3, $4::jsonb, $5)
            """,
            event_id,
            form_id,
            submission_id,
            json.dumps({
                "form_id": form_id,
                "visitor_id": body.visitor_id,
                "utm": body.utm,
                "source_url": body.source_url,
            }),
            now,
        )
    except Exception as exc:
        logger.warning("Could not write customer_events (non-fatal): %s", exc)

    logger.info("Lead captured: submission=%s form=%s", submission_id, form_id)
    return {"ok": True, "submission_id": submission_id}
