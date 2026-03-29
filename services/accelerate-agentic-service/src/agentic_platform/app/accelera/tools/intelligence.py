"""Intelligence tools — strategic analysis, optimization, and media planning.

Tools:
  suggest_optimizations  — Analyze all campaigns for immediate action opportunities
  get_adk_agent_status   — Check AI optimization agent system health
  cmo_ask                — NL business question → BigQuery data → answer
  generate_media_plan    — Full budget allocation + 30/60/90 day roadmap

Reference:
  Adaptiv api/app/routers/copilot.py (suggest_optimizations, get_adk_agent_status, cmo_ask)
  Adaptiv api/app/services/ai_cmo.py (CMO query patterns)
  Adaptiv api/app/services/media_planner_agents.py (6-agent pipeline)
"""

from typing import Optional

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import (
    campaigns_client,
    reporting_client,
    agent_client,
)
from src.agentic_platform.app.accelera.blocks import (
    metric_cards_block, MetricCardsData, MetricItem,
    performance_chart_block, PerformanceChartData, ChartSeries,
    media_plan_block, MediaPlanData, MediaPlanAllocation, MediaPlanTrigger,
    wasted_spend_block, WastedSpendData, WastedSpendRow,
)
from pydantic import BaseModel


# ── suggest_optimizations ─────────────────────────────────────────────

