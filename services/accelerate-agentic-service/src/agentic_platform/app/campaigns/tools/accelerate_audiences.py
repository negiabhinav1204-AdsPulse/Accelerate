"""Accelerate audience proxy tools.

Proxies the 6 audience data tools from the Accelerate Next.js service.
"""

from typing import List, Optional
from pydantic import Field

from src.agentic_platform.core.engine.models import ToolTag
from src.agentic_platform.app.campaigns.tools.accelerate_tools import make_accelerate_tool

# ── list_audiences ──────────────────────────────────────────────────────────

list_audiences = make_accelerate_tool(
    name="list_audiences",
    description=(
        "List all custom audiences, lookalike audiences, and saved audiences. "
        "Shows name, type, estimated size, platforms, and sync status."
    ),
    field_definitions={},
    thinking_messages=["Loading your audiences...", "Fetching audience segments..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)

# ── create_custom_audience ──────────────────────────────────────────────────

create_custom_audience = make_accelerate_tool(
    name="create_custom_audience",
    description=(
        "Create a custom audience segment. Types: customer_list (hashed emails from "
        "orders), website (retargeting), catalog (product interaction). After creating, "
        "suggest creating a lookalike from it."
    ),
    field_definitions={
        "audience_type": (
            str,
            Field(description="customer_list, website, or catalog"),
        ),
        "name": (
            str,
            Field(description='Audience name, e.g. "VIP Customers - Top 10%"'),
        ),
        "description": (
            Optional[str],
            Field(default=None, description="Description of the audience"),
        ),
        "segment": (
            Optional[str],
            Field(
                default="all",
                description=(
                    "For customer_list: all, vip, repeat, high_ltv, recent, lapsed"
                ),
            ),
        ),
        "event_type": (
            Optional[str],
            Field(
                default="all_visitors",
                description=(
                    "For website/catalog: event to target "
                    "(all_visitors, add_to_cart, purchase, etc.)"
                ),
            ),
        ),
        "retention_days": (
            Optional[int],
            Field(
                default=30,
                description="For website/catalog: days to look back (7, 14, 30, 60, 90, 180)",
            ),
        ),
        "platforms": (
            Optional[List[str]],
            Field(
                default=None,
                description="Platforms to sync to: meta, google, bing",
            ),
        ),
    },
    thinking_messages=["Creating audience segment...", "Building your audience..."],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=30,
)

# ── create_lookalike_audience ───────────────────────────────────────────────

create_lookalike_audience = make_accelerate_tool(
    name="create_lookalike_audience",
    description=(
        "Create a lookalike audience from an existing custom audience. Meta/Google finds "
        "people similar to your source audience — best prospecting strategy."
    ),
    field_definitions={
        "source_audience_id": (
            str,
            Field(description="ID of the source audience to base the lookalike on"),
        ),
        "name": (
            str,
            Field(description='Name for the lookalike, e.g. "LAL 1% - VIP Customers - US"'),
        ),
        "country": (
            Optional[str],
            Field(default="US", description="ISO country code, e.g. US, CA, GB"),
        ),
        "ratio": (
            Optional[float],
            Field(
                default=0.01,
                description="Lookalike size 0.01-0.10 (1% = highest quality, 10% = broadest)",
            ),
        ),
    },
    thinking_messages=["Creating lookalike audience...", "Building lookalike segment..."],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=30,
)

# ── get_audience_insights ───────────────────────────────────────────────────

get_audience_insights = make_accelerate_tool(
    name="get_audience_insights",
    description=(
        "Get estimated size, overlap data, and details for a specific audience segment."
    ),
    field_definitions={
        "audience_id": (
            str,
            Field(description="Audience segment ID"),
        ),
    },
    thinking_messages=["Loading audience insights...", "Analysing audience data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)

# ── smart_targeting ─────────────────────────────────────────────────────────

smart_targeting = make_accelerate_tool(
    name="smart_targeting",
    description=(
        "Analyse customer order data to generate smart targeting recommendations: top "
        "geographies, AOV segments, customer lifetime value distribution. Use BEFORE "
        "creating a campaign to make data-driven targeting decisions."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=90, description="Days of order history to analyse (default 90)"),
        ),
    },
    thinking_messages=[
        "Analysing customer data for targeting...",
        "Building targeting recommendations...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── search_locations ────────────────────────────────────────────────────────

search_locations = make_accelerate_tool(
    name="search_locations",
    description=(
        "Search for Meta geo targeting keys by location name. Use BEFORE creating a "
        "Meta campaign to resolve region/city names to the correct targeting keys."
    ),
    field_definitions={
        "query": (
            str,
            Field(
                description='Location name to look up, e.g. "California", "Ontario", "Toronto"',
            ),
        ),
        "location_type": (
            Optional[str],
            Field(
                default="region",
                description="region, city, country, or zip",
            ),
        ),
    },
    thinking_messages=["Looking up location keys...", "Searching targeting locations..."],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=15,
)

# ── Public exports ──────────────────────────────────────────────────────────

ACCELERATE_AUDIENCE_TOOLS = [
    list_audiences,
    create_custom_audience,
    create_lookalike_audience,
    get_audience_insights,
    smart_targeting,
    search_locations,
]
