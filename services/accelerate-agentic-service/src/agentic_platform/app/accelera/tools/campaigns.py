"""Campaign management tools — 5 tools that call accelerate-campaigns-service.

Health scoring logic ported from Next.js /api/chat/tools/campaigns.ts:
  ROAS >= 3.0 → winner
  ROAS 1.0-3.0 → underperformer
  ROAS < 1.0 → bleeder
  spend < $100 → learner
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import campaigns_client
from src.agentic_platform.app.accelera.blocks import (
    campaign_table_block, CampaignTableData, CampaignRow,
    health_score_card_block, HealthScoreCardData, HealthScoreRow,
    metric_cards_block, MetricCardsData, MetricItem,
)


def _score_campaign(roas: float, spend: float) -> str:
    """Compute health category from ROAS and spend (ported from Next.js)."""
    if spend < 100:
        return "learner"
    if roas >= 3.0:
        return "winner"
    if roas >= 1.0:
        return "underperformer"
    return "bleeder"


def _health_recommendation(category: str) -> str:
    match category:
        case "winner": return "Scale budget — strong ROAS."
        case "learner": return "Allow more spend to gather data before optimizing."
        case "underperformer": return "Review targeting and creatives — ROAS below 3x."
        case "bleeder": return "Pause or significantly reduce budget — negative ROAS."
        case _: return "Review performance."


# ── campaign_health_check ─────────────────────────────────────────────

@tool("campaign_health_check")
async def _campaign_health_check(days: int = 30) -> dict:
    """Score all campaigns as winner, learner, underperformer, or bleeder based on ROAS and spend.
    Use when the user asks how campaigns are performing or wants a health overview."""
    org_id = get_org_id()
    resp = await campaigns_client.post("/campaigns/health-batch", json={"org_id": org_id, "days": days})
    body = resp.get("body", {})
    campaigns = body.get("campaigns", body) if isinstance(body, dict) else body

    rows = []
    for c in (campaigns if isinstance(campaigns, list) else []):
        spend = c.get("spend") or c.get("totalSpend", 0.0)
        revenue = c.get("revenue") or c.get("totalRevenue", 0.0)
        roas = revenue / spend if spend else 0.0
        category = c.get("health") or _score_campaign(roas, spend)
        rows.append(HealthScoreRow(
            campaign_id=c.get("id", ""),
            campaign_name=c.get("name", ""),
            platform=c.get("platform", ""),
            category=category,
            roas=roas,
            spend=spend,
            recommendation=_health_recommendation(category),
        ))

    winners = sum(1 for r in rows if r.category == "winner")
    bleeders = sum(1 for r in rows if r.category == "bleeder")

    return ToolResponse(
        summary=f"Health check: {len(rows)} campaigns — {winners} winners, {bleeders} bleeders.",
        data={"campaigns": [r.model_dump() for r in rows]},
        ui_blocks=[health_score_card_block.create(data=HealthScoreCardData(campaigns=rows))],
    ).model_dump()

campaign_health_check = AgenticTool(func=_campaign_health_check, thinking_messages=["Scoring your campaigns..."], tags=[ToolTag.ANALYTICS])


# ── campaign_optimizer ────────────────────────────────────────────────

@tool("campaign_optimizer")
async def _campaign_optimizer(days: int = 30) -> dict:
    """Analyze campaign performance and generate specific optimization recommendations.
    Use when the user asks how to improve campaigns or wants optimization advice."""
    org_id = get_org_id()
    resp = await campaigns_client.get(f"/campaigns?org_id={org_id}&days={days}")
    body = resp.get("body", {})
    campaigns = body.get("campaigns", []) if isinstance(body, dict) else []

    actions = []
    for c in campaigns:
        spend = c.get("spend") or c.get("totalSpend", 0.0)
        revenue = c.get("revenue") or c.get("totalRevenue", 0.0)
        roas = revenue / spend if spend else 0.0
        category = _score_campaign(roas, spend)
        name = c.get("name", "")
        platform = c.get("platform", "")

        if category == "bleeder":
            actions.append({"campaign": name, "platform": platform, "action": "Pause campaign", "reason": f"ROAS {roas:.2f}x — spending money with no return.", "priority": "high"})
        elif category == "winner":
            actions.append({"campaign": name, "platform": platform, "action": "Increase budget by 20%", "reason": f"ROAS {roas:.2f}x — strong performance, scale up.", "priority": "medium"})
        elif category == "underperformer":
            actions.append({"campaign": name, "platform": platform, "action": "Review creatives and targeting", "reason": f"ROAS {roas:.2f}x — room for improvement.", "priority": "medium"})

    high_priority = [a for a in actions if a["priority"] == "high"]
    metrics = [MetricItem(label=a["campaign"][:20], value=a["action"]) for a in actions[:5]]

    return ToolResponse(
        summary=f"Optimization plan: {len(actions)} actions ({len(high_priority)} high priority).",
        data={"actions": actions},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Optimization Actions"))],
    ).model_dump()

campaign_optimizer = AgenticTool(func=_campaign_optimizer, thinking_messages=["Generating optimization recommendations..."], tags=[ToolTag.ANALYTICS])


# ── toggle_campaign ───────────────────────────────────────────────────

@tool("toggle_campaign")
async def _toggle_campaign(campaign_id: str, status: str) -> dict:
    """Pause or activate a campaign. Status must be 'paused' or 'active'.
    Use when the user explicitly asks to pause or turn on a specific campaign."""
    org_id = get_org_id()
    if status not in ("paused", "active"):
        return ToolResponse(summary="Invalid status. Use 'paused' or 'active'.", data={}).model_dump()

    resp = await campaigns_client.patch(f"/campaigns/{campaign_id}/status", json={"org_id": org_id, "status": status})
    body = resp.get("body", {})
    success = body.get("success", resp.get("status_code") == 200)

    summary = f"Campaign {campaign_id} {'paused' if status == 'paused' else 'activated'} successfully." if success else f"Failed to update campaign {campaign_id}."
    return ToolResponse(summary=summary, data=body).model_dump()

toggle_campaign = AgenticTool(func=_toggle_campaign, thinking_messages=["Updating campaign status..."], tags=[ToolTag.ANALYTICS])


# ── update_budget ─────────────────────────────────────────────────────

@tool("update_budget")
async def _update_budget(campaign_id: str, daily_budget: float, budget_type: str = "absolute") -> dict:
    """Update a campaign's daily budget. budget_type: 'absolute' (set exact value) or 'percent' (increase by %).
    Use when the user explicitly asks to change a campaign's budget."""
    org_id = get_org_id()
    resp = await campaigns_client.patch(f"/campaigns/{campaign_id}/budget", json={
        "org_id": org_id,
        "daily_budget": daily_budget,
        "type": budget_type,
    })
    body = resp.get("body", {})
    success = body.get("success", resp.get("status_code") == 200)
    new_budget = body.get("new_budget", daily_budget)

    summary = f"Budget updated to ${new_budget:,.2f}/day." if success else f"Failed to update budget for {campaign_id}."
    return ToolResponse(summary=summary, data=body).model_dump()