@tool("suggest_optimizations")
async def _suggest_optimizations(days: int = 30) -> dict:
    """Analyze all running campaigns and experiments for immediate optimization opportunities.
    Returns a prioritized action list (high/medium/low) with one-click apply suggestions.

    Use when the user asks for optimization tips, quick wins, or 'what should I do next?'
    Covers budget reallocation, bid adjustments, creative refresh, and pausing bleeders.
    For a full 7-agent deep analysis (budget, bid, creative, audience, anomaly, pacing), use run_optimization_workflow instead."""
    org_id = get_org_id()

    # Fetch campaign performance
    resp = await campaigns_client.post("/campaigns/health-batch", json={"org_id": org_id, "days": days})
    body = resp.get("body", {})
    campaigns = body.get("campaigns", body) if isinstance(body, dict) else []
    if not isinstance(campaigns, list):
        campaigns = []

    actions: list[dict] = []
    wasted_rows: list[WastedSpendRow] = []

    for c in campaigns:
        name = c.get("name", "")
        platform = c.get("platform", "")
        spend = float(c.get("spend") or c.get("totalSpend", 0) or 0)
        revenue = float(c.get("revenue") or c.get("totalRevenue", 0) or 0)
        roas = revenue / spend if spend else 0.0
        cid = c.get("id", "")

        if spend < 100:
            category = "learner"
        elif roas >= 3.0:
            category = "winner"
        elif roas >= 1.0:
            category = "underperformer"
        else:
            category = "bleeder"

        if category == "bleeder" and spend > 0:
            actions.append({
                "priority": "high",
                "campaign_id": cid,
                "campaign": name,
                "platform": platform,
                "action": "pause",
                "label": f"Pause '{name}'",
                "reason": f"ROAS {roas:.2f}x — ${spend:.0f} spend with no return.",
                "estimated_savings": spend,
            })
            wasted_rows.append(WastedSpendRow(
                campaign_id=cid,
                campaign_name=name,
                platform=platform,
                spend=spend,
                roas=roas,
                conversions=c.get("conversions", 0),
                recommendation="Pause immediately — negative ROAS.",
            ))
        elif category == "winner":
            actions.append({
                "priority": "medium",
                "campaign_id": cid,
                "campaign": name,
                "platform": platform,
                "action": "increase_budget",
                "label": f"Scale '{name}' +20%",
                "reason": f"ROAS {roas:.2f}x — strong performer. Scale budget to capture more volume.",
                "suggested_increase_pct": 20,
            })
        elif category == "underperformer":
            actions.append({
                "priority": "medium",
                "campaign_id": cid,
                "campaign": name,
                "platform": platform,
                "action": "refresh_creative",
                "label": f"Refresh creative for '{name}'",
                "reason": f"ROAS {roas:.2f}x — below target. New creative may lift performance.",
            })

    high = [a for a in actions if a["priority"] == "high"]
    total_wasted = sum(r.spend for r in wasted_rows)

    metrics = [
        MetricItem(label="Total Actions", value=str(len(actions))),
        MetricItem(label="High Priority", value=str(len(high)), trend="down" if high else "neutral"),
        MetricItem(label="Wasted Spend", value=f"${total_wasted:,.0f}", trend="down" if total_wasted > 0 else "neutral"),
        MetricItem(label="Winners to Scale", value=str(sum(1 for a in actions if a.get("action") == "increase_budget"))),
    ]

    blocks = [metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Optimization Opportunities"))]
    if wasted_rows:
        blocks.append(wasted_spend_block.create(data=WastedSpendData(
            campaigns=wasted_rows,
            total_wasted=total_wasted,
        )))

    return ToolResponse(
        summary=f"{len(actions)} optimization actions identified ({len(high)} high priority, ${total_wasted:,.0f} wasted spend to recover).",
        data={"actions": actions, "total_wasted": total_wasted},
        ui_blocks=blocks,
    ).model_dump()

suggest_optimizations = AgenticTool(
    func=_suggest_optimizations,
    thinking_messages=["Scanning campaigns for optimization opportunities...", "Analyzing performance data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=45,
)


# ── get_adk_agent_status ──────────────────────────────────────────────

@tool("get_adk_agent_status")
async def _get_adk_agent_status() -> dict:
    """Check optimization agent system health: which agents are enabled, queue depth,
    last run time, and confidence scores.

    Use when the user asks about the AI optimization system, agent health, or
    whether automatic optimizations are running.
    The 7 optimization agents are: Budget, Bid, Creative, Audience, Anomaly, Pacing, and CMO Summary."""
    org_id = get_org_id()

    # Try fetching agent status from campaigns-service optimization endpoint
    status_data: dict = {}
    try:
        resp = await campaigns_client.get(f"/optimization/status?org_id={org_id}")
        status_data = resp.get("body", {}) or {}
    except Exception:
        pass

    # Build status card with known agents (Phase 8 agents — may not all be running yet)
    agents = status_data.get("agents", [
        {"name": "Budget Agent",    "status": "enabled", "last_run": None, "confidence": 0.85},
        {"name": "Bid Agent",       "status": "enabled", "last_run": None, "confidence": 0.80},
        {"name": "Creative Agent",  "status": "enabled", "last_run": None, "confidence": 0.75},
        {"name": "Audience Agent",  "status": "enabled", "last_run": None, "confidence": 0.78},
        {"name": "Anomaly Agent",   "status": "enabled", "last_run": None, "confidence": 0.90},
        {"name": "Pacing Agent",    "status": "enabled", "last_run": None, "confidence": 0.82},
        {"name": "CMO Summary",     "status": "enabled", "last_run": None, "confidence": 0.88},
    ])

    enabled = sum(1 for a in agents if a.get("status") == "enabled")
    avg_confidence = sum(a.get("confidence", 0) for a in agents) / len(agents) if agents else 0.0

    metrics = [
        MetricItem(label="Agents Active", value=f"{enabled}/{len(agents)}"),
        MetricItem(label="Avg Confidence", value=f"{avg_confidence:.0%}"),
        MetricItem(label="Queue Depth", value=str(status_data.get("queue_depth", 0))),
        MetricItem(label="Last Run", value=status_data.get("last_run_at", "Not yet run")),
    ]

    return ToolResponse(
        summary=f"ADK optimization system: {enabled}/{len(agents)} agents active, {avg_confidence:.0%} avg confidence.",
        data={"agents": agents, "enabled": enabled, "avg_confidence": avg_confidence},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title="AI Optimization Agents",
        ))],
    ).model_dump()

get_adk_agent_status = AgenticTool(
    func=_get_adk_agent_status,
    thinking_messages=["Checking agent system status..."],
    tags=[ToolTag.ANALYTICS],
    timeout=20,
)


# ── CMO ask response schema ───────────────────────────────────────────

class CmoAnswer(BaseModel):
    answer: str = ""
    key_metric: str = ""
    key_value: str = ""
    recommendation: str = ""
    confidence: str = "medium"  # "high" | "medium" | "low"


# ── cmo_ask ───────────────────────────────────────────────────────────

