"""Step 4: Plan — slim schema + fast LLM for campaign strategy."""

import logging
import time

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.workflow import WorkflowContext
from src.agentic_platform.core.engine.workflow import StepArtifact
from src.agentic_platform.app.campaigns.models import (
    CampaignContext,
    CampaignConfigFormInput,
    CreateCampaignArgs,
    MarketingAnalysisReport,
    PlanStepData,
    SlimCampaign,
    SlimPlan,
    ConnectedPlatform,
)
from src.agentic_platform.app.campaigns.prompts import MediaPlanPrompts, enrich_slim_plan

logger = logging.getLogger(__name__)


def _recover_campaign_context(ctx: WorkflowContext) -> CampaignContext:
    """Recover CampaignContext — try configure step data first (HITL resume), then ctx fields."""
    configure_result = ctx.results.get("configure")
    cfg_data = configure_result.data if configure_result and configure_result.data else {}

    # Try structured CampaignContext from configure step (survives HITL checkpoint)
    recovered = CampaignContext.from_step_data(cfg_data)
    if recovered:
        return recovered

    # Fallback: build from ctx fields (first run, no HITL)
    supported = [
        ConnectedPlatform(**p) if isinstance(p, dict) else p
        for p in (ctx.connected_platforms or cfg_data.get("_connected_platforms", []))
    ]
    return CampaignContext(
        org_id=ctx.org_id if ctx.org_id != "default" else cfg_data.get("_org_id", ctx.org_id),
        user_id=ctx.user_id if ctx.user_id != "anonymous" else cfg_data.get("_user_id", ctx.user_id),
        supported_connections=supported,
        all_connections=supported,
    )


