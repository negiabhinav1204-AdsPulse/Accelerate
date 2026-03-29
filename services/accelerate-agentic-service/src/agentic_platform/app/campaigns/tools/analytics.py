"""Demo analytics tool — returns mock campaign data (INLINE block).

Returns hardcoded campaign data for local development without BigQuery credentials.
Use BigQuery MCP tools (via bigquery_analytics MCP server) for real analytics.

Demonstrates: BlockDisplay.INLINE — card rendered directly in chat flow.
"""

import asyncio
import random
from langchain_core.tools import tool

from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.app.campaigns.blocks import (
    campaign_overview, CampaignOverviewData,
)

# Mock campaign data
_MOCK_CAMPAIGNS = [
    {"name": "Summer Sale", "platform": "google", "spend": 5200, "roas": 4.2, "ctr": 3.1, "conversions": 847},
    {"name": "Brand Awareness", "platform": "meta", "spend": 3800, "roas": 2.7, "ctr": 1.8, "conversions": 312},
    {"name": "Holiday Push", "platform": "google", "spend": 4500, "roas": 3.5, "ctr": 2.4, "conversions": 623},
    {"name": "Retargeting Q4", "platform": "bing", "spend": 1200, "roas": 5.1, "ctr": 4.2, "conversions": 198},
]


@tool("demo_query_analytics")
async def _demo_query_analytics(question: str) -> dict:
    """Returns mock campaign data. Use BigQuery MCP tools for real analytics.

    This demo tool returns hardcoded campaign data for local development
    without BigQuery credentials. When the bigquery_analytics MCP server
    is available, prefer the real BigQuery tools (list_tables, run_query)
    over this demo tool."""

    await asyncio.sleep(random.uniform(1.0, 2.0))  # simulate API latency
    campaigns = _MOCK_CAMPAIGNS
    total_spend = sum(c["spend"] for c in campaigns)
    top = max(campaigns, key=lambda c: c["roas"])

    return ToolResponse(
        summary=f"{len(campaigns)} campaigns. Total spend: ${total_spend:,.0f}. Top performer: {top['name']} ({top['roas']}x ROAS).",
        data=campaigns,
        ui_blocks=[
            campaign_overview.create(data=CampaignOverviewData(
                campaigns=campaigns,
                total_spend=total_spend,
                top_performer=top["name"],
            )),
        ],
    ).model_dump()


demo_query_analytics = AgenticTool(
    func=_demo_query_analytics,
    thinking_messages=[
        "Fetching demo data...",
    ],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)