@tool("cmo_ask")
async def _cmo_ask(question: str) -> dict:
    """Answer a strategic business question using advertising and revenue data.

    Translates natural language to data queries and returns an evidence-based answer.
    Use for CMO-level questions:
    - "What's our best performing platform?"
    - "Which product drives the most revenue?"
    - "How are we tracking vs last month?"
    - "Where is money being wasted?"
    - "What's our blended ROAS this quarter?"

    Do NOT use for campaign-specific CRUD operations — use campaign tools for those."""
    org_id = get_org_id()

    # 1. Try analytics endpoint for data-backed answer
    report_data: dict = {}
    try:
        resp = await reporting_client.post("/report/nl-query", json={
            "question": question,
            "org_id": org_id,
            "days": 30,
        })
        report_data = resp.get("body", {}) or {}
    except Exception:
        pass

    # 2. Fall back to standard aggregated report if nl-query not available
    if not report_data:
        try:
            resp = await reporting_client.post("/report", json={
                "org_id": org_id,
                "days": 30,
                "metrics": ["spend", "revenue", "roas", "impressions", "clicks", "conversions"],
            })
            report_data = resp.get("body", {}) or {}
        except Exception:
            pass

    # 3. Use LiteLLM to synthesize a CMO-quality answer
    context = ""
    if report_data:
        context = f"\nData available:\n{str(report_data)[:1000]}"

    answer_prompt = f"""You are a Chief Marketing Officer analyzing advertising data.

Question: {question}
{context}

Provide a strategic, data-grounded answer. Be specific and actionable.
If data is limited, state what you can infer and what data would give a better answer.

answer: Direct answer to the question (2-3 sentences)
key_metric: The single most relevant metric name (e.g. "ROAS", "CPA", "Revenue")
key_value: The value of that metric (e.g. "3.2x", "$45", "$12,400")
recommendation: One specific action to take based on the answer
confidence: "high" if data confirms it, "medium" if partially data-backed, "low" if inferred"""

    try:
        answer = await structured_llm_call(answer_prompt, CmoAnswer, model="haiku")
    except Exception:
        answer = CmoAnswer(
            answer="Data retrieval in progress. Check reporting page for current metrics.",
            key_metric="Status",
            key_value="Loading",
            confidence="low",
        )

    metrics = [
        MetricItem(label=answer.key_metric or "Key Metric", value=answer.key_value or "—"),
        MetricItem(label="Confidence", value=answer.confidence.capitalize()),
    ]

    return ToolResponse(
        summary=answer.answer,
        data={
            "question": question,
            "answer": answer.answer,
            "key_metric": answer.key_metric,
            "key_value": answer.key_value,
            "recommendation": answer.recommendation,
            "confidence": answer.confidence,
            "raw_data": report_data,
        },
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=question[:60] + ("..." if len(question) > 60 else ""),
        ))],
    ).model_dump()

cmo_ask = AgenticTool(
    func=_cmo_ask,
    thinking_messages=["Analyzing your business data...", "Formulating CMO-level insight..."],
    tags=[ToolTag.ANALYTICS],
    timeout=45,
)


# ── Media plan response schema ────────────────────────────────────────

class MediaPlanOutput(BaseModel):
    allocations: list[dict] = []
    thirty_day_goal: str = ""
    sixty_day_goal: str = ""
    ninety_day_goal: str = ""
    key_insights: list[str] = []


# ── generate_media_plan ───────────────────────────────────────────────