update_budget = AgenticTool(func=_update_budget, thinking_messages=["Updating campaign budget..."], tags=[ToolTag.ANALYTICS])


# ── get_campaign_history ──────────────────────────────────────────────

@tool("get_campaign_history")
async def _get_campaign_history(status: str = "all", limit: int = 20) -> dict:
    """List all campaigns with budgets, status, and health scores.
    Use when the user asks to see their campaigns, campaign list, or campaign history."""
    org_id = get_org_id()
    path = f"/campaigns?org_id={org_id}&limit={limit}"
    if status != "all":
        path += f"&status={status}"
    resp = await campaigns_client.get(path)
    body = resp.get("body", {})
    campaigns = body.get("campaigns", []) if isinstance(body, dict) else []

    rows = []
    for c in campaigns:
        spend = c.get("spend") or c.get("totalSpend", 0.0)
        revenue = c.get("revenue") or c.get("totalRevenue", 0.0)
        roas = revenue / spend if spend else 0.0
        rows.append(CampaignRow(
            id=c.get("id", ""),
            name=c.get("name", ""),
            platform=c.get("platform", ""),
            status=c.get("status", ""),
            spend=spend,
            impressions=c.get("impressions", 0),
            clicks=c.get("clicks", 0),
            roas=roas,
            budget=c.get("dailyBudget") or c.get("daily_budget", 0.0),
            health=_score_campaign(roas, spend),
        ))

    return ToolResponse(
        summary=f"Found {len(rows)} campaigns.",
        data={"campaigns": [r.model_dump() for r in rows]},
        ui_blocks=[campaign_table_block.create(data=CampaignTableData(campaigns=rows))],
    ).model_dump()

