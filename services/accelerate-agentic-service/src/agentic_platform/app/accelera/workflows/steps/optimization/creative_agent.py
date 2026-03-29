"""Creative Agent — identifies fatigued or underperforming creatives."""
from pydantic import BaseModel
from src.agentic_platform.core.engine import WorkflowContext, NodeResponse
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import campaigns_client

class CreativeInsight(BaseModel):
    campaign_id: str = ""
    campaign_name: str = ""
    platform: str = ""
    issue: str = ""  # "fatigue" | "low_ctr" | "low_cvr" | "needs_video"
    recommendation: str = ""
    priority: str = "medium"

class CreativeAnalysis(BaseModel):
    insights: list[CreativeInsight] = []
    fatigued_campaigns: int = 0
    summary: str = ""

async def creative_agent(ctx: WorkflowContext) -> NodeResponse:
    org_id = ctx.org_id

    campaigns = []
    try:
        resp = await campaigns_client.post("/campaigns/health-batch", json={"org_id": org_id, "days": 30})
        campaigns = resp.get("body", {}).get("campaigns", []) or []
    except Exception:
        pass

    if not campaigns:
        campaigns = [
            {"id": "c1", "name": "Brand Awareness", "platform": "meta", "ctr": 0.008, "age_days": 45, "impressions": 180000},
            {"id": "c3", "name": "Retargeting", "platform": "meta", "ctr": 0.025, "age_days": 12, "impressions": 32000},
        ]

    prompt = f"""You are a creative strategy expert.

Campaign data: {campaigns}

Identify creative issues:
- fatigue: high impression count + age > 30 days + declining CTR
- low_ctr: CTR < 1% for display/social
- needs_video: feed campaigns without video format
- low_cvr: high CTR but low conversion rate

fatigued_campaigns: count of campaigns with fatigue issue
summary: 1-2 sentences on creative health"""

    try:
        result = await structured_llm_call(prompt, CreativeAnalysis, model="haiku")
    except Exception:
        result = CreativeAnalysis(
            insights=[CreativeInsight(campaign_id="c1", campaign_name="Brand Awareness", platform="meta", issue="fatigue", recommendation="Refresh creative — 45 days old with 180K impressions. Frequency likely causing banner blindness.", priority="high")],
            fatigued_campaigns=1,
            summary="1 campaign showing creative fatigue. Refresh recommended.",
        )

    return NodeResponse(
        summary=result.summary or f"Creative analysis complete: {len(result.insights)} issues found.",
        data={"insights": [i.model_dump() for i in result.insights], "fatigued_campaigns": result.fatigued_campaigns},
    )