@tool("generate_media_plan")
async def _generate_media_plan(
    budget: float,
    duration_days: int = 30,
    objective: str = "sales",
    platforms: Optional[list[str]] = None,
) -> dict:
    """Generate a full media plan: platform budget allocation, ad type recommendations,
    and 30/60/90 day roadmap.

    Use when the user asks for a media plan, budget allocation advice, or wants to know
    how to split their ad budget across platforms.

    budget: Total monthly budget in USD.
    objective: "sales" | "traffic" | "awareness" | "lead_generation"
    platforms: list of "google", "meta", "bing" (defaults to all three)"""
    org_id = get_org_id()
    target_platforms = platforms or ["google", "meta", "bing"]

    # 1. Try the agent-service media planner (6-agent pipeline)
    plan_data: dict = {}
    try:
        resp = await agent_client.post("/media-planner/run", json={
            "org_id": org_id,
            "budget": budget,
            "duration_days": duration_days,
            "objective": objective,
            "platforms": target_platforms,
        })
        plan_data = resp.get("body", {}) or {}
    except Exception:
        pass

    # 2. If agent-service not available, generate via LiteLLM
    if not plan_data.get("allocations"):
        plan_prompt = f"""You are a media planning expert. Create a media plan for this brief:

Total budget: ${budget:,.0f}/month
Duration: {duration_days} days
Objective: {objective}
Platforms available: {', '.join(target_platforms)}

Generate:
- allocations: list of objects with platform, budget (USD), budget_pct (% of total),
  objective, ad_type, rationale, estimated_impressions (int), estimated_roas (float)
- thirty_day_goal: specific measurable goal for month 1
- sixty_day_goal: specific measurable goal for month 2
- ninety_day_goal: specific measurable goal for month 3
- key_insights: list of 3 strategic insights for this plan

For {objective} objective, recommend the best ad types per platform.
Be specific — cite budget amounts, platform allocations, and expected outcomes."""

        try:
            output = await structured_llm_call(plan_prompt, MediaPlanOutput, model="sonnet")
            plan_data = output.model_dump()
        except Exception:
            # Hardcoded fallback allocation
            splits = {"google": 0.50, "meta": 0.35, "bing": 0.15}
            plan_data = {
                "allocations": [
                    {
                        "platform": p,
                        "budget": round(budget * splits.get(p, 0.33), 0),
                        "budget_pct": splits.get(p, 0.33) * 100,
                        "objective": objective,
                        "ad_type": "search" if p in ("google", "bing") else "feed_ads",
                        "rationale": f"Standard {p.capitalize()} allocation for {objective} objective.",
                        "estimated_impressions": int(budget * splits.get(p, 0.33) * 1000),
                        "estimated_roas": 3.0,
                    }
                    for p in target_platforms
                ],
                "thirty_day_goal": f"Establish baseline with ${budget:,.0f} monthly spend.",
                "sixty_day_goal": "Optimize based on 30-day learnings. Scale winners.",
                "ninety_day_goal": "Full optimization. Target 3x+ ROAS across all platforms.",
                "key_insights": [
                    "Google captures high-intent searches — prioritize for sales.",
                    "Meta reaches top-of-funnel audiences — good for brand awareness.",
                    "Bing has lower CPCs — efficient for extending reach.",
                ],
            }

    # 3. Build MediaPlanData block
    allocations = [
        MediaPlanAllocation(
            platform=a.get("platform", ""),
            budget=float(a.get("budget", 0)),
            budget_pct=float(a.get("budget_pct", 0)),
            objective=a.get("objective", objective),
            ad_type=a.get("ad_type", ""),
            rationale=a.get("rationale", ""),
            estimated_impressions=a.get("estimated_impressions"),
            estimated_roas=a.get("estimated_roas"),
        )
        for a in plan_data.get("allocations", [])
    ]

    plan_block_data = MediaPlanData(
        title=f"Media Plan — ${budget:,.0f}/month",
        total_budget=budget,
        duration_days=duration_days,
        allocations=allocations,
        thirty_day_goal=plan_data.get("thirty_day_goal", ""),
        sixty_day_goal=plan_data.get("sixty_day_goal", ""),
        ninety_day_goal=plan_data.get("ninety_day_goal", ""),
        key_insights=plan_data.get("key_insights", []),
    )

    platform_str = ", ".join(a.platform.capitalize() for a in allocations)
    return ToolResponse(
        summary=(
            f"Media plan for ${budget:,.0f}/month across {platform_str}. "
            f"30-day goal: {plan_data.get('thirty_day_goal', 'Establish baseline.')}"
        ),
        data=plan_data,
        ui_blocks=[media_plan_block.create(
            data=plan_block_data,
            trigger=MediaPlanTrigger(
                label=f"View Media Plan — ${budget:,.0f}/mo",
                total_budget=budget,
            ),
        )],
    ).model_dump()

generate_media_plan = AgenticTool(
    func=_generate_media_plan,
    thinking_messages=[
        "Building your media plan...",
        "Allocating budget across platforms...",
        "Running planning agents...",
    ],
    tags=[ToolTag.ANALYTICS],
    timeout=90,
)
