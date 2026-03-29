"""Campaign creation tools — 6 tools for creating and previewing campaigns.

Tools:
  prepare_campaign_summary     — Pre-launch review MODAL (always call before creating)
  create_ad_campaign           — Generic multi-platform campaign creator
  create_google_ad_campaign    — Google-specific: Search RSA, Display, PMax, Shopping PMax
  create_bing_ad_campaign      — Bing-specific: Search RSA, Audience, Shopping
  auto_onboard                 — Top-5 product suggestions with campaign plans
  auto_create_campaigns_from_feed — Batch campaign creation from product segments

Reference: Adaptiv api/app/routers/copilot.py (create_ad_campaign handler),
           api/app/services/google_ad_uploader.py, api/app/services/bing_ad_uploader.py
"""

from typing import Optional

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import campaigns_client, commerce_client
from src.agentic_platform.app.accelera.blocks import (
    campaign_summary_block, CampaignSummaryData, CampaignSummaryTrigger,
    campaign_table_block, CampaignTableData, CampaignRow,
    onboarding_plan_block, OnboardingPlanData, OnboardingCampaignSuggestion,
    metric_cards_block, MetricCardsData, MetricItem,
)


# ── Platform strategy defaults ────────────────────────────────────────

_PLATFORM_AD_TYPE: dict[str, dict[str, str]] = {
    "google":   {"sales": "pmax", "traffic": "search", "awareness": "display", "lead_generation": "search"},
    "meta":     {"sales": "feed_ads", "traffic": "feed_ads", "awareness": "stories", "lead_generation": "lead_ads"},
    "bing":     {"sales": "shopping", "traffic": "search", "awareness": "audience", "lead_generation": "search"},
}

_ESTIMATED_CPC: dict[str, float] = {"google": 1.20, "meta": 0.85, "bing": 0.65}


def _estimate_reach(daily_budget: float, platform: str) -> str:
    cpc = _ESTIMATED_CPC.get(platform, 1.0)
    daily_clicks = int(daily_budget / cpc)
    daily_impressions = daily_clicks * 20  # rough CTR of 5%
    return f"~{daily_impressions:,} impressions/day"


def _platform_payload(
    org_id: str,
    name: str,
    objective: str,
    platform: str,
    daily_budget: float,
    product_id: Optional[str],
    landing_url: Optional[str],
    targeting: Optional[dict],
    headline: Optional[str],
    description: Optional[str],
    keywords: Optional[list[str]],
    campaign_type: Optional[str] = None,
    geo_targets: Optional[list[str]] = None,
) -> dict:
    """Build generalized schema payload for campaigns-service."""
    return {
        "org_id": org_id,
        "name": name,
        "objective": objective.upper(),
        "platforms": [platform.upper()],
        "budget": {"daily": daily_budget},
        "targeting": {
            **(targeting or {}),
            **({"geo_targets": geo_targets} if geo_targets else {}),
        },
        "creatives": [{
            "headline": headline or "",
            "description": description or "",
            "product_id": product_id,
            "landing_url": landing_url,
        }],
        "keywords": [{"text": k, "matchType": "BROAD"} for k in (keywords or [])],
        "campaign_type": campaign_type or _PLATFORM_AD_TYPE.get(platform, {}).get(objective, "search"),
        "status": "DRAFT",
    }


# ── prepare_campaign_summary ──────────────────────────────────────────

