"""Brand tools — company brief generation and brand guideline management.

Tool:
  generate_company_brief — Analyze a website URL and extract/store brand intelligence.

The brand brief is used internally by generate_ad_creative, generate_media_plan,
and setup_full_experiment to produce on-brand output. Users call this once at setup
and it persists for all future AI-generated content.

Reference: Adaptiv api/app/services/company_brief.py, api/app/services/brand.py
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.brand.company_brief import (
    generate_company_brief,
    store_brief_for_org,
    get_brief_for_org,
)
from src.agentic_platform.app.accelera.brand.guidelines import build_brief_summary
from src.agentic_platform.app.accelera.blocks import metric_cards_block, MetricCardsData, MetricItem


@tool("generate_company_brief")
async def _generate_company_brief(website_url: str) -> dict:
    """Analyze a business website and extract brand intelligence: positioning, target audience,
    tone of voice, visual style, and key products. Stores the brief for use in all future
    AI-generated ad creative, media plans, and landing page variants.

    Use when the user asks to analyze their brand, set up brand guidelines, or when
    ad creative should be tailored to their specific brand identity.

    website_url: The business website (e.g. https://example.com)."""
    org_id = get_org_id()

    brief = await generate_company_brief(website_url)
    await store_brief_for_org(org_id, brief)

    metrics = [
        MetricItem(label="Business Type", value=brief.business_type or "—"),
        MetricItem(label="Industry", value=brief.industry or "—"),
        MetricItem(label="Tone", value=brief.tone_of_voice or "—"),
        MetricItem(label="Visual Style", value=brief.visual_style or "—"),
        MetricItem(label="Target Audience", value=(brief.target_audience[:40] + "...") if len(brief.target_audience) > 40 else brief.target_audience or "—"),
    ]
    if brief.key_products:
        metrics.append(MetricItem(label="Key Products", value=", ".join(brief.key_products[:3])))

    return ToolResponse(
        summary=(
            f"Brand brief generated for {website_url}. "
            f"{build_brief_summary(brief)} "
            f"Value prop: {brief.value_proposition[:80] + '...' if len(brief.value_proposition) > 80 else brief.value_proposition}"
        ),
        data=brief.model_dump(),
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"Brand Brief — {website_url}",
        ))],
    ).model_dump()

generate_company_brief_tool = AgenticTool(
    func=_generate_company_brief,
    thinking_messages=["Analyzing your brand...", "Extracting brand intelligence..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=30,
)