get_campaign_history = AgenticTool(func=_get_campaign_history, thinking_messages=["Loading your campaigns..."], tags=[ToolTag.ANALYTICS])


# ── get_campaign_metrics ──────────────────────────────────────────────

@tool("get_campaign_metrics")
async def _get_campaign_metrics(campaign_id: str, days: int = 30) -> dict:
    """Get detailed KPI metrics for a specific campaign: spend, impressions, clicks,
    CTR, CPC, conversions, and ROAS. Use when the user asks about a specific campaign's
    performance numbers, not a health overview of all campaigns."""
    org_id = get_org_id()
    resp = await campaigns_client.get(f"/campaigns/{campaign_id}?org_id={org_id}&days={days}")
    body = resp.get("body", {})
    c = body if isinstance(body, dict) else {}

    spend = c.get("spend") or c.get("totalSpend", 0.0)
    impressions = c.get("impressions", 0)
    clicks = c.get("clicks", 0)
    conversions = c.get("conversions", 0)
    revenue = c.get("revenue") or c.get("totalRevenue", 0.0)
    roas = revenue / spend if spend else 0.0
    ctr = (clicks / impressions * 100) if impressions else 0.0
    cpc = spend / clicks if clicks else 0.0
    cpa = spend / conversions if conversions else 0.0

    metrics = [
        MetricItem(label="Spend", value=f"${spend:,.2f}", period=f"Last {days}d"),
        MetricItem(label="Impressions", value=f"{impressions:,}"),
        MetricItem(label="Clicks", value=f"{clicks:,}"),
        MetricItem(label="CTR", value=f"{ctr:.2f}%"),
        MetricItem(label="CPC", value=f"${cpc:.2f}"),
        MetricItem(label="Conversions", value=f"{conversions:,}"),
        MetricItem(label="ROAS", value=f"{roas:.2f}x"),
        MetricItem(label="CPA", value=f"${cpa:.2f}"),
    ]

    return ToolResponse(
        summary=f"Campaign {campaign_id}: ${spend:,.2f} spend, {roas:.2f}x ROAS, {conversions} conversions over {days} days.",
        data=c,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=c.get("name", f"Campaign {campaign_id}"),
            period=f"Last {days} days",
        ))],
    ).model_dump()

get_campaign_metrics = AgenticTool(
    func=_get_campaign_metrics,
    thinking_messages=["Fetching campaign metrics..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)


# ── get_campaign_performance_history ─────────────────────────────────

@tool("get_campaign_performance_history")
async def _get_campaign_performance_history(campaign_id: str, days: int = 30) -> dict:
    """Get historical day-by-day performance trend for a specific campaign.
    Returns spend, clicks, and ROAS plotted over time.
    Use when the user asks how a campaign has performed over time or wants to see trends."""
    from src.agentic_platform.app.accelera.services.clients import reporting_client
    from src.agentic_platform.app.accelera.blocks import performance_chart_block, PerformanceChartData, ChartSeries

    org_id = get_org_id()
    resp = await reporting_client.post("/report", json={
        "org_id": org_id,
        "campaign_id": campaign_id,
        "days": days,
        "metrics": ["spend", "clicks", "roas"],
        "group_by": "date",
    })
    body = resp.get("body", {})
    rows = body.get("rows", []) if isinstance(body, dict) else []

    spend_series = ChartSeries(
        name="Spend ($)",
        data=[{"date": r.get("date", ""), "value": r.get("spend", 0.0)} for r in rows],
        color="#3B82F6",
    )
    roas_series = ChartSeries(
        name="ROAS",
        data=[{"date": r.get("date", ""), "value": r.get("roas", 0.0)} for r in rows],
        color="#10B981",
    )

    return ToolResponse(
        summary=f"Performance trend for campaign {campaign_id} over the last {days} days.",
        data={"rows": rows},
        ui_blocks=[performance_chart_block.create(data=PerformanceChartData(
            series=[spend_series, roas_series],
            title=f"Campaign Performance — Last {days} days",
            period=f"Last {days} days",
        ))],
    ).model_dump()

get_campaign_performance_history = AgenticTool(
    func=_get_campaign_performance_history,
    thinking_messages=["Loading campaign trend data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)
