"""LLM-powered keyword generation for Search campaigns.

Generates 20-30 positive keywords with match types + 5-8 negative keywords
per Search campaign. Uses the full campaign context (brand, products, audience,
offers, competitive edges) to produce high-quality, intent-stratified keywords.

Ported and improved from accelerate-agentic-framework v2 LLMKeywordTargetingResolver.
"""

import logging
from typing import List

from pydantic import BaseModel, Field

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.campaigns.targeting import sanitize_keyword

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an expert paid-search keyword strategist with 15 years of experience \
managing Google Ads and Microsoft Advertising campaigns.

Given a campaign configuration (brand, products, audience, key message), generate \
a comprehensive keyword strategy.

## KEYWORD STRATEGY (generate 20-30 positive keywords)

Organize keywords into these intent tiers:

**High-intent / Bottom-funnel (8-10 keywords, EXACT match):**
- Brand + product keywords ("andamen oxford shirt", "andamen cotton polo")
- Product-specific with purchase intent ("buy olive green oxford shirt", "cotton oxford shirt online")
- Product + price/offer keywords ("oxford shirt under 3000", "cotton shirt sale india")

**Mid-intent / Consideration (8-10 keywords, PHRASE match):**
- Category + attribute keywords ("men's cotton oxford shirt", "slim fit oxford shirt")
- Problem/need keywords ("comfortable office shirt men", "durable everyday shirt")
- Comparison keywords ("best cotton shirts for men", "premium casual shirts india")

**Discovery / Top-funnel (4-6 keywords, BROAD match):**
- Broad category keywords ("men's casual shirts", "cotton shirts online")
- Lifestyle/occasion keywords ("smart casual shirt for work", "weekend casual shirt men")

## NEGATIVE KEYWORDS (generate 5-8, all PHRASE match)

Block irrelevant traffic based on brand positioning:
- If premium brand: exclude "cheap", "free", "wholesale", "used", "replica"
- If product-specific: exclude unrelated categories ("jeans", "trousers", "shoes")
- Always exclude: "diy", "how to make", "pattern", "tutorial"
- Exclude competitor brand names if mentioned in the campaign context

## OUTPUT FORMAT

For each keyword:
- text: the keyword phrase (lowercase, natural language)
- match_type: EXACT, PHRASE, or BROAD (follow the tier guidance above)
- is_negative: false for positive keywords, true for negative keywords

## KEYWORD FORMATTING RULES (Google Ads + Microsoft Advertising)

1. Write ALL keywords in lowercase — no exceptions. Google Ads has a strict \
   CAPITALIZATION policy and will reject keywords in ALL CAPS.
   Examples: 'men's running shoes' ✓  |  'Men's Running Shoes' ✗  |  'RUNNING SHOES' ✗
2. Never use currency symbols ($, ₹, €, £). Spell them out \
   (e.g. 'shoes under 2000 rupees', not 'shoes under ₹2000').
3. Never use the % symbol. Use the word 'percent' instead.
4. Ampersands (&) and accent marks (á, é, etc.) are allowed.
5. Do not use these invalid characters: ! @ ^ = ; ` < > [ ] ( ) ? \\ | ~ ,
6. Asterisks (*) are only allowed in negative keywords.
7. Each keyword must be at most 80 characters and 10 words.
8. Think like a real searcher — use natural phrases people actually type into Google or Bing.
9. Include the audience's language/locale context (e.g. Indian English phrasing for India market)."""


class KeywordEntry(BaseModel):
    text: str = Field(description="Keyword phrase, lowercase, natural language")
    match_type: str = Field(description="EXACT for high-intent, PHRASE for mid-intent, BROAD for discovery")
    is_negative: bool = Field(default=False, description="True only for negative/exclusion keywords")


class KeywordOutput(BaseModel):
    keywords: List[KeywordEntry] = Field(
        description="20-30 positive keywords (stratified by intent) + 5-8 negative keywords",
        min_length=10,
    )


async def generate_keywords(
    campaign_context: str,
    seed_keywords: list[str] | None = None,
    negative_seeds: list[str] | None = None,
    messaging_pillars: list[str] | None = None,
    avoid_themes: list[str] | None = None,
    goal: str = "",
) -> KeywordOutput:
    """Generate keywords for a Search campaign via LLM.

    Args:
        campaign_context: Serialized V2CampaignConfig JSON (includes ad_context
            with brand, products, audience, offers, competitive edges).
        seed_keywords: User-provided search queries from AudiencePreferences.
            These MUST appear in the output as EXACT match keywords.
        negative_seeds: User-specified negative keywords to always include.
        messaging_pillars: Key themes to emphasize (from CreativePreferences).
        avoid_themes: Themes to exclude (from CreativePreferences) — drive negative keywords.
        goal: Campaign objective (e.g. "maximize ROAS") — influences intent tier weighting.

    Returns:
        KeywordOutput with sanitized, deduplicated keywords.
    """
    # Build user prompt: campaign JSON + explicit context from input dimensions
    user_prompt = campaign_context

    if seed_keywords:
        seeds_str = ", ".join(f'"{kw}"' for kw in seed_keywords)
        user_prompt += (
            f"\n\nMANDATORY SEED KEYWORDS (from user input — include ALL as EXACT match): "
            f"{seeds_str}. Build your keyword strategy around these seeds."
        )
    if messaging_pillars:
        pillars_str = ", ".join(messaging_pillars)
        user_prompt += (
            f"\n\nMESSAGING PILLARS (emphasize in keyword themes): {pillars_str}. "
            f"Generate keywords that reflect these themes."
        )
    if avoid_themes:
        avoid_str = ", ".join(avoid_themes)
        user_prompt += (
            f"\n\nAVOID THEMES (add as negative keywords): {avoid_str}. "
            f"Include these and related terms as negative PHRASE match keywords."
        )
    if negative_seeds:
        neg_str = ", ".join(f'"{kw}"' for kw in negative_seeds)
        user_prompt += (
            f"\n\nMANDATORY NEGATIVE KEYWORDS (from user input — include ALL): {neg_str}"
        )
    if goal:
        user_prompt += (
            f"\n\nCAMPAIGN GOAL: {goal}. "
            f"Weight keyword intent accordingly — 'drive sales'/'maximize ROAS' = more EXACT high-intent, "
            f"'drive traffic'/'awareness' = more BROAD discovery keywords."
        )

    try:
        result = await structured_llm_call(
            user_prompt,
            KeywordOutput,
            system_prompt=_SYSTEM_PROMPT,
            model=settings.workflow_plan_model,
        )

        # Sanitize + validate
        seen = set()
        clean = []
        for kw in result.keywords:
            kw.text = sanitize_keyword(kw.text)
            kw.match_type = kw.match_type.upper()
            if kw.match_type not in ("EXACT", "PHRASE", "BROAD"):
                kw.match_type = "BROAD"
            # Deduplicate
            key = (kw.text, kw.is_negative)
            if kw.text and key not in seen:
                seen.add(key)
                clean.append(kw)

        result.keywords = clean
        pos = sum(1 for k in clean if not k.is_negative)
        neg = sum(1 for k in clean if k.is_negative)
        logger.info("[keywords] generated %d positive + %d negative keywords", pos, neg)
        return result

    except Exception as exc:
        logger.warning("[keywords] LLM keyword generation failed: %s", exc)
        return KeywordOutput(keywords=[])
