"""Audience tools — 6 tools that call accelerate-cdp-service.

Audience size estimation logic ported from Next.js /api/chat/tools/audiences.ts.
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import cdp_client
from src.agentic_platform.app.accelera.models.audiences import REGION_KEYS
from src.agentic_platform.app.accelera.blocks import (
    audience_card_block, AudienceCardData, AudienceRow,
    metric_cards_block, MetricCardsData, MetricItem,
)


def _estimate_audience_size(audience_type: str, event_type: str = "", source_size: int = 0, ratio: float = 0.01) -> int:
    """Estimate audience size (ported from Next.js estimation logic)."""
    match audience_type:
        case "customer_list": return int(source_size * 0.60)      # 60% email match
        case "website":
            match event_type:
                case "all_visitors": return source_size * 10
                case "add_to_cart": return source_size * 3
                case _: return source_size * 5
        case "catalog": return source_size * 2
        case "lookalike": return int(source_size / ratio * 0.01)
        case _: return source_size


# ── list_audiences ────────────────────────────────────────────────────

@tool("list_audiences")
async def _list_audiences() -> dict:
    """List all custom, lookalike, and saved audience segments.
    Use when the user asks about their audiences or wants to see available targeting options."""
    org_id = get_org_id()
    resp = await cdp_client.get(f"/segments?org_id={org_id}")
    body = resp.get("body", {})
    segments = body.get("segments", body) if isinstance(body, dict) else body

    rows = [
        AudienceRow(
            id=s.get("id", ""),
            name=s.get("name", ""),
            type=s.get("type", "custom"),
            estimated_size=s.get("estimatedSize") or s.get("estimated_size", 0),
            status=s.get("status", "ready"),
            platform=s.get("platform", "meta"),
        )
        for s in (segments if isinstance(segments, list) else [])
    ]

    return ToolResponse(
        summary=f"Found {len(rows)} audience segments.",
        data={"audiences": [r.model_dump() for r in rows]},
        ui_blocks=[audience_card_block.create(data=AudienceCardData(audiences=rows, total_count=len(rows)))],
    ).model_dump()

list_audiences = AgenticTool(func=_list_audiences, thinking_messages=["Loading your audience segments..."], tags=[ToolTag.ANALYTICS])


# ── create_custom_audience ────────────────────────────────────────────

@tool("create_custom_audience")
async def _create_custom_audience(
    name: str,
    audience_type: str,
    platform: str = "meta",
    event_type: str = "all_visitors",
    source_size: int = 1000,
) -> dict:
    """Create a custom audience segment (customer_list, website, or catalog).
    Use when the user asks to create an audience or set up retargeting."""
    org_id = get_org_id()
    estimated_size = _estimate_audience_size(audience_type, event_type, source_size)

    resp = await cdp_client.post("/segments", json={
        "org_id": org_id,
        "name": name,
        "type": audience_type,
        "platform": platform,
        "event_type": event_type,
        "estimated_size": estimated_size,
    })
    body = resp.get("body", {})

    return ToolResponse(
        summary=f"Created '{name}' audience (~{estimated_size:,} people).",
        data={"audience": body, "estimated_size": estimated_size},
    ).model_dump()

create_custom_audience = AgenticTool(func=_create_custom_audience, thinking_messages=["Creating your audience..."], tags=[ToolTag.ANALYTICS])


# ── create_lookalike_audience ─────────────────────────────────────────

@tool("create_lookalike_audience")
async def _create_lookalike_audience(
    name: str,
    source_audience_id: str,
    platform: str = "meta",
    ratio: float = 0.01,
) -> dict:
    """Create a lookalike audience from an existing source audience.
    Use when the user wants to find new customers similar to existing ones."""
    org_id = get_org_id()
    resp = await cdp_client.post("/segments", json={
        "org_id": org_id,
        "name": name,
        "type": "lookalike",
        "platform": platform,
        "source_id": source_audience_id,
        "ratio": ratio,
    })
    body = resp.get("body", {})
    estimated_size = body.get("estimatedSize") or body.get("estimated_size", 0)

    return ToolResponse(
        summary=f"Created lookalike audience '{name}' (~{estimated_size:,} people, {ratio*100:.0f}% similarity).",
        data={"audience": body},
    ).model_dump()

create_lookalike_audience = AgenticTool(func=_create_lookalike_audience, thinking_messages=["Building lookalike audience..."], tags=[ToolTag.ANALYTICS])


# ── get_audience_insights ─────────────────────────────────────────────

@tool("get_audience_insights")
async def _get_audience_insights(audience_id: str) -> dict:
    """Get insights for a specific audience: size, overlap data, and sync status.
    Use when the user asks about a specific audience's details or performance."""
    resp = await cdp_client.get(f"/segments/{audience_id}")
    body = resp.get("body", {})

    size = body.get("estimatedSize") or body.get("estimated_size", 0)
    name = body.get("name", audience_id)
    status = body.get("status", "unknown")

    metrics = [
        MetricItem(label="Audience Size", value=f"{size:,}"),
        MetricItem(label="Status", value=status.capitalize()),
        MetricItem(label="Type", value=body.get("type", "custom").capitalize()),
        MetricItem(label="Platform", value=body.get("platform", "meta").capitalize()),
    ]

    return ToolResponse(
        summary=f"Audience '{name}': {size:,} people, status: {status}.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title=f"Audience: {name}"))],
    ).model_dump()

