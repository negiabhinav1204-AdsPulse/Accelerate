"""Company Brief — auto-generated brand intelligence.

Analyzes a business website URL and extracts structured brand identity:
positioning, target audience, tone of voice, visual style, and key products.

Used by:
  - generate_ad_creative → format_brief_for_image_prompt
  - create_ad_campaign / copy generation → format_brief_for_copy_prompt
  - setup_full_experiment → format_brief_for_variant_prompt

Reference: Adaptiv api/app/services/company_brief.py
"""

import logging
from typing import Optional

from pydantic import BaseModel

from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import campaigns_client

logger = logging.getLogger(__name__)


class CompanyBrief(BaseModel):
    """Structured brand intelligence extracted from a business website."""

    business_type: str = ""          # e-commerce, SaaS, service, marketplace, etc.
    industry: str = ""               # fashion, electronics, food, fintech, etc.
    positioning: str = ""            # one-sentence positioning statement
    target_audience: str = ""        # demographics and interests
    value_proposition: str = ""      # core customer benefit
    tone_of_voice: str = ""          # professional, casual, playful, luxury, bold, etc.
    key_products: list[str] = []     # top 3-5 products or services
    visual_style: str = ""           # minimalist, bold, lifestyle, luxury, vibrant, etc.
    primary_color: str = ""          # hex or color name if identifiable
    brand_voice: str = ""            # 3-5 keywords: e.g. "trustworthy, modern, warm"


# ── Generation ────────────────────────────────────────────────────────

async def generate_company_brief(website_url: str) -> CompanyBrief:
    """Analyze a business website URL and extract structured brand intelligence.

    Uses LiteLLM (haiku — fast, low-cost) to reason about the business
    based on its URL and domain patterns. Does not require visiting the URL.
    """
    prompt = f"""You are a brand strategist. Analyze the business at this URL and extract brand intelligence.

URL: {website_url}

Based on the URL domain, structure, and any domain knowledge you have, identify:

1. business_type: Type of business (e-commerce, SaaS, service, marketplace, restaurant, etc.)
2. industry: Specific industry/category (fashion, electronics, food, fintech, fitness, etc.)
3. positioning: One clear sentence positioning statement
4. target_audience: Primary audience description (demographics, psychographics, interests)
5. value_proposition: Core benefit the business offers customers
6. tone_of_voice: Brand tone (professional, casual, playful, luxury, bold, authoritative, warm, etc.)
7. key_products: Top 3-5 products or services as a list
8. visual_style: Visual aesthetic (minimalist, bold, lifestyle, luxury, vibrant, clean, earthy, etc.)
9. primary_color: Brand color if you can infer it (e.g. "blue", "#1A73E8", "green"), or ""
10. brand_voice: 3-5 keywords describing the brand voice (e.g. "innovative, trustworthy, modern")

Be specific and actionable — these outputs directly drive ad creative and copy generation."""

    try:
        return await structured_llm_call(prompt, CompanyBrief, model="haiku")
    except Exception:
        logger.exception("Failed to generate company brief for %s", website_url)
        return CompanyBrief()


# ── Storage (via campaigns-service org settings) ──────────────────────

async def get_brief_for_org(org_id: str) -> Optional[CompanyBrief]:
    """Load stored company brief from campaigns-service org settings.

    Returns None if no brief has been generated yet or if the endpoint
    is not yet available (graceful degradation).
    """
    try:
        resp = await campaigns_client.get(f"/org-settings/{org_id}/company-brief")
        body = resp.get("body", {})
        if body and isinstance(body, dict):
            return CompanyBrief(**body)
    except Exception:
        logger.debug("Company brief not available for org %s (endpoint may not exist yet)", org_id)
    return None


async def store_brief_for_org(org_id: str, brief: CompanyBrief) -> bool:
    """Persist company brief via campaigns-service org settings.

    Returns True if stored successfully, False if endpoint not available.
    """
    try:
        resp = await campaigns_client.post(
            f"/org-settings/{org_id}/company-brief",
            json=brief.model_dump(),
        )
        return resp.get("status_code", 0) in (200, 201)
    except Exception:
        logger.debug("Could not store company brief for org %s", org_id)
        return False


# ── Prompt formatters ─────────────────────────────────────────────────

def format_brief_for_image_prompt(brief: CompanyBrief) -> str:
    """Format brand brief as context for Gemini Imagen / image generation prompts.

    Returned string is appended to the image prompt so the AI generates
    on-brand visuals (matching visual style, color palette, tone).
    """
    parts: list[str] = []
    if brief.visual_style:
        parts.append(f"visual style: {brief.visual_style}")
    if brief.primary_color:
        parts.append(f"brand color: {brief.primary_color}")
    if brief.tone_of_voice:
        parts.append(f"tone: {brief.tone_of_voice}")
    if brief.industry:
        parts.append(f"industry: {brief.industry}")
    if brief.target_audience:
        parts.append(f"target audience: {brief.target_audience}")
    return ", ".join(parts)


def format_brief_for_copy_prompt(brief: CompanyBrief) -> str:
    """Format brand brief as context for ad headline and description generation.

    Returned string is injected into copy-gen prompts so the LLM writes
    copy that matches the brand's voice, proposition, and audience.
    """
    lines: list[str] = []
    if brief.brand_voice:
        lines.append(f"Brand voice: {brief.brand_voice}")
    if brief.value_proposition:
        lines.append(f"Value proposition: {brief.value_proposition}")
    if brief.tone_of_voice:
        lines.append(f"Tone of voice: {brief.tone_of_voice}")
    if brief.target_audience:
        lines.append(f"Target audience: {brief.target_audience}")
    if brief.positioning:
        lines.append(f"Positioning: {brief.positioning}")
    return "\n".join(lines)


def format_brief_for_variant_prompt(brief: CompanyBrief) -> str:
    """Format brand brief as context for landing page variant HTML generation.

    Returned string gives the LLM enough context to generate on-brand
    HTML variants for A/B experiments.
    """
    lines: list[str] = []
    if brief.business_type:
        lines.append(f"Business: {brief.business_type} in {brief.industry}")
    if brief.positioning:
        lines.append(f"Positioning: {brief.positioning}")
    if brief.visual_style:
        lines.append(f"Visual style: {brief.visual_style}")
    if brief.primary_color:
        lines.append(f"Primary color: {brief.primary_color}")
    if brief.tone_of_voice:
        lines.append(f"Tone: {brief.tone_of_voice}")
    if brief.value_proposition:
        lines.append(f"Value prop: {brief.value_proposition}")
    return "\n".join(lines)
