"""Campaign details tool — returns full campaign detail (SIDEBAR block).

Demonstrates: BlockDisplay.SIDEBAR — inline trigger card in chat,
full detail panel opens in sidebar on click.
"""

import asyncio
import random
from langchain_core.tools import tool

from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.app.campaigns.blocks import (
    campaign_details, CampaignDetailData, CampaignDetailTrigger,
)


@tool("get_campaign_details")
async def _get_campaign_details(campaign_name: str) -> dict:
    """Get detailed performance data for a specific campaign. Use when the
    user asks about a specific campaign's metrics, daily breakdown, or status."""

    await asyncio.sleep(random.uniform(1.0, 2.0))  # simulate API latency

    return ToolResponse(
        summary=f"Campaign '{campaign_name}': $5,200 spend, 4.2x ROAS, 3.1% CTR, 847 conversions.",
        data={"campaign_name": campaign_name, "roas": 4.2, "ctr": 3.1, "spend": 5200},
        ui_blocks=[
            campaign_details.create(
                data=CampaignDetailData(
                    campaign_id="camp-001",
                    campaign_name=campaign_name,
                    platform="google",
                    status="active",
                    daily_budget=250,
                    total_spend=5200,
                    impressions=168000,
                    clicks=5208,
                    ctr=3.1,
                    conversions=847,
                    roas=4.2,
                    daily_metrics=[
                        {"date": "2026-03-07", "spend": 245, "clicks": 780, "conversions": 128},
                        {"date": "2026-03-08", "spend": 250, "clicks": 812, "conversions": 135},
                        {"date": "2026-03-09", "spend": 238, "clicks": 695, "conversions": 112},
                        {"date": "2026-03-10", "spend": 250, "clicks": 845, "conversions": 141},
                        {"date": "2026-03-11", "spend": 247, "clicks": 763, "conversions": 119},
                        {"date": "2026-03-12", "spend": 250, "clicks": 801, "conversions": 138},
                        {"date": "2026-03-13", "spend": 220, "clicks": 512, "conversions": 74},
                    ],
                ),
                trigger=CampaignDetailTrigger(
                    campaign_name=campaign_name,
                    platform="Google Ads",
                    status="active",
                    roas=4.2,
                ),
            ),
        ],
    ).model_dump()


get_campaign_details = AgenticTool(
    func=_get_campaign_details,
    thinking_messages=[
        "Loading campaign details...",
        "Fetching performance breakdown...",
    ],
    tags=[ToolTag.ANALYTICS],
    timeout=15,
)