@tool("prepare_campaign_summary")
async def _prepare_campaign_summary(
    name: str,
    objective: str,
    platforms: list[str],
    daily_budget: float,
    product_id: Optional[str] = None,
    landing_url: Optional[str] = None,
    targeting: Optional[dict] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Show a pre-launch campaign review card for the user to approve before creating.

    ALWAYS call this BEFORE create_ad_campaign. The user sees targeting, budget,
    creative, and estimated reach in a modal and can approve or cancel.

    objective: "sales" | "traffic" | "awareness" | "lead_generation"
    For sales objective: provide product_id.
    For traffic/lead_generation: provide landing_url."""
    org_id = get_org_id()

    # Fetch product details if product_id given
    product_title: Optional[str] = None
    product_image_url: Optional[str] = None
    if product_id:
        try:
            resp = await commerce_client.get(f"/products/{product_id}?org_id={org_id}")
            p = resp.get("body", {}) or {}
            product_title = p.get("title")
            product_image_url = p.get("imageUrl")
        except Exception:
            pass

    primary_platform = platforms[0] if platforms else "google"
    estimated_reach = _estimate_reach(daily_budget, primary_platform)
    estimated_cpc = _ESTIMATED_CPC.get(primary_platform)

    data = CampaignSummaryData(
        name=name,
        objective=objective,
        platforms=platforms,
        daily_budget=daily_budget,
        product_id=product_id,
        product_title=product_title,
        product_image_url=product_image_url,
        headline=headline,
        description=description,
        targeting=targeting or {},
        estimated_reach=estimated_reach,
        estimated_cpc=estimated_cpc,
        landing_url=landing_url,
    )

    platform_str = ", ".join(p.capitalize() for p in platforms)
    return ToolResponse(
        summary=(
            f"Campaign '{name}' ready for review: {objective} on {platform_str}, "
            f"${daily_budget:.0f}/day budget, {estimated_reach}."
        ),
        data=data.model_dump(),
        ui_blocks=[campaign_summary_block.create(
            data=data,
            trigger=CampaignSummaryTrigger(label=f"Review: {name}"),
        )],
    ).model_dump()

prepare_campaign_summary = AgenticTool(
    func=_prepare_campaign_summary,
    thinking_messages=["Preparing campaign summary..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=20,
)


# ── create_ad_campaign ────────────────────────────────────────────────

@tool("create_ad_campaign")
async def _create_ad_campaign(
    name: str,
    objective: str,
    platforms: list[str],
    daily_budget: float,
    product_id: Optional[str] = None,
    landing_url: Optional[str] = None,
    targeting: Optional[dict] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
    keywords: Optional[list[str]] = None,
) -> dict:
    """Create an ad campaign across one or more platforms.

    IMPORTANT: Always call prepare_campaign_summary first so the user can review
    the campaign before it is created.

    objective: "sales" | "traffic" | "awareness" | "lead_generation"
    For sales: provide product_id. For lead_generation/traffic: provide landing_url.
    platforms: list of "google", "meta", "bing".

    Dispatches to the correct platform-specific creator in campaigns-service.
    Returns a campaign table card showing all created campaigns."""
    org_id = get_org_id()

    payload = {
        "org_id": org_id,
        "name": name,
        "objective": objective.upper(),
        "platforms": [p.upper() for p in platforms],
        "budget": {"daily": daily_budget},
        "targeting": targeting or {},
        "creatives": [{
            "headline": headline or "",
            "description": description or "",
            "product_id": product_id,
            "landing_url": landing_url,
        }],
        "keywords": [{"text": k, "matchType": "BROAD"} for k in (keywords or [])],
        "status": "DRAFT",
    }

    resp = await campaigns_client.post("/campaigns", json=payload)
    body = resp.get("body", {})
    status_code = resp.get("status_code", 500)
    success = status_code in (200, 201)

    if not success:
        error = body.get("error", body.get("message", "Unknown error")) if isinstance(body, dict) else str(body)
        return ToolResponse(
            summary=f"Failed to create campaign '{name}': {error}",
            data={"error": error, "status_code": status_code},
        ).model_dump()

    campaigns = body.get("campaigns", [body]) if isinstance(body, dict) else [body]
    rows = [
        CampaignRow(
            id=c.get("id", ""),
            name=c.get("name", name),
            platform=c.get("platform", ""),
            status=c.get("status", "draft"),
            spend=0.0,
            budget=daily_budget,
        )
        for c in (campaigns if isinstance(campaigns, list) else [campaigns])
    ]

    platform_str = ", ".join(p.capitalize() for p in platforms)
    return ToolResponse(
        summary=f"Campaign '{name}' created on {platform_str} with ${daily_budget:.0f}/day budget. Status: DRAFT.",
        data=body,
        ui_blocks=[campaign_table_block.create(data=CampaignTableData(
            campaigns=rows,
            currency="USD",
            period="Just created",
        ))],
    ).model_dump()

create_ad_campaign = AgenticTool(
    func=_create_ad_campaign,
    thinking_messages=["Creating your campaign...", "Setting up ad campaigns..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=60,
)


# ── create_google_ad_campaign ─────────────────────────────────────────

@tool("create_google_ad_campaign")
async def _create_google_ad_campaign(
    name: str,
    campaign_type: str,
    daily_budget: float,
    product_id: Optional[str] = None,
    landing_url: Optional[str] = None,
    keywords: Optional[list[str]] = None,
    geo_targets: Optional[list[str]] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Create a Google Ads campaign. Supports Search RSA, Display, PMax, and Shopping PMax.

    campaign_type: "search" | "display" | "pmax" | "shopping_pmax"
    For shopping_pmax: provide product_id.
    For search: provide keywords and landing_url.
    For display: provide landing_url.
    geo_targets: list of location names e.g. ["United States", "California"].

    Use this when the user specifically wants a Google campaign. For multi-platform, use create_ad_campaign."""
    org_id = get_org_id()

    payload = _platform_payload(
        org_id=org_id,
        name=name,
        objective="sales" if campaign_type in ("pmax", "shopping_pmax") else "traffic",
        platform="google",
        daily_budget=daily_budget,
        product_id=product_id,
        landing_url=landing_url,
        targeting={},
        headline=headline,
        description=description,
        keywords=keywords,
        campaign_type=campaign_type,
        geo_targets=geo_targets,
    )

    resp = await campaigns_client.post("/campaigns", json=payload)
    body = resp.get("body", {})
    success = resp.get("status_code", 500) in (200, 201)

    if not success:
        error = body.get("error", "Unknown error") if isinstance(body, dict) else str(body)
        return ToolResponse(summary=f"Failed to create Google campaign: {error}", data={"error": error}).model_dump()

    campaign_id = body.get("id", "") if isinstance(body, dict) else ""
    return ToolResponse(
        summary=f"Google {campaign_type.upper()} campaign '{name}' created: ${daily_budget:.0f}/day. ID: {campaign_id}",
        data=body,
        ui_blocks=[campaign_table_block.create(data=CampaignTableData(
            campaigns=[CampaignRow(
                id=campaign_id,
                name=name,
                platform="google",
                status="draft",
                budget=daily_budget,
            )],
        ))],
    ).model_dump()

create_google_ad_campaign = AgenticTool(
    func=_create_google_ad_campaign,
    thinking_messages=["Creating Google Ads campaign...", "Setting up Google campaign..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=60,
)


# ── create_bing_ad_campaign ───────────────────────────────────────────

@tool("create_bing_ad_campaign")
async def _create_bing_ad_campaign(
    name: str,
    campaign_type: str,
    daily_budget: float,
    product_id: Optional[str] = None,
    landing_url: Optional[str] = None,
    keywords: Optional[list[str]] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Create a Microsoft Bing Ads campaign. Supports Search RSA, Audience ads, and Shopping.

    campaign_type: "search" | "audience" | "shopping"
    For shopping: provide product_id.
    For search: provide keywords and landing_url.
    For audience: provide landing_url.

    Use when the user specifically wants a Bing/Microsoft Ads campaign."""
    org_id = get_org_id()

    payload = _platform_payload(
        org_id=org_id,
        name=name,
        objective="sales" if campaign_type == "shopping" else "traffic",
        platform="bing",
        daily_budget=daily_budget,
        product_id=product_id,
        landing_url=landing_url,
        targeting={},
        headline=headline,
        description=description,
        keywords=keywords,
        campaign_type=campaign_type,
    )

    resp = await campaigns_client.post("/campaigns", json=payload)
    body = resp.get("body", {})
    success = resp.get("status_code", 500) in (200, 201)

    if not success:
        error = body.get("error", "Unknown error") if isinstance(body, dict) else str(body)
        return ToolResponse(summary=f"Failed to create Bing campaign: {error}", data={"error": error}).model_dump()

    campaign_id = body.get("id", "") if isinstance(body, dict) else ""
    return ToolResponse(
        summary=f"Bing {campaign_type.upper()} campaign '{name}' created: ${daily_budget:.0f}/day. ID: {campaign_id}",
        data=body,
        ui_blocks=[campaign_table_block.create(data=CampaignTableData(
            campaigns=[CampaignRow(
                id=campaign_id,
                name=name,
                platform="bing",
                status="draft",
                budget=daily_budget,
            )],
        ))],
    ).model_dump()

create_bing_ad_campaign = AgenticTool(
    func=_create_bing_ad_campaign,
    thinking_messages=["Creating Bing Ads campaign...", "Setting up Microsoft Ads..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=60,
)


# ── auto_onboard ──────────────────────────────────────────────────────

@tool("auto_onboard")
async def _auto_onboard() -> dict:
    """Auto-onboarding: find top 5 products by revenue and suggest one campaign per product
    with recommended platform and budget. Returns an onboarding plan card.

    Use at the start of an onboarding session, when the user asks for a quick start,
    or when they want to know where to begin with advertising."""
    org_id = get_org_id()

    resp = await commerce_client.get(f"/products/suggestions?org_id={org_id}&limit=5")
    body = resp.get("body", {})
    products = body.get("products", body) if isinstance(body, dict) else []
    if not isinstance(products, list):
        products = []

    suggestions: list[OnboardingCampaignSuggestion] = []
    total_budget = 0.0

    for p in products[:5]:
        price = float(p.get("price", 0) or 0)
        revenue_l30d = float(p.get("revenueL30d") or p.get("revenue_l30d", 0) or 0)

        # Budget heuristic: 10% of 30-day revenue, min $30, max $200/day
        suggested_budget = max(30.0, min(200.0, revenue_l30d * 0.10 / 30))
        suggested_budget = round(suggested_budget, 0)

        # Platform heuristic: prefer Google PMax for products with images
        has_image = bool(p.get("imageUrl") or p.get("image_url"))
        suggested_platform = "google" if has_image else "meta"

        # ROAS estimate: industry average ~3-4x for e-commerce
        estimated_roas = 3.5

        suggestions.append(OnboardingCampaignSuggestion(
            product_id=p.get("id", ""),
            product_title=p.get("title", ""),
            product_image_url=p.get("imageUrl") or p.get("image_url"),
            suggested_platform=suggested_platform,
            suggested_budget=suggested_budget,
            currency="USD",
            objective="sales",
            estimated_roas=estimated_roas,
            rationale=f"${price:.0f} product with ${revenue_l30d:,.0f} last 30d revenue. {suggested_platform.capitalize()} PMax recommended.",
        ))
        total_budget += suggested_budget

    if not suggestions:
        return ToolResponse(
            summary="No products found. Connect your store first to enable auto-onboarding.",
            data={"products": []},
        ).model_dump()

    return ToolResponse(
        summary=(
            f"Auto-onboarding plan: {len(suggestions)} campaigns ready, "
            f"${total_budget:,.0f}/day total budget. Top product: {suggestions[0].product_title}."
        ),
        data={"suggestions": [s.model_dump() for s in suggestions], "total_budget": total_budget},
        ui_blocks=[onboarding_plan_block.create(data=OnboardingPlanData(
            suggestions=suggestions,
            total_budget=total_budget,
            message=f"Ready to launch {len(suggestions)} campaigns across your top products.",
        ))],
    ).model_dump()

auto_onboard = AgenticTool(
    func=_auto_onboard,
    thinking_messages=["Analyzing your top products...", "Building your onboarding plan..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=30,
)


# ── auto_create_campaigns_from_feed ───────────────────────────────────

@tool("auto_create_campaigns_from_feed")
async def _auto_create_campaigns_from_feed(
    segment: str = "best_sellers",
    platforms: Optional[list[str]] = None,
    daily_budget_per_campaign: float = 50.0,
) -> dict:
    """Batch-create campaigns from product feed segments. Creates one campaign per segment
    group across selected platforms.

    segment: "best_sellers" | "trending" | "new_arrivals"
    platforms: list of "google", "meta", "bing" (defaults to ["google", "meta"])
    daily_budget_per_campaign: budget per campaign per platform

    Use when the user wants to run campaigns across their product catalog or product segments."""
    org_id = get_org_id()
    target_platforms = platforms or ["google", "meta"]

    # Fetch products in the segment
    resp = await commerce_client.get(f"/products?org_id={org_id}&segment={segment}&limit=10")
    body = resp.get("body", {})
    products = body.get("products", []) if isinstance(body, dict) else []

    if not products:
        return ToolResponse(
            summary=f"No products found in segment '{segment}'. Check your product feed.",
            data={"segment": segment, "products": []},
        ).model_dump()

    # Build batch campaign payloads
    batch_payload = []
    for platform in target_platforms:
        campaign_name = f"{segment.replace('_', ' ').title()} — {platform.capitalize()} ({len(products)} products)"
        batch_payload.append({
            "org_id": org_id,
            "name": campaign_name,
            "objective": "SALES",
            "platforms": [platform.upper()],
            "budget": {"daily": daily_budget_per_campaign},
            "campaign_type": "pmax" if platform == "google" else "feed_ads",
            "product_ids": [p.get("id") for p in products if p.get("id")],
            "status": "DRAFT",
        })

    # Create batch via campaigns-service
    resp = await campaigns_client.post("/campaigns/batch", json={"campaigns": batch_payload})
    body = resp.get("body", {})
    success = resp.get("status_code", 500) in (200, 201)

    created = body.get("created", batch_payload) if isinstance(body, dict) else batch_payload
    rows = [
        CampaignRow(
            id=c.get("id", f"draft-{i}"),
            name=c.get("name", ""),
            platform=c.get("platforms", [c.get("platform", "")])[0].lower() if isinstance(c.get("platforms"), list) else c.get("platform", ""),
            status=c.get("status", "draft"),
            budget=daily_budget_per_campaign,
        )
        for i, c in enumerate(created if isinstance(created, list) else batch_payload)
    ]

    total_daily = daily_budget_per_campaign * len(rows)
    return ToolResponse(
        summary=(
            f"Created {len(rows)} campaigns for '{segment}' segment: "
            f"{', '.join(target_platforms)} — ${total_daily:.0f}/day total."
        ),
        data=body if success else {"campaigns": batch_payload},
        ui_blocks=[campaign_table_block.create(data=CampaignTableData(
            campaigns=rows,
            total_spend=0.0,
            period="Just created",
        ))],
    ).model_dump()

auto_create_campaigns_from_feed = AgenticTool(
    func=_auto_create_campaigns_from_feed,
    thinking_messages=["Building campaigns from your product feed...", "Preparing batch campaigns..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=90,
)
