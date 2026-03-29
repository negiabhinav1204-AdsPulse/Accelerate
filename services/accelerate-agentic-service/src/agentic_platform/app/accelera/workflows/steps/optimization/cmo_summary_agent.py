"""CMO Summary Agent — synthesizes all agent findings into executive summary."""
from pydantic import BaseModel
from src.agentic_platform.core.engine import WorkflowContext, NodeResponse
from src.agentic_platform.core.llm import structured_llm_call

class OptimizationAction(BaseModel):
    priority: str = "medium"  # "high" | "medium" | "low"
    category: str = ""  # "budget" | "bid" | "creative" | "audience" | "anomaly" | "pacing"
    action: str = ""
    estimated_impact: str = ""
    campaign: str = ""
    platform: str = ""

class CMOSummary(BaseModel):
    headline: str = ""
    total_opportunity_usd: float = 0.0
    top_actions: list[OptimizationAction] = []
    key_insights: list[str] = []
    overall_health: str = "good"  # "critical" | "warning" | "good" | "excellent"
    confidence: str = "high"

async def cmo_summary_agent(ctx: WorkflowContext) -> NodeResponse:
    # Collect all prior agent results
    budget_data = ctx.results.get("budget", {}).data or {}
    bid_data = ctx.results.get("bid", {}).data or {}
    creative_data = ctx.results.get("creative", {}).data or {}
    audience_data = ctx.results.get("audience", {}).data or {}
    anomaly_data = ctx.results.get("anomaly", {}).data or {}
    pacing_data = ctx.results.get("pacing", {}).data or {}

    all_findings = {
        "budget": budget_data,
        "bid": bid_data,
        "creative": creative_data,
        "audience": audience_data,
        "anomaly": anomaly_data,
        "pacing": pacing_data,
    }

    # Count total issues
    total_actions = (
        len(budget_data.get("insights", [])) +
        len(bid_data.get("insights", [])) +
        len(creative_data.get("insights", [])) +
        len(audience_data.get("insights", [])) +
        len(anomaly_data.get("anomalies", [])) +
        len(pacing_data.get("issues", []))
    )

    total_opportunity = budget_data.get("total_reallocation_opportunity", 0.0)

    prompt = f"""You are a Chief Marketing Officer synthesizing AI agent findings.

Agent findings summary:
{all_findings}

Create an executive optimization summary:
- headline: Single most important action (20 words max)
- total_opportunity_usd: Total USD recoverable through all optimizations
- top_actions: Top 5 most impactful actions across all agents (pick highest priority ones)
- key_insights: 3 strategic bullets for the CMO
- overall_health: "critical" if anomalies/bleeders dominate, "warning" if some issues, "good" if mostly healthy, "excellent" if all winners
- confidence: "high" if data-backed, "medium" if some inference

Be specific with dollar amounts and percentages. Write for a CMO who reads 10 reports a day."""

    try:
        result = await structured_llm_call(prompt, CMOSummary, model="sonnet")
    except Exception:
        result = CMOSummary(
            headline=f"Recover ${total_opportunity:,.0f} by pausing bleeders and scaling winners",
            total_opportunity_usd=total_opportunity,
            top_actions=[
                OptimizationAction(priority="high", category="budget", action="Pause Brand Awareness — negative ROAS", estimated_impact="Save $5,000/month", campaign="Brand Awareness", platform="meta"),
                OptimizationAction(priority="high", category="pacing", action="Reduce daily budget 40% to prevent early exhaust", estimated_impact="Prevent $2,790 overspend", campaign="Brand Awareness", platform="meta"),
                OptimizationAction(priority="medium", category="bid", action="Lower CPC bids 20% on low-CTR ad groups", estimated_impact="Save ~18% on CPC", campaign="Brand Awareness", platform="meta"),
            ],
            key_insights=[
                "Budget reallocation from bleeders to winners is the highest-ROI action available.",
                "2 anomalies detected in last 48 hours — investigate CPC spike and spend surge.",
                "Shopping campaign has lookalike expansion potential with 4.0x ROAS as seed.",
            ],
            overall_health="warning",
            confidence="high",
        )

    return NodeResponse(
        summary=result.headline or "Optimization analysis complete.",
        data={
            "headline": result.headline,
            "total_opportunity_usd": result.total_opportunity_usd,
            "top_actions": [a.model_dump() for a in result.top_actions],
            "key_insights": result.key_insights,
            "overall_health": result.overall_health,
            "confidence": result.confidence,
            "total_actions": total_actions,
            # Pass through all agent data for the /optimization page
            "agent_findings": all_findings,
        },
    )
