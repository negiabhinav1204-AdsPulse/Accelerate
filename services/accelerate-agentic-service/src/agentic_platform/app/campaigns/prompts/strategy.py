"""Strategy prompt — one LLM call to plan all campaigns."""

from __future__ import annotations

import json

from src.agentic_platform.app.campaigns.models import (
    WebsiteContent,
)


def build_strategy_prompt(
    website: WebsiteContent,
    connected_platforms: list[dict],
    capability_matrix: dict,
    user_intent: dict,
) -> str:
    """Build the single strategy LLM call prompt.

    Inputs: website content, connected platforms, capability matrix, user intent.
    Output schema: CampaignStrategy (plan_name, strategy_summary, brand_context,
    currency, campaigns[]).
    """
    product_info = ""
    if website.product_data:
        pd = website.product_data
        product_info = f"Product: {pd.title}"
        if hasattr(pd, "brand") and pd.brand:
            product_info += f" by {pd.brand}"
        if hasattr(pd, "price") and pd.price:
            currency = getattr(pd, "currency", "USD")
            product_info += f" — {currency} {pd.price}"
        if hasattr(pd, "features") and pd.features:
            product_info += f"\nKey features: {', '.join(pd.features[:5])}"
        if hasattr(pd, "description") and pd.description:
            product_info += f"\nDescription: {pd.description[:300]}"

    platforms_str = json.dumps(connected_platforms, indent=2, default=str)
    matrix_str = json.dumps(capability_matrix, indent=2)

    # Gather user-provided constraints
    url = user_intent.get("url", "")
    total_budget = user_intent.get("total_budget", 0)
    daily_budget = user_intent.get("daily_budget", 0)
    duration_days = user_intent.get("duration_days", 30)
    goal = user_intent.get("goal", "")
    req_platforms = user_intent.get("platforms", "")
    req_campaign_types = user_intent.get("campaign_types", "")
    additional_context = user_intent.get("additional_context", "")

    budget_section = ""
    if total_budget > 0 and duration_days > 0:
        computed_daily = round(total_budget / duration_days, 2)
        budget_section = (
            f"Total budget: {total_budget}, Duration: {duration_days} days, "
            f"Computed daily budget: {computed_daily}. "
            f"Split the daily budget across campaigns proportionally."
        )
    elif daily_budget > 0:
        budget_section = f"Daily budget: {daily_budget}. Split across campaigns proportionally."
    else:
        budget_section = (
            "No budget specified. Recommend a sensible default daily budget based on "
            "the product price point and market (e.g., 2-3x the product price as daily budget). "
            "Use the account currency from connected platforms."
        )

    return f"""You are an expert digital advertising strategist. Plan a campaign strategy
for the following website and business.

## Website Analysis
URL: {url}
Title: {website.metadata.title}
Description: {website.metadata.description}
Page type: {website.metadata.page_type}
{product_info}

## Website Content (first 2000 chars)
{website.markdown[:2000]}

## Connected Ad Platforms
{platforms_str}

## Supported Campaign Types & Templates
{matrix_str}

## User Intent
{f'Goal: {goal}' if goal else ''}
{f'Preferred platforms: {req_platforms}' if req_platforms else ''}
{f'Preferred campaign types: {req_campaign_types}' if req_campaign_types else ''}
{budget_section}
{f'Additional context: {additional_context}' if additional_context else ''}

## Instructions
1. Recommend 2-4 campaigns across the connected platforms.
2. Only use SUPPORTED campaign types and templates from the capability matrix.
3. Only use platforms that are in the connected platforms list.
4. Allocate the daily budget proportionally across campaigns.
5. For each campaign, specify target countries, languages, age ranges, genders.
6. For search campaigns, include 10-20 relevant keywords.
7. For campaigns with images, specify image_specs with descriptions, slot names, and aspect ratios.
   Use slot names from: marketingImages (1.91:1), squareMarketingImages (1:1),
   portraitMarketingImages (4:5), images (1.91:1 for Bing display).
8. Extract the brand voice, positioning, and key selling points as brand_context.
9. Use the account currency from connected platforms for the currency field.

## Output
Return a CampaignStrategy JSON object with:
- plan_name: a short, intentional name that captures the brand, product, and campaign goal. Max 5-6 words.
  GOOD examples: "Andamen Oxford Shirt Launch", "Nike Running Shoes Awareness", "Levi's Summer Sale Push"
  BAD examples: "Andamen India 2026-03-20 to 2026-04-19 Media Plan", "Google Ads Campaign Plan", "Media Plan for andamen.com"
  NEVER include dates, "Media Plan", "Campaign Plan", platform names, or URLs in the plan name.
- strategy_summary: 2-3 sentence rationale
- brand_context: brand voice and positioning summary for ad copy generation
- currency: from connected platform account
- campaigns: list of CampaignIntent objects
"""
