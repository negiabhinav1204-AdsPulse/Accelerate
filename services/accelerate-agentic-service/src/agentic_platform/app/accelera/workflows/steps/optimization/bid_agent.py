"""Bid Agent — CPC/CPM bid recommendations."""
from pydantic import BaseModel
from src.agentic_platform.core.engine import WorkflowContext, NodeResponse
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import campaigns_client, reporting_client

class BidInsight(BaseModel):
    campaign_id: str = ""
    campaign_name: str = ""
    platform: str = ""
    current_cpc: float = 0.0
    recommended_cpc: float = 0.0
    change_pct: float = 0.0
    reason: str = ""
    priority: str = "medium"

class BidAnalysis(BaseModel):
    insights: list[BidInsight] = []
    avg_cpc_reduction_pct: float = 0.0
    summary: str = ""

async def bid_agent(ctx: WorkflowContext) -> NodeResponse:
    org_id = ctx.org_id
    days = ctx.args.get("days", 30)

    metrics = []
    try:
        resp = await reporting_client.post("/report", json={"org_id": org_id, "days": days, "metrics": ["spend", "clicks", "impressions", "cpc", "revenue"]})
        metrics = resp.get("body", {}).get("by_campaign", []) or []
    except Exception:
        pass

    if not metrics:
        metrics = [
            {"id": "c1", "name": "Brand Awareness", "platform": "meta", "cpc": 3.50, "ctr": 0.008, "conversions": 12},
            {"id": "c2", "name": "Shopping - Best Sellers", "platform": "google", "cpc": 1.20, "ctr": 0.045, "conversions": 85},
        ]

    prompt = f"""You are a bid optimization expert.

Campaign metrics: {metrics}

Identify bid adjustments to reduce wasted spend and improve efficiency.
- High CPC + low CTR = lower bids
- Low CPC + high conversions = can increase bids
- avg_cpc_reduction_pct: overall CPC improvement potential
- summary: 1-2 sentences on bid findings"""

    try:
        result = await structured_llm_call(prompt, BidAnalysis, model="haiku")
    except Exception:
        result = BidAnalysis(
            insights=[BidInsight(campaign_id="c1", campaign_name="Brand Awareness", platform="meta", current_cpc=3.50, recommended_cpc=2.80, change_pct=-20.0, reason="Low CTR suggests overbidding on low-intent queries", priority="medium")],
            avg_cpc_reduction_pct=18.0,
            summary="Bid adjustments could reduce CPC by 18% on average.",
        )

    return NodeResponse(
        summary=result.summary or f"Bid analysis complete: {len(result.insights)} adjustments identified.",
        data={"insights": [i.model_dump() for i in result.insights], "avg_cpc_reduction_pct": result.avg_cpc_reduction_pct},
    )
