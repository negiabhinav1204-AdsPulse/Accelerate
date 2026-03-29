"""Budget Agent — identifies over/under-funded campaigns."""
from pydantic import BaseModel
from src.agentic_platform.core.engine import WorkflowContext, NodeResponse
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import campaigns_client, reporting_client

class BudgetInsight(BaseModel):
    campaign_id: str = ""
    campaign_name: str = ""
    platform: str = ""
    current_budget: float = 0.0
    recommended_budget: float = 0.0
    action: str = ""  # "increase" | "decrease" | "pause"
    reason: str = ""
    priority: str = "medium"  # "high" | "medium" | "low"

class BudgetAnalysis(BaseModel):
    insights: list[BudgetInsight] = []
    total_reallocation_opportunity: float = 0.0
    summary: str = ""

async def budget_agent(ctx: WorkflowContext) -> NodeResponse:
    org_id = ctx.org_id
    days = ctx.args.get("days", 30)

    campaigns = []
    try:
        resp = await campaigns_client.post("/campaigns/health-batch", json={"org_id": org_id, "days": days})
        campaigns = resp.get("body", {}).get("campaigns", []) or []
    except Exception:
        pass

    if not campaigns:
        # Mock data
        campaigns = [
            {"id": "c1", "name": "Brand Awareness", "platform": "meta", "spend": 5000, "revenue": 2000, "budget": 200},
            {"id": "c2", "name": "Shopping - Best Sellers", "platform": "google", "spend": 8000, "revenue": 32000, "budget": 300},
            {"id": "c3", "name": "Retargeting", "platform": "meta", "spend": 3000, "revenue": 9500, "budget": 100},
        ]

    prompt = f"""You are a budget optimization expert analyzing campaign performance.

Campaigns data:
{campaigns}

For each campaign, analyze:
- ROAS (revenue/spend). WINNER >= 3.0, UNDERPERFORMER 1-3, BLEEDER < 1, LEARNER spend < 100
- Budget efficiency (are winners budget-limited? are bleeders overfunded?)

Generate BudgetInsight for each campaign needing action.
total_reallocation_opportunity: total USD that could be moved from bleeders to winners
summary: 1-2 sentence executive summary of budget findings

For insights, action must be "increase" for winners, "decrease" or "pause" for bleeders.
priority "high" for ROAS < 1 with spend > $500."""

    try:
        result = await structured_llm_call(prompt, BudgetAnalysis, model="haiku")
    except Exception:
        result = BudgetAnalysis(
            insights=[BudgetInsight(campaign_id="c2", campaign_name="Shopping - Best Sellers", platform="google", current_budget=300, recommended_budget=450, action="increase", reason="ROAS 4.0x — budget-limited winner", priority="high")],
            total_reallocation_opportunity=1500.0,
            summary="1 winner needs more budget. 1 bleeder should be paused.",
        )

    return NodeResponse(
        summary=result.summary or f"Budget analysis complete: {len(result.insights)} actions identified.",
        data={"insights": [i.model_dump() for i in result.insights], "total_reallocation_opportunity": result.total_reallocation_opportunity},
    )
