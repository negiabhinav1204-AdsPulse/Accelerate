"""Accelerate campaign management proxy tools.

Proxies the 5 campaign data tools from the Accelerate Next.js service.
"""

from typing import Optional
from pydantic import Field

from src.agentic_platform.core.engine.models import ToolTag
from src.agentic_platform.app.campaigns.tools.accelerate_tools import make_accelerate_tool

# ── campaign_health_check ───────────────────────────────────────────────────

campaign_health_check = make_accelerate_tool(
    name="campaign_health_check",
    description=(
        "Run a health check across all campaigns. Scores each campaign as: winner "
        "(ROAS >3), learner (spend <$100), underperformer (ROAS 1-3), or bleeder "
        "(ROAS <1). Returns prioritised recommendations."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Look-back period in days (default 30)"),
        ),
    },
    thinking_messages=[
        "Running campaign health check...",
        "Scoring your campaigns...",
        "Analysing campaign performance...",
    ],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=60,
)

# ── campaign_optimizer ──────────────────────────────────────────────────────

campaign_optimizer = make_accelerate_tool(
    name="campaign_optimizer",
    description=(
        "Analyse all campaigns and return specific optimisation actions: pause bleeders, "
        "scale winners, adjust budgets, improve creatives."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Look-back period in days (default 30)"),
        ),
    },
    thinking_messages=[
        "Generating optimisation plan...",
        "Finding opportunities to improve your campaigns...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── toggle_campaign ─────────────────────────────────────────────────────────

toggle_campaign = make_accelerate_tool(
    name="toggle_campaign",
    description="Pause or activate a campaign. Pass the campaign ID and the desired action.",
    field_definitions={
        "campaign_id": (
            str,
            Field(description="Campaign ID to toggle"),
        ),
        "action": (
            str,
            Field(description="pause or activate"),
        ),
    },
    thinking_messages=["Updating campaign status...", "Applying change..."],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=30,
)

# ── update_budget ───────────────────────────────────────────────────────────

update_budget = make_accelerate_tool(
    name="update_budget",
    description=(
        "Update the daily budget for a campaign. Use daily_budget (absolute new value) "
        "OR scale_percent (relative increase, e.g. 25 = +25%)."
    ),
    field_definitions={
        "campaign_id": (
            str,
            Field(description="Campaign ID"),
        ),
        "daily_budget": (
            Optional[float],
            Field(
                default=None,
                description=(
                    "New daily budget in the org currency (e.g. 50 = $50). "
                    "Use this OR scale_percent."
                ),
            ),
        ),
        "scale_percent": (
            Optional[float],
            Field(
                default=None,
                description=(
                    "Increase budget by this percentage (e.g. 25 = +25%). "
                    "Use this OR daily_budget."
                ),
            ),
        ),
    },
    thinking_messages=["Updating campaign budget...", "Applying budget change..."],
    tags=[ToolTag.CAMPAIGN_MGMT],
    timeout=30,
)

# ── get_campaign_history ────────────────────────────────────────────────────

get_campaign_history = make_accelerate_tool(
    name="get_campaign_history",
    description=(
        "Get a list of all campaigns with their budgets, status, platforms, and health scores."
    ),
    field_definitions={
        "status": (
            Optional[str],
            Field(
                default="all",
                description="Filter by status: active, paused, draft, all (default all)",
            ),
        ),
        "limit": (
            Optional[int],
            Field(default=20, description="Max campaigns to return (default 20)"),
        ),
    },
    thinking_messages=["Loading campaign history...", "Fetching your campaigns..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── Public exports ──────────────────────────────────────────────────────────

ACCELERATE_CAMPAIGN_TOOLS = [
    campaign_health_check,
    campaign_optimizer,
    toggle_campaign,
    update_budget,
    get_campaign_history,
]
