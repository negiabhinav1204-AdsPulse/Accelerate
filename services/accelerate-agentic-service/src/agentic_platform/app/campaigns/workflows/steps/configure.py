"""Step 3: Configure — HITL form pre-filled with AI-recommended settings."""

import logging
from datetime import date, timedelta
from typing import Any

from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.hitl import (
    HITLRequest, HITLType, HITLActionButton, HITLAction,
)
from src.agentic_platform.core.engine.workflow import WorkflowContext
from src.agentic_platform.app.campaigns.models import (
    CampaignContext,
    CreateCampaignArgs,
    CampaignConfigDefaults,
    CampaignConfigPayload,
    ConfigureStepData,
    MarketingAnalysisReport,
    ConnectedPlatform,
    PlatformType,
    PlatformCampaignTypeOption,
    PlatformCampaignTypes,
)
from src.agentic_platform.app.campaigns.platform_matrix import PlatformCapabilityMatrix

logger = logging.getLogger(__name__)

_ALL_TYPES = ["SEARCH", "DISPLAY", "PERFORMANCE_MAX"]


def _recommend_types(analysis: MarketingAnalysisReport) -> list[str]:
    """Recommend campaign types based on analysis. E-commerce gets all 3, services skip Display."""
    page = analysis.page_type
    if page == "product" or analysis.shopify_product:
        return list(_ALL_TYPES)  # e-commerce: all types
    if analysis.products:
        return ["SEARCH", "PERFORMANCE_MAX"]  # has products but not product page
    return ["SEARCH"]  # default: at least search


def _build_campaign_context(ctx: WorkflowContext) -> CampaignContext:
    """Build CampaignContext from WorkflowContext — reads metadata or falls back to fields."""
    # Try structured CampaignContext from metadata (first run, no HITL)
    from src.agentic_platform.app.campaigns.platform_matrix import (
        extract_all_connections, filter_connected_platforms,
    )
    from src.agentic_platform.app.campaigns.models import ConnectionsResponse

    # connected_platforms on ctx is already the supported list (from hydration)
    supported = [
        ConnectedPlatform(**p) if isinstance(p, dict) else p
        for p in ctx.connected_platforms
    ]
    return CampaignContext(
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        all_connections=supported,  # best we have at this level
        supported_connections=supported,
    )


async def configure(ctx: WorkflowContext) -> NodeResponse:
    """Show HITL form pre-filled with AI-recommended settings from analysis."""
    analyze_result = ctx.results.get("analyze")
    scrape_result = ctx.results.get("scrape")

    website_title = ""
    if scrape_result and scrape_result.data:
        meta = scrape_result.data.get("metadata", {})
        website_title = meta.get("title", "")

    args = CreateCampaignArgs.from_ctx_args(ctx.args)

    today = date.today()
    start_default = args.start_date or today.isoformat()
    end_default = args.end_date or (date.fromisoformat(start_default) + timedelta(days=30)).isoformat()

    # Build CampaignContext from workflow context
    campaign_ctx = _build_campaign_context(ctx)

    # ── Pre-flight check ──
    if not campaign_ctx.has_supported_connections:
        raise ValueError(
            "No supported ad platforms connected. "
            "Please connect your Google Ads or Microsoft Ads account in Settings before creating campaigns."
        )

    connected = campaign_ctx.supported_connections
    platform_currency = next((c.currency for c in connected if c.currency), None)

    # Smart defaults from analysis
    analysis = MarketingAnalysisReport(**analyze_result.data) if analyze_result and analyze_result.data else None
    brand_name = analysis.brand.name if analysis else website_title
    currency = platform_currency or (analysis.business_context.currency if analysis else "USD")
    recommended_types = _recommend_types(analysis) if analysis else list(_ALL_TYPES)

    # Build platform options from connected platforms
    _PLATFORM_LABELS = {"GOOGLE": "Google Ads", "BING": "Microsoft Ads (Bing)", "META": "Meta Ads"}
    _TYPE_LABELS = {"SEARCH": "Search", "DISPLAY": "Display", "PERFORMANCE_MAX": "Performance Max"}

    connected_names = campaign_ctx.supported_platform_names

    # Only show connected + supported platforms as options
    platform_campaign_types: dict[str, PlatformCampaignTypes] = {}
    for platform_name in connected_names:
        supported_types = PlatformCapabilityMatrix.get_supported_campaign_types(
            PlatformType(platform_name)
        )
        platform_campaign_types[platform_name] = PlatformCampaignTypes(
            label=_PLATFORM_LABELS.get(platform_name, platform_name),
            types=[
                PlatformCampaignTypeOption(value=ct.value, label=_TYPE_LABELS.get(ct.value, ct.value))
                for ct in sorted(supported_types, key=lambda x: x.value)
            ],
        )

    # Pre-select from LLM-extracted platform_selections
    user_selections = {
        k.value if hasattr(k, 'value') else k: [t.value if hasattr(t, 'value') else t for t in v]
        for k, v in args.platform_selections.items()
    } if args.platform_selections else {}

    pre_selected: Dict[str, List[str]] = {}
    if user_selections:
        for p in connected_names:
            if p in user_selections:
                types = user_selections[p]
                # Empty list = all supported types for this platform
                pre_selected[p] = types if types else [
                    ct.value for ct in PlatformCapabilityMatrix.get_supported_campaign_types(PlatformType(p))
                ]
            else:
                # Platform not mentioned by user → deselect
                pre_selected[p] = []
    else:
        # No user preference — AI-recommended types on all platforms
        active_types = recommended_types
        for p in connected_names:
            pre_selected[p] = list(active_types)

    payload = CampaignConfigPayload(
        url=args.url,
        website=brand_name or "",
        currency=currency,
        platform_campaign_types=platform_campaign_types,
        defaults=CampaignConfigDefaults(
            start_date=start_default,
            end_date=end_default,
            total_budget=args.total_budget or None,
            selected_types=pre_selected,
            goal=args.goal or None,
        ),
    )

    form = HITLRequest(
        type=HITLType.FORM,
        title="Confirm your campaign setup",
        description=f"Based on your input and analysis of {brand_name}" if brand_name else "Review and adjust your campaign settings",
        payload=payload.model_dump(),
        fields=[],
        actions=[
            HITLActionButton(action=HITLAction.SUBMIT, label="Create Campaigns", style="primary"),
            HITLActionButton(action=HITLAction.CANCEL, label="Cancel", style="default"),
        ],
    )

    step_data = ConfigureStepData(
        url=args.url,
        website_title=website_title,
        campaign_context=campaign_ctx,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
    )

    return NodeResponse(
        summary=f"Campaign settings for {brand_name or args.url}",
        data=step_data.to_node_data(),
        hitl=form,
    )
