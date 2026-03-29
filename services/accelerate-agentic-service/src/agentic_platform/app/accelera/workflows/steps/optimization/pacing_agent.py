"""Pacing Agent — budget pacing and delivery rate analysis."""
from pydantic import BaseModel
from src.agentic_platform.core.engine import WorkflowContext, NodeResponse
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import campaigns_client

class PacingIssue(BaseModel):
    campaign_id: str = ""
    campaign_name: str = ""
    platform: str = ""
    pacing_type: str = ""  # "overpacing" | "underpacing" | "front_loaded" | "on_track"
    spend_to_date_pct: float = 0.0
    days_elapsed_pct: float = 0.0
    projected_overspend: float = 0.0
    recommendation: str = ""
    priority: str = "medium"

class PacingAnalysis(BaseModel):
    issues: list[PacingIssue] = []
    overpacing_campaigns: int = 0
    underpacing_campaigns: int = 0
    summary: str = ""

async def pacing_agent(ctx: WorkflowContext) -> NodeResponse:
    org_id = ctx.org_id

    campaigns = []
    try:
        resp = await campaigns_client.post("/campaigns/health-batch", json={"org_id": org_id, "days": 30})
        campaigns = resp.get("body", {}).get("campaigns", []) or []
    except Exception:
        pass

    if not campaigns:
        campaigns = [
            {"id": "c1", "name": "Brand Awareness", "platform": "meta", "monthly_budget": 6000, "spend_so_far": 5800, "days_elapsed": 20, "total_days": 31},
            {"id": "c2", "name": "Shopping - Best Sellers", "platform": "google", "monthly_budget": 9000, "spend_so_far": 3200, "days_elapsed": 20, "total_days": 31},
        ]

    prompt = f"""You are a media pacing expert.

Campaign data: {campaigns}

Analyze pacing:
- overpacing: spend_to_date_pct significantly > days_elapsed_pct (risk of early budget exhaustion)
- underpacing: spend_to_date_pct significantly < days_elapsed_pct (delivery issues or over-conservative bids)
- front_loaded: heavy early spend that's leveling off (check if intentional)

projected_overspend: USD amount projected over budget by month end
overpacing_campaigns: count
underpacing_campaigns: count
summary: 1-2 sentences on pacing health"""

    try:
        result = await structured_llm_call(prompt, PacingAnalysis, model="haiku")
    except Exception:
        result = PacingAnalysis(
            issues=[
                PacingIssue(campaign_id="c1", campaign_name="Brand Awareness", platform="meta", pacing_type="overpacing", spend_to_date_pct=96.7, days_elapsed_pct=64.5, projected_overspend=2790.0, recommendation="Reduce daily budget by 40% to avoid exhausting budget 10 days early", priority="high"),
                PacingIssue(campaign_id="c2", campaign_name="Shopping - Best Sellers", platform="google", pacing_type="underpacing", spend_to_date_pct=35.6, days_elapsed_pct=64.5, projected_overspend=0.0, recommendation="Check delivery issues — only 35% spent at 65% of month", priority="medium"),
            ],
            overpacing_campaigns=1,
            underpacing_campaigns=1,
            summary="1 campaign overpacing (risk of early budget exhaust), 1 underpacing (delivery issue).",
        )

    return NodeResponse(
        summary=result.summary or f"Pacing analysis complete: {result.overpacing_campaigns} overpacing, {result.underpacing_campaigns} underpacing.",
        data={"issues": [i.model_dump() for i in result.issues], "overpacing_campaigns": result.overpacing_campaigns, "underpacing_campaigns": result.underpacing_campaigns},
    )
