"""Step 5: Publish campaigns to Meta, Google, and Bing via accelerate-campaigns-service."""

import logging

from src.agentic_platform.core.engine import NodeResponse, WorkflowContext, StepArtifact
from src.agentic_platform.app.accelera.services.clients import campaigns_client

logger = logging.getLogger(__name__)


async def publish(ctx: WorkflowContext) -> NodeResponse:
    """Submit the finalized media plan to accelerate-campaigns-service for platform publishing."""
    build_data = ctx.results.get("build", NodeResponse(summary="", data={})).data
    analyze_data = ctx.results.get("analyze", NodeResponse(summary="", data={})).data
    configure_result = ctx.results.get("configure", NodeResponse(summary="", data={}, metadata={}))
    user_input = configure_result.metadata.get("user_input", {})

    if build_data.get("cancelled"):
        return NodeResponse(summary="Campaign creation was cancelled.", data={"status": "cancelled"})

    strategy_out = analyze_data.get("strategy", {})
    brand_out = analyze_data.get("brand", {})
    text_assets = build_data.get("text_assets", {})
    images = build_data.get("images", [])

    # Compose media plan from approved user settings + AI strategy
    approved_budget = user_input.get("budget", ctx.args.get("budget", 1000))
    approved_platforms = user_input.get("platforms", ctx.args.get("platform_selections", []))
    approved_goal = user_input.get("goal", ctx.args.get("goal", "SALES"))
    approved_start = user_input.get("start_date", ctx.args.get("start_date", ""))
    approved_duration = user_input.get("duration_days", 30)

    # Filter strategy platforms to only approved ones
    strategy_platforms = [
        p for p in strategy_out.get("platforms", [])
        if p.get("platform", "") in approved_platforms
    ] or [{"platform": p, "budget": approved_budget / max(len(approved_platforms), 1), "budget_percent": 100 // max(len(approved_platforms), 1), "ad_types": []} for p in approved_platforms]

    media_plan = {
        "campaign_name": strategy_out.get("campaign_name") or brand_out.get("brand_name", "Campaign"),
        "objective": approved_goal,
        "total_budget": approved_budget,
        "daily_budget": approved_budget / approved_duration if approved_duration else approved_budget / 30,
        "duration": approved_duration,
        "start_date": approved_start,
        "platforms": strategy_platforms,
        "text_assets": text_assets,
        "images": images,
        "executive_summary": strategy_out.get("executive_summary", ""),
        "kpi_forecast": strategy_out.get("kpi_forecast", {}),
    }

    # Connected accounts from hydrated context
    connected = ctx.connected_platforms or []
    connected_accounts = {}
    for p in connected:
        platform_name = (p.platform.lower() if hasattr(p, "platform") else p.get("platform", "")).lower()
        if platform_name in approved_platforms:
            connected_accounts[platform_name] = {
                "account_id": getattr(p, "account_id", None) or p.get("account_id", ""),
                "customer_id": getattr(p, "customer_id", None) or p.get("customer_id", ""),
                "access_token": getattr(p, "access_token", None) or p.get("access_token", ""),
            }

    try:
        resp = await campaigns_client.post("/campaigns/publish", json={
            "org_id": ctx.org_id,
            "user_id": ctx.user_id,
            "media_plan": media_plan,
            "connected_accounts": connected_accounts,
        })
        body = resp.get("body", {})
        campaign_id = body.get("campaign_id") or body.get("id", "")
        platform_results = body.get("platform_results", [])
        success_count = sum(1 for r in platform_results if r.get("success"))

        ctx.emit_artifact(StepArtifact(
            type="campaign_result",
            title=f"Campaign Created: {media_plan['campaign_name']}",
            data={
                "campaign_id": campaign_id,
                "platforms": [r.get("platform") for r in platform_results if r.get("success")],
                "status": "paused",
                "media_plan": media_plan,
            },
        ))

        return NodeResponse(
            summary=f"Campaign published to {success_count}/{len(platform_results)} platforms at PAUSED status. Activate from your ad accounts when ready.",
            data={
                "campaign_id": campaign_id,
                "platform_results": platform_results,
                "status": "paused",
                "media_plan": media_plan,
            },
        )

    except Exception as e:
        logger.error("Campaign publish failed: %s", e)
        return NodeResponse(
            summary=f"Publishing failed: {e}. Your campaign settings have been saved as a draft.",
            data={"error": str(e), "media_plan": media_plan, "status": "draft"},
        )
