"""Enrichment — resolve SlimPlan -> V2CampaignPlan with ad context.

This is business logic, not a prompt — it resolves references from the
slim plan (persona names, product names) into fully populated ad context
objects suitable for text and image generation.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

from src.agentic_platform.app.campaigns.models import (
    MarketingAnalysisReport as _MAR,
    SlimPlan as _SP,
    V2CampaignConfig as _V2CC,
    V2CampaignPlan as _V2CP,
    CampaignAdContext as _CAC,
    AdProductDetail as _APD,
    AdAudienceDetail as _AAD,
)


def enrich_slim_plan(
    slim: "_SP",
    analysis: "_MAR",
    start_date: str = "",
    end_date: str = "",
) -> "_V2CP":
    """Convert SlimPlan -> V2CampaignPlan with resolved ad context.

    1. Derive template_type deterministically from (platform, campaign_type)
    2. Resolve target_audience -> AdAudienceDetail (for targeting + text gen)
    3. Resolve target_products -> AdProductDetail (for text gen + images)
    4. Build CampaignAdContext per campaign
    """
    from src.agentic_platform.app.campaigns.platform_matrix import PlatformCapabilityMatrix
    from src.agentic_platform.app.campaigns.models import PlatformType, CampaignType
    from datetime import date, timedelta

    brand = analysis.brand
    sp = analysis.shopify_product
    is_product_page = analysis.page_type == "product" and sp is not None
    product_map = {p.name.lower(): p for p in analysis.products}
    audience_map = {a.persona_name.lower(): a for a in analysis.audience}
    website_url = str(analysis.website_url).rstrip("/")

    today = date.today()
    start = start_date or today.isoformat()
    end = end_date or (today + timedelta(days=30)).isoformat()

    enriched = []
    for sc in slim.campaigns:
        # 1. Derive template_type — platform and campaign_type are enums (validated by Pydantic)
        tmpl = PlatformCapabilityMatrix.get_default_template(sc.platform, sc.campaign_type)
        if not tmpl:
            logger.warning("[enrich] dropping campaign %s — no supported template for %s/%s",
                           sc.name, sc.platform.value, sc.campaign_type.value)
            continue

        # 2. Resolve products
        resolved_products = []
        for pname in sc.target_products:
            matched = product_map.get(pname.lower())
            if not matched:
                for key, p in product_map.items():
                    if pname.lower() in key or key in pname.lower():
                        matched = p
                        break
            if matched:
                use_scraped = is_product_page and sp and (
                    matched.name.lower() in sp.title.lower() or sp.title.lower() in matched.name.lower()
                )
                resolved_products.append(_APD(
                    name=matched.name, category=matched.category,
                    price_range=matched.price_range,
                    key_features=matched.key_features, benefits=matched.benefits,
                    differentiation=matched.differentiation,
                    exact_price=sp.price if use_scraped else None,
                    discount_percentage=sp.discount_percentage if use_scraped else None,
                    currency=sp.currency if use_scraped else None,
                ))

        # 3. Resolve audience — fuzzy match, then fallback to first persona
        matched_aud = None
        if sc.target_audience:
            ta = sc.target_audience.lower()
            matched_aud = audience_map.get(ta)
            if not matched_aud:
                for key, a in audience_map.items():
                    if ta in key or key in ta:
                        matched_aud = a
                        break
        # Fallback: first persona — never leave audience empty (loses all targeting)
        if not matched_aud and analysis.audience:
            matched_aud = analysis.audience[0]
            logger.warning("[enrich] audience '%s' not matched — falling back to '%s'",
                           sc.target_audience, matched_aud.persona_name)

        resolved_audience = None
        if matched_aud:
            resolved_audience = _AAD(
                persona_name=matched_aud.persona_name,
                gender=matched_aud.gender.value,
                age_range=matched_aud.demographics.age,
                location=matched_aud.demographics.location,
                language=matched_aud.demographics.language,
                search_queries=matched_aud.search_queries,
            )

        # 4. Landing URL — product-level override > shopify product > website URL
        # Check source ProductInsight for user-provided landing_url
        first_product_url = None
        for pname in sc.target_products:
            p_match = product_map.get(pname.lower())
            if not p_match:
                for key, p in product_map.items():
                    if pname.lower() in key or key in pname.lower():
                        p_match = p
                        break
            if p_match and p_match.landing_url:
                first_product_url = p_match.landing_url
                break
        if not first_product_url and product_map:
            # Fallback: first product with a landing_url
            first_product_url = next((p.landing_url for p in product_map.values() if p.landing_url), None)

        if first_product_url:
            landing_url = first_product_url
        elif is_product_page and sp and sp.product_url:
            landing_url = sp.product_url
        else:
            landing_url = website_url

        # 5. Offers
        offers = list(brand.offers_and_promotions)
        if is_product_page and sp and sp.discount_percentage:
            offers.insert(0, f"{sp.discount_percentage}% OFF — Now {sp.price} {sp.currency}")

        ad_ctx = _CAC(
            brand_name=brand.name, tone_of_voice=brand.tone_of_voice,
            tagline=brand.tagline, landing_url=landing_url,
            products=resolved_products, audience=resolved_audience,
            social_proof=list(brand.social_proof),
            offers=offers,
            competitor_edges=list(brand.competitor_edges),
        )

        enriched.append(_V2CC(
            name=sc.name, platform=sc.platform, campaign_type=sc.campaign_type,
            template_type=tmpl,
            daily_budget=sc.daily_budget, budget_currency=slim.currency,
            start_date=start, end_date=end,
            target_audience=sc.target_audience, target_products=sc.target_products,
            key_message=sc.key_message, ad_tone=sc.ad_tone,
            ad_context=ad_ctx,
        ))

    return _V2CP(plan_name=slim.plan_name, currency=slim.currency, campaigns=enriched)


# Backward compat alias
def enrich_campaign_plan(plan, analysis):
    """Legacy wrapper — if plan is already V2CampaignPlan, return as-is."""
    if hasattr(plan, 'campaigns') and plan.campaigns and hasattr(plan.campaigns[0], 'template_type'):
        return plan  # already enriched
    return enrich_slim_plan(plan, analysis)