async def plan(ctx: WorkflowContext) -> NodeResponse:
    logger.info("[plan] START")
    analyze_result = ctx.results.get("analyze")
    if not analyze_result or not analyze_result.data:
        return NodeResponse(summary="No analysis data", data={})

    analysis = MarketingAnalysisReport(**analyze_result.data)

    # Read user's campaign configuration from HITL form (validated)
    configure_result = ctx.results.get("configure")
    raw_input = configure_result.metadata.get("user_input", {}) if configure_result else {}
    user_input = CampaignConfigFormInput.model_validate(raw_input)

    ctx.progress.start("connections")
    campaign_ctx = _recover_campaign_context(ctx)
    connected = list(campaign_ctx.supported_connections)
    logger.info("[plan] recovered %d connected platforms: %s",
                len(connected), [c.platform for c in connected])

    # Filter to user-selected platforms from HITL form
    if user_input.platforms:
        connected = [c for c in connected if c.platform in user_input.platforms]
        if not connected:
            logger.warning("[plan] user selected platforms %s but none matched connected %s — using all connected",
                           user_input.platforms, [c.platform for c in campaign_ctx.supported_connections])
            connected = list(campaign_ctx.supported_connections)
    ctx.progress.done("connections", summary=f"{len(connected)} platforms")

    ctx.progress.start("strategy")
    # Per-platform currency lookup — each ad account operates in its own billing currency
    platform_currency_map: dict[str, str] = {
        c.platform: c.currency for c in connected if c.currency
    }
    # Fallback for LLM prompt (budget reasoning) — first platform's currency or analysis guess
    default_currency = next(iter(platform_currency_map.values()), None) or analysis.business_context.currency or "USD"

    # ── Build campaign list DETERMINISTICALLY from user's HITL selections ──
    # The LLM only decides budget/targeting/messaging within these exact combos.
    from src.agentic_platform.app.campaigns.models import PlatformType as PT, CampaignType as CT

    fixed_combos: list[tuple[str, str]] = []
    if user_input.platform_selections:
        # Exact per-platform selections from HITL form: { "GOOGLE": ["SEARCH", "DISPLAY"] }
        for plat, types in user_input.platform_selections.items():
            for ct in types:
                fixed_combos.append((plat, ct))
    elif user_input.platforms and user_input.campaign_types:
        # Fallback: old-style flat lists — cross-product
        for plat in user_input.platforms:
            for ct in user_input.campaign_types:
                fixed_combos.append((plat, ct))
    else:
        # No user input — use all connected platforms × their supported types
        from src.agentic_platform.app.campaigns.platform_matrix import PlatformCapabilityMatrix
        for c in connected:
            for ct in PlatformCapabilityMatrix.get_supported_campaign_types(PT(c.platform)):
                fixed_combos.append((c.platform, ct.value))

    logger.info("[plan] fixed combos from HITL: %s", fixed_combos)

    # Tell the LLM exactly which campaigns to plan (no invention)
    args = CreateCampaignArgs.from_ctx_args(ctx.args)
    creative = args.creative
    prompt = MediaPlanPrompts.build(
        analysis, default_currency, connected_platforms=connected,
        total_budget=user_input.total_budget, start_date=user_input.start_date,
        end_date=user_input.end_date, campaign_types=user_input.campaign_types,
        goal=user_input.goal,
        fixed_campaigns=fixed_combos,
        ad_tone_override=creative.ad_tone if creative else "",
        messaging_pillars=creative.messaging_pillars if creative else None,
        avoid_themes=creative.avoid_themes if creative else None,
    )
    logger.info("[plan] prompt: %d chars", len(prompt))

    t0 = time.perf_counter()
    slim_plan = await structured_llm_call(prompt, SlimPlan, model=settings.workflow_plan_model)
    logger.info("[plan] LLM returned %d campaigns (%.1fs)", len(slim_plan.campaigns), time.perf_counter() - t0)

    # ── Enforce: strip any LLM-hallucinated campaigns not in fixed_combos ──
    if fixed_combos:
        allowed = {(p.upper(), ct.upper()) for p, ct in fixed_combos}
        before = len(slim_plan.campaigns)
        slim_plan.campaigns = [
            c for c in slim_plan.campaigns
            if (c.platform.value.upper(), c.campaign_type.value.upper()) in allowed
        ]
        if len(slim_plan.campaigns) < before:
            logger.warning("[plan] stripped %d hallucinated campaigns", before - len(slim_plan.campaigns))

        # If LLM missed any combos, add skeleton campaigns
        existing = {(c.platform.value.upper(), c.campaign_type.value.upper()) for c in slim_plan.campaigns}
        for plat, ct in fixed_combos:
            if (plat.upper(), ct.upper()) not in existing:
                logger.info("[plan] adding missing campaign: %s/%s", plat, ct)
                slim_plan.campaigns.append(SlimCampaign(
                    name=f"{analysis.brand.name} {ct.replace('_', ' ').title()}",
                    platform=PT(plat),
                    campaign_type=CT(ct),
                    daily_budget=round(user_input.total_budget / max(len(fixed_combos), 1) / 30, 2) if user_input.total_budget else 100,
                    target_audience="General audience",
                    key_message=analysis.brand.value_proposition or "",
                ))

    # Enrich: derive template_type, resolve audience/products → ad_context
    campaign_plan = enrich_slim_plan(
        slim_plan, analysis,
        start_date=user_input.start_date, end_date=user_input.end_date,
    )

    # Override budget_currency per-campaign from the actual ad account currency
    for c in campaign_plan.campaigns:
        c.budget_currency = platform_currency_map.get(c.platform.value, default_currency)
    logger.info("[plan] enriched %d campaigns", len(campaign_plan.campaigns))

    ctx.progress.done("strategy", summary=f"{len(campaign_plan.campaigns)} campaigns")

    platforms_str = ", ".join(sorted({c.platform for c in campaign_plan.campaigns}))

    # Per-currency totals for display (handles mixed currencies like AUD + EUR)
    currency_totals: dict[str, float] = {}
    for c in campaign_plan.campaigns:
        currency_totals[c.budget_currency] = currency_totals.get(c.budget_currency, 0) + c.daily_budget
    total_daily = sum(c.daily_budget for c in campaign_plan.campaigns)

    # Emit budget first (hero number), then campaign rows
    ctx.emit_artifact(StepArtifact(
        type="budget_allocation",
        title="Budget",
        data={
            "currency_totals": currency_totals,
            "campaigns": [
                {"name": c.name, "platform": c.platform, "daily_budget": c.daily_budget,
                 "currency": c.budget_currency,
                 "percentage": round(c.daily_budget / total_daily * 100, 1) if total_daily else 0}
                for c in campaign_plan.campaigns
            ],
        },
    ))
    ctx.emit_artifact(StepArtifact(
        type="campaign_strategy",
        title=f"Campaigns ({len(campaign_plan.campaigns)})",
        data={
            "campaigns": [
                {
                    "name": c.name, "platform": c.platform, "campaign_type": c.campaign_type,
                    "daily_budget": c.daily_budget, "currency": c.budget_currency,
                    "key_message": c.key_message,
                    "target_audience": c.target_audience, "ad_tone": c.ad_tone,
                }
                for c in campaign_plan.campaigns
            ],
        },
    ))

    # Update context with filtered connections (user's HITL selections) and pass through
    campaign_ctx.supported_connections = connected

    step_data = PlanStepData(
        campaign_plan=campaign_plan,
        campaign_context=campaign_ctx,
        org_id=campaign_ctx.org_id,
        user_id=campaign_ctx.user_id,
    )

    # Summary: "AUD 200 + EUR 150/day" for mixed, "USD 350/day" for single
    budget_summary = " + ".join(f"{cur} {amt:.0f}" for cur, amt in currency_totals.items())

    return NodeResponse(
        summary=f"Plan: {len(campaign_plan.campaigns)} campaigns, {budget_summary}/day on {platforms_str}",
        data=step_data.to_node_data(),
    )
