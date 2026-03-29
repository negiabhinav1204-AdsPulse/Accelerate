"""Accelera AI agent configuration.

Single source of truth for the Accelera AI agent: system prompt, all 34 tools,
the campaign creation workflow, model, and context hydration.

Replaces accelerate-agent-service (campaign creation) and
accelerate-chat-service (AI chat) in the Accelerate microservices platform.
"""

from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.config import settings

# Context
from src.agentic_platform.app.accelera.context import (
    hydrate_accelera_context,
    accelera_dynamic_context,
)

# System prompt
from src.agentic_platform.app.accelera.prompts.system import SYSTEM_PROMPT

# Tools — ecommerce (6)
from src.agentic_platform.app.accelera.tools.ecommerce import (
    get_products,
    get_product_suggestions,
    get_sales,
    get_ecommerce_overview,
    get_inventory_health,
    get_product_insights,
)

# Tools — analytics (12)
from src.agentic_platform.app.accelera.tools.analytics import (
    get_analytics_overview,
    get_platform_comparison,
    get_funnel_analysis,
    get_daily_trends,
    analyze_wasted_spend,
    get_revenue_breakdown,
    get_executive_summary,
    get_sales_regions,
    # New Phase 7 tools:
    get_revenue_attribution,
    get_geographic_analytics,
    get_llm_traffic_report,
    get_analytics_insights,
)

# Tools — campaigns (7)
from src.agentic_platform.app.accelera.tools.campaigns import (
    campaign_health_check,
    campaign_optimizer,
    toggle_campaign,
    update_budget,
    get_campaign_history,
    get_campaign_metrics,
    get_campaign_performance_history,
)

# Tools — audiences (6)
from src.agentic_platform.app.accelera.tools.audiences import (
    list_audiences,
    create_custom_audience,
    create_lookalike_audience,
    get_audience_insights,
    smart_targeting,
    search_locations,
)

# Tools — platform (8)
from src.agentic_platform.app.accelera.tools.platform import (
    get_connected_platforms,
    get_ad_platform_status,
    get_feed_health,
    generate_product_feed,
    get_merchant_center_status,
    suggest_campaign_strategy,
    get_campaign_strategies,
    growth_opportunities,
)

# Tools — brand (1)
from src.agentic_platform.app.accelera.tools.brand import generate_company_brief_tool

# Tools — campaign creation (6)
from src.agentic_platform.app.accelera.tools.creation import (
    prepare_campaign_summary,
    create_ad_campaign,
    create_google_ad_campaign,
    create_bing_ad_campaign,
    auto_onboard,
    auto_create_campaigns_from_feed,
)

# Tools — creative generation (1)
from src.agentic_platform.app.accelera.tools.creative import generate_ad_creative

# Tools — intelligence (4)
from src.agentic_platform.app.accelera.tools.intelligence import (
    suggest_optimizations,
    get_adk_agent_status,
    cmo_ask,
    generate_media_plan,
)

# Tools — experiments (3)
from src.agentic_platform.app.accelera.tools.experiments import (
    get_experiment_results,
    setup_full_experiment,
    create_experiment,
)

# Common tools — image generation (1)
from src.agentic_platform.app.common.tools.image_gen import generate_image

# Tools — navigation (1)
from src.agentic_platform.app.accelera.tools.navigation import navigate_to

# Workflows
from src.agentic_platform.app.accelera.workflows.create_campaign import create_campaign_workflow
from src.agentic_platform.app.accelera.workflows.optimization import optimization_workflow

config = AgentConfig(
    agent_id="accelera-ai",
    name="Accelera AI",
    system_prompt=SYSTEM_PROMPT,
    dynamic_context=accelera_dynamic_context,
    hydrate_context=hydrate_accelera_context,
    model=settings.accelera_agent_model,   # sonnet — upgraded from haiku
    langfuse_trace_name="accelera-ai-chat",
    tools=[
        # ── Ecommerce (6) ──────────────────────────────────────
        get_products,
        get_product_suggestions,
        get_sales,
        get_ecommerce_overview,
        get_inventory_health,
        get_product_insights,
        # ── Analytics (12) ─────────────────────────────────────
        get_analytics_overview,
        get_platform_comparison,
        get_funnel_analysis,
        get_daily_trends,
        analyze_wasted_spend,
        get_revenue_breakdown,
        get_executive_summary,
        get_sales_regions,
        # Phase 7 — Analytics Intelligence:
        get_revenue_attribution,
        get_geographic_analytics,
        get_llm_traffic_report,
        get_analytics_insights,
        # ── Campaign management (7) ────────────────────────────
        campaign_health_check,
        campaign_optimizer,
        toggle_campaign,
        update_budget,
        get_campaign_history,
        get_campaign_metrics,
        get_campaign_performance_history,
        # ── Audiences (6) ──────────────────────────────────────
        list_audiences,
        create_custom_audience,
        create_lookalike_audience,
        get_audience_insights,
        smart_targeting,
        search_locations,
        # ── Platform & feeds (8) ───────────────────────────────
        get_connected_platforms,
        get_ad_platform_status,
        get_feed_health,
        generate_product_feed,
        get_merchant_center_status,
        suggest_campaign_strategy,
        get_campaign_strategies,
        growth_opportunities,
        # ── Brand (1) ──────────────────────────────────────────
        generate_company_brief_tool,
        # ── Campaign creation (6) ──────────────────────────────
        prepare_campaign_summary,
        create_ad_campaign,
        create_google_ad_campaign,
        create_bing_ad_campaign,
        auto_onboard,
        auto_create_campaigns_from_feed,
        # ── Creative generation (1) ────────────────────────────
        generate_ad_creative,
        # ── Intelligence (4) ───────────────────────────────────
        suggest_optimizations,
        get_adk_agent_status,
        cmo_ask,
        generate_media_plan,
        # ── Experiments (3) ────────────────────────────────────
        get_experiment_results,
        setup_full_experiment,
        create_experiment,
        # ── Image generation (1) ───────────────────────────────
        generate_image,
        # ── Navigation (1) ─────────────────────────────────────
        navigate_to,
    ],
    workflows=[create_campaign_workflow, optimization_workflow],
    checkpointer_db_url=settings.checkpointer_db_url,
    db_service_url=settings.db_service_url,
)