get_audience_insights = AgenticTool(func=_get_audience_insights, thinking_messages=["Fetching audience insights..."], tags=[ToolTag.ANALYTICS])


# ── smart_targeting ───────────────────────────────────────────────────

@tool("smart_targeting")
async def _smart_targeting() -> dict:
    """Generate data-driven targeting recommendations based on order history.
    Use when the user asks for targeting suggestions or audience strategy."""
    org_id = get_org_id()
    resp = await cdp_client.post(f"/segments/compute", json={"org_id": org_id, "type": "smart_targeting"})
    body = resp.get("body", {})

    geo = body.get("top_regions") or body.get("geo", [])
    aov_segment = body.get("aov_segment", "mid_tier")
    ltv = body.get("ltv_estimate", 0.0)

    metrics = [
        MetricItem(label="Top Regions", value=", ".join(geo[:3]) if geo else "N/A"),
        MetricItem(label="Customer Segment", value=aov_segment.replace("_", " ").title()),
        MetricItem(label="Est. LTV", value=f"${ltv:,.2f}"),
    ]

    return ToolResponse(
        summary=f"Smart targeting: focus on {', '.join(geo[:2]) or 'top regions'}, {aov_segment} AOV segment.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Smart Targeting Recommendations"))],
    ).model_dump()

smart_targeting = AgenticTool(func=_smart_targeting, thinking_messages=["Analyzing your customer data for targeting..."], tags=[ToolTag.ANALYTICS])


# ── search_locations ──────────────────────────────────────────────────

@tool("search_locations")
async def _search_locations(query: str) -> dict:
    """Resolve location names to Meta geo-targeting keys for audience and campaign setup.
    Use when the user asks about targeting specific locations or geographic regions."""
    query_lower = query.lower().strip()
    matches = []
    for key, loc in REGION_KEYS.items():
        if query_lower in key or key in query_lower:
            matches.append(loc.model_dump())

    if not matches:
        return ToolResponse(
            summary=f"No exact match for '{query}'. Try country or region names like 'United States', 'California', 'United Kingdom'.",
            data={"query": query, "matches": []},
        ).model_dump()

    return ToolResponse(
        summary=f"Found {len(matches)} location(s) matching '{query}'.",
        data={"query": query, "matches": matches},
    ).model_dump()

search_locations = AgenticTool(func=_search_locations, thinking_messages=["Looking up location targeting keys..."], tags=[ToolTag.ANALYTICS])
