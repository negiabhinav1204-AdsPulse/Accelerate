"""Navigation tool — triggers frontend navigation via nav_suggestion UIBlock."""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, UIBlock, ToolTag

# Destination → path suffix mapping
_NAV_MAP = {
    "reporting":       "/reporting",
    "connectors":      "/connectors",
    "campaigns":       "/campaigns",
    "campaign_create": "/campaigns/create",
    "create_campaign": "/campaigns/create",
    "billing":         "/billing",
    "optimization":    "/optimization",
    "keyword_planner": "/utilities/keyword-planner",
    "keywords":        "/utilities/keyword-planner",
    "shopping_feeds":  "/shopping-feeds",
    "feeds":           "/shopping-feeds",
    "audiences":       "/audiences",
}

_LABELS = {
    "reporting":       "View Reporting",
    "connectors":      "Manage Connectors",
    "campaigns":       "View Campaigns",
    "campaign_create": "Create Campaign",
    "create_campaign": "Create Campaign",
    "billing":         "Go to Billing",
    "optimization":    "View Optimization",
    "keyword_planner": "Open Keyword Planner",
    "keywords":        "Open Keyword Planner",
    "shopping_feeds":  "View Shopping Feeds",
    "feeds":           "View Shopping Feeds",
    "audiences":       "Manage Audiences",
}


@tool("navigate_to")
async def _navigate_to(
    destination: str,
    label: str | None = None,
    description: str | None = None,
) -> dict:
    """Navigate the user to a specific page in Accelerate.

    Use when the user says: "take me to...", "show me...", "go to...", "open...",
    or when suggesting a next step that requires navigating to another page.

    destination options: reporting, connectors, campaigns, campaign_create,
    billing, optimization, keyword_planner, shopping_feeds, audiences
    """
    path_suffix = _NAV_MAP.get(destination, f"/{destination}")
    nav_label = label or _LABELS.get(destination, f"Go to {destination}")
    nav_description = description or f"Navigate to {destination.replace('_', ' ')}"

    return ToolResponse(
        summary=f"Navigating to {destination}",
        data={"destination": destination, "path_suffix": path_suffix},
        ui_blocks=[
            UIBlock(
                block_type="nav_suggestion",
                data={
                    "label": nav_label,
                    "description": nav_description,
                    "path": path_suffix,   # Frontend prepends /organizations/{slug}
                },
            )
        ],
    ).model_dump()


navigate_to = AgenticTool(
    func=_navigate_to,
    thinking_messages=["Finding the right page..."],
    tags=[ToolTag.PLATFORM],
    timeout=5,
)
