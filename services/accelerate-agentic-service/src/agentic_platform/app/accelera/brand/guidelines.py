"""Brand Guidelines — inject brand context into system prompts and tool calls.

Loads the org's company brief and formats it for injection into:
  - System prompt dynamic context (per-request)
  - Image generation prompts
  - Ad copy generation prompts
  - Landing page variant prompts

Reference: Adaptiv api/app/services/brand.py
"""

import logging
from typing import Optional

from src.agentic_platform.app.accelera.brand.company_brief import (
    CompanyBrief,
    get_brief_for_org,
    format_brief_for_copy_prompt,
)

logger = logging.getLogger(__name__)


async def get_brand_context(org_id: str) -> str:
    """Load org's company brief and return a formatted string for system prompt injection.

    Returns an empty string if no brief exists — callers should handle this gracefully.
    Called by accelera_dynamic_context() to inject brand awareness into every chat turn.
    """
    brief = await get_brief_for_org(org_id)
    if not brief:
        return ""

    lines: list[str] = []
    if brief.business_type and brief.industry:
        lines.append(f"Business type: {brief.business_type} ({brief.industry})")
    if brief.positioning:
        lines.append(f"Positioning: {brief.positioning}")
    if brief.tone_of_voice:
        lines.append(f"Brand voice: {brief.tone_of_voice}")
    if brief.target_audience:
        lines.append(f"Target audience: {brief.target_audience}")
    if brief.key_products:
        lines.append(f"Key products: {', '.join(brief.key_products[:3])}")

    if not lines:
        return ""

    return "Brand context:\n" + "\n".join(f"  {line}" for line in lines)


async def get_copy_context(org_id: str) -> str:
    """Return brand brief formatted for ad copy generation.

    Returns empty string if no brief — copy generation still works without it.
    """
    brief = await get_brief_for_org(org_id)
    if not brief:
        return ""
    return format_brief_for_copy_prompt(brief)


def build_brief_summary(brief: Optional[CompanyBrief]) -> str:
    """Build a short one-line summary of the brand brief for tool responses."""
    if not brief:
        return "No brand brief on file."
    parts = []
    if brief.business_type:
        parts.append(brief.business_type)
    if brief.industry:
        parts.append(f"in {brief.industry}")
    if brief.tone_of_voice:
        parts.append(f"({brief.tone_of_voice} brand)")
    return " ".join(parts) if parts else "Brand brief generated."
