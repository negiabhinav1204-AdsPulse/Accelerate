"""Slim Plan Prompt — concise, data-focused, minimal instructions."""

from __future__ import annotations

from datetime import date as _date
import re as _re


class MediaPlanPrompts:
    """Concise plan prompt — data-focused, minimal instructions."""

    TEMPLATE = """Plan 2-6 ad campaigns for {brand}.

## Data
Brand: {brand} | Tone: {tone} | Tagline: {tagline}
Market: {market} | Currency: {currency} | Scale: {business_scale} | Industry: {category}
Page: {page_type} | Product price: {product_price_info}
Trust: {social_proof}
Offers: {offers}
{products_detail}
{audiences_detail}
{marketing_brief}

## Platforms (ONLY use these)
{platform_capabilities}

## Rules
- Each (platform, campaign_type) pair ONCE — no duplicates
- target_audience = exact persona_name from above
- target_products = 1-3 product names from above
- key_message = unique per campaign, incorporate offers/trust signals
- ad_tone: SEARCH→"direct", DISPLAY→"aspirational", PMAX→"versatile"
- Budget in {currency}, daily, proportional to campaign value
{date_rule}
{user_constraints}"""

    @classmethod
    def _format_capabilities(cls, connected_platforms=None) -> str:
        from src.agentic_platform.app.campaigns.platform_matrix import PlatformCapabilityMatrix
        capabilities = PlatformCapabilityMatrix.to_full_capability_dict()
        if connected_platforms is not None:
            allowed = {p.platform.upper() for p in connected_platforms if p.account_id}
            capabilities = {k: v for k, v in capabilities.items() if k.upper() in allowed}
        lines = []
        for platform, campaign_types in capabilities.items():
            for ct, info in campaign_types.items():
                if info.get("templates"):
                    lines.append(f"{platform.upper()} {ct.upper()}")
        return "\n".join(lines) if lines else "No platforms"

    @classmethod
    def _extract_product_price(cls, analysis) -> str:
        sp = analysis.shopify_product
        if sp and hasattr(sp, "price") and sp.price:
            cur = getattr(sp, "currency", "USD") or "USD"
            s = f"{cur} {sp.price}"
            if sp.discount_percentage:
                s += f" ({sp.discount_percentage}% OFF)"
            return s
        for p in analysis.products:
            if p.price_range:
                return p.price_range
        return "Unknown"

    @classmethod
    def build(
        cls, analysis, currency: str, connected_platforms=None,
        total_budget: float = 0, start_date: str = "", end_date: str = "",
        campaign_types: list[str] | None = None, goal: str = "",
        fixed_campaigns: list[tuple[str, str]] | None = None,
        ad_tone_override: str = "",
        messaging_pillars: list[str] | None = None,
        avoid_themes: list[str] | None = None,
    ) -> str:
        brand = analysis.brand
        today = _date.today().isoformat()
        category = analysis.products[0].category if analysis.products else "General"

        # Products summary (concise)
        products_lines = []
        for p in analysis.products[:4]:
            price = f" {p.price_range}" if p.price_range else ""
            products_lines.append(f"- {p.name} ({p.category}{price})")
        products_detail = "Products:\n" + "\n".join(products_lines) if products_lines else "Products: none found"

        # Audiences summary (concise)
        audience_lines = []
        for a in analysis.audience[:4]:
            audience_lines.append(f'- "{a.persona_name}" ({a.gender.value}, {a.demographics.age}, {a.demographics.location[:60]})')
        audiences_detail = "Audiences:\n" + "\n".join(audience_lines) if audience_lines else "Audiences: none found"

        # Marketing brief (competitors + trends as text)
        brief = analysis.marketing_brief or ""
        if brand.competitor_edges:
            brief += "\nCompetitive edges: " + "; ".join(brand.competitor_edges[:4])

        # Date rule
        if start_date and end_date:
            date_rule = f"- Campaign period: {start_date} to {end_date}"
        else:
            date_rule = f"- Dates from {today}, 30-day duration"

        # User constraints
        constraints = []
        if total_budget:
            constraints.append(
                f"- TOTAL DAILY BUDGET: {currency} {total_budget}/day — the sum of all campaign daily_budget values MUST equal exactly {total_budget}. "
                f"Distribute proportionally by campaign value (e.g. PMAX>Display>Search for awareness; Search>PMAX for direct response)."
            )
        if fixed_campaigns:
            combo_list = ", ".join(f"{p} {ct}" for p, ct in fixed_campaigns)
            constraints.append(
                f"- MANDATORY: Create EXACTLY these campaigns (no more, no less): {combo_list}\n"
                f"  You MUST output exactly {len(fixed_campaigns)} campaigns matching these platform/type combos."
            )
        elif campaign_types:
            constraints.append(f"- ONLY use these campaign types: {', '.join(campaign_types)}")
        if goal:
            constraints.append(f"- Campaign goal: {goal}")
        if ad_tone_override:
            constraints.append(f"- Ad tone for ALL campaigns: {ad_tone_override}")
        if messaging_pillars:
            constraints.append(f"- Key messaging pillars to emphasize: {', '.join(messaging_pillars)}")
        if avoid_themes:
            constraints.append(f"- DO NOT use these themes in messaging: {', '.join(avoid_themes)}")
        user_constraints = "\n".join(constraints)

        return cls.TEMPLATE.format(
            brand=brand.name,
            tone=brand.tone_of_voice or "professional",
            tagline=brand.tagline or "-",
            market=analysis.business_context.market,
            currency=currency,
            business_scale=analysis.business_context.business_scale,
            category=category,
            page_type=analysis.page_type.upper(),
            product_price_info=cls._extract_product_price(analysis),
            social_proof=", ".join(brand.social_proof[:3]) or "-",
            offers=", ".join(brand.offers_and_promotions[:3]) or "-",
            products_detail=products_detail,
            audiences_detail=audiences_detail,
            marketing_brief=brief,
            platform_capabilities=cls._format_capabilities(connected_platforms),
            date_rule=date_rule,
            user_constraints=user_constraints,
        )
