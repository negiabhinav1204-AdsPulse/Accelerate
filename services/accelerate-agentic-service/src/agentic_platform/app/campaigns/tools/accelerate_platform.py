"""Accelerate platform, feeds, and strategy proxy tools.

Proxies the 11 platform/feeds/strategy data tools from the Accelerate
Next.js service.
"""

from typing import Optional
from pydantic import Field

from src.agentic_platform.core.engine.models import ToolTag
from src.agentic_platform.app.campaigns.tools.accelerate_tools import make_accelerate_tool

# ── get_feed_health ─────────────────────────────────────────────────────────

get_feed_health = make_accelerate_tool(
    name="get_feed_health",
    description=(
        "Get product feed health scores, last push times, and issue counts for all "
        "connected feeds (Google Shopping, Meta Catalog, etc.)."
    ),
    field_definitions={},
    thinking_messages=["Checking feed health...", "Loading feed status..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=30,
)

# ── generate_product_feed ───────────────────────────────────────────────────

generate_product_feed = make_accelerate_tool(
    name="generate_product_feed",
    description=(
        "Generate an optimised product feed snapshot from the product catalog. Returns "
        "products with AI-optimised titles, health scores, and smart segments."
    ),
    field_definitions={
        "segment": (
            Optional[str],
            Field(
                default="all",
                description=(
                    "Filter by segment: best_sellers, new_arrivals, high_margin, "
                    "underperformers, all (default all)"
                ),
            ),
        ),
        "limit": (
            Optional[int],
            Field(default=20, description="Max products to return (default 20)"),
        ),
    },
    thinking_messages=["Generating product feed...", "Building feed snapshot..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_merchant_center_status ──────────────────────────────────────────────

get_merchant_center_status = make_accelerate_tool(
    name="get_merchant_center_status",
    description=(
        "Check connected Google Merchant Center accounts, their sync status, and any "
        "product disapprovals."
    ),
    field_definitions={},
    thinking_messages=["Checking Merchant Center status...", "Loading GMC connection..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=30,
)

# ── push_feed_to_merchant_center ────────────────────────────────────────────

push_feed_to_merchant_center = make_accelerate_tool(
    name="push_feed_to_merchant_center",
    description=(
        "Push the optimised product feed to Google Merchant Center with AI-enhanced "
        "titles, descriptions, and custom labels for PMax campaign segmentation. Use "
        "when the user asks to 'push to GMC', 'sync products to Google', or 'update "
        "merchant center'."
    ),
    field_definitions={
        "segment": (
            Optional[str],
            Field(
                default="all",
                description=(
                    "Product segment: all, best_sellers, new_arrivals, trending. Default: all"
                ),
            ),
        ),
        "include_labels": (
            Optional[bool],
            Field(
                default=True,
                description=(
                    "Include custom labels (best_seller, trending, etc.) for PMax "
                    "segmentation. Default: true"
                ),
            ),
        ),
    },
    thinking_messages=[
        "Pushing feed to Google Merchant Center...",
        "Syncing products to GMC...",
    ],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=60,
)

# ── get_merchant_center_diagnostics ────────────────────────────────────────

get_merchant_center_diagnostics = make_accelerate_tool(
    name="get_merchant_center_diagnostics",
    description=(
        "Check Google Merchant Center feed health — product approval status, "
        "disapprovals, warnings, and what is causing them. Use when the user asks "
        "about disapproved products, GMC errors, or feed issues."
    ),
    field_definitions={},
    thinking_messages=["Running Merchant Center diagnostics...", "Checking GMC approvals..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=30,
)

# ── get_connected_platforms ─────────────────────────────────────────────────

get_connected_platforms = make_accelerate_tool(
    name="get_connected_platforms",
    description=(
        "Get all connected ad platforms (Meta, Google, Bing) with account details, "
        "connection status, and last sync time."
    ),
    field_definitions={
        "platform": (
            Optional[str],
            Field(
                default=None,
                description="Filter by platform: google, meta, bing, or omit for all",
            ),
        ),
    },
    thinking_messages=["Loading connected platforms...", "Fetching ad accounts..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)

# ── get_ad_platform_status ──────────────────────────────────────────────────

get_ad_platform_status = make_accelerate_tool(
    name="get_ad_platform_status",
    description=(
        "Check the health and connection status of all ad platforms. Use when the user "
        "asks 'which platforms are connected' or before suggesting multi-platform campaigns."
    ),
    field_definitions={},
    thinking_messages=["Checking platform connections...", "Verifying ad platform status..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=30,
)

# ── suggest_campaign_strategy ───────────────────────────────────────────────

suggest_campaign_strategy = make_accelerate_tool(
    name="suggest_campaign_strategy",
    description=(
        "Analyse product feed segments and suggest an optimal multi-campaign strategy. "
        "Returns segment breakdown with recommended campaign configurations. Use when "
        "user asks 'what campaigns should I run?' or 'help me plan my ads'."
    ),
    field_definitions={
        "total_daily_budget": (
            Optional[float],
            Field(
                default=None,
                description=(
                    "Total daily budget available across all campaigns (in org currency)"
                ),
            ),
        ),
        "objective": (
            Optional[str],
            Field(
                default="max_conversions",
                description=(
                    "Primary goal: max_conversions, max_roas, awareness, traffic "
                    "(default max_conversions)"
                ),
            ),
        ),
    },
    thinking_messages=[
        "Building your campaign strategy...",
        "Analysing your data for the best campaign mix...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── get_campaign_strategies ─────────────────────────────────────────────────

get_campaign_strategies = make_accelerate_tool(
    name="get_campaign_strategies",
    description=(
        "Get available campaign strategies/types for a specific platform. Call this "
        "when the user is choosing what type of campaign to create."
    ),
    field_definitions={
        "platform": (
            str,
            Field(description="Ad platform: google, meta, or bing"),
        ),
    },
    thinking_messages=["Loading campaign types...", "Fetching available strategies..."],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=15,
)

# ── growth_opportunities ────────────────────────────────────────────────────

growth_opportunities = make_accelerate_tool(
    name="growth_opportunities",
    description=(
        "Find untapped growth opportunities by comparing customer data with campaign "
        "coverage. Identifies products with high velocity but no active campaigns, top "
        "regions with no geo-targeting, and audience gaps."
    ),
    field_definitions={},
    thinking_messages=[
        "Scanning for growth opportunities...",
        "Identifying gaps in your campaign coverage...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── auto_setup_everything ───────────────────────────────────────────────────

auto_setup_everything = make_accelerate_tool(
    name="auto_setup_everything",
    description=(
        "Auto-configure campaigns for the top products from the product catalog. Picks "
        "the best products by sales velocity, suggests campaign strategies and budgets "
        "for each, and gives a ready-to-activate plan. Use when user says 'just set "
        "everything up', 'get me started', or 'do it all'."
    ),
    field_definitions={
        "max_products": (
            Optional[int],
            Field(default=3, description="Max products to set up (default 3, max 5)"),
        ),
        "daily_budget_usd": (
            Optional[float],
            Field(default=20, description="Daily budget per campaign in USD (default 20)"),
        ),
    },
    thinking_messages=[
        "Setting up your campaign plan...",
        "Auto-configuring campaigns for top products...",
        "Building your full campaign setup...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── Public exports ──────────────────────────────────────────────────────────

ACCELERATE_PLATFORM_TOOLS = [
    get_feed_health,
    generate_product_feed,
    get_merchant_center_status,
    push_feed_to_merchant_center,
    get_merchant_center_diagnostics,
    get_connected_platforms,
    get_ad_platform_status,
    suggest_campaign_strategy,
    get_campaign_strategies,
    growth_opportunities,
    auto_setup_everything,
]
