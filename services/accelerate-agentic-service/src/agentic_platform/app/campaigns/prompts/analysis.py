"""Analysis prompts — 4 parallel agents (merged from 6).

Business+Trends, Brand+Competitors, Products, Audience.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.agentic_platform.app.campaigns.models import WebsiteContent


class AnalysisPrompts:
    """Prompts for the 4-agent parallel marketing analysis."""

    MAX_CONTEXT_LENGTH = 4000  # trimmed from 6000

    @staticmethod
    def ctx(content: "WebsiteContent", max_len: int = 4000) -> str:
        meta = content.metadata
        header = f"URL: {content.url}\nTitle: {meta.title}"
        if meta.page_type != "homepage":
            header += f"\nPage Type: {meta.page_type.upper()} PAGE"
        if meta.description:
            header += f"\nMeta Description: {meta.description}"

        shopify_section = ""
        sp = content.shopify_product
        if sp:
            shopify_section = "\n\n## STRUCTURED PRODUCT DATA (from Shopify API — use these EXACT values)\n"
            shopify_section += f"Product: {sp.title}\n"
            shopify_section += f"Price: {sp.price} {sp.currency}"
            if sp.compare_at_price and sp.compare_at_price.strip():
                shopify_section += f" (was {sp.compare_at_price} {sp.currency})"
            if sp.discount_percentage:
                shopify_section += f" — {sp.discount_percentage}% OFF"
            shopify_section += "\n"
            shopify_section += f"Vendor: {sp.vendor}\n"
            shopify_section += f"Product Type: {sp.product_type}\n"
            if sp.variants and len(sp.variants) > 1:
                variant_titles = [v.title for v in sp.variants[:10]]
                shopify_section += f"Variants ({len(sp.variants)}): {', '.join(variant_titles)}\n"
            if sp.options:
                for opt in sp.options:
                    name = opt.get("name", "")
                    values = opt.get("values", [])
                    if name and name != "Title":
                        shopify_section += f"Option '{name}': {', '.join(str(v) for v in values)}\n"
            if sp.offer_tags:
                shopify_section += f"Offer Tags: {', '.join(sp.offer_tags)}\n"
            if sp.tags:
                shopify_section += f"All Tags: {', '.join(sp.tags[:15])}\n"
            shopify_section += f"Images: {len(sp.images)} product images available\n"
            shopify_section += f"Product URL: {sp.product_url}\n"

        return f"{header}{shopify_section}\n\n{content.markdown[:max_len]}"

    @staticmethod
    def page_type_instruction(content: "WebsiteContent") -> str:
        pt = content.metadata.page_type
        if pt == "product":
            return (
                "\n\nIMPORTANT: This is a SINGLE PRODUCT PAGE. "
                "Focus on this specific product as the primary offering. "
                "Extract its exact name, price, features, and unique selling points. "
                "Treat other products visible on the page as secondary/related items."
            )
        if pt == "category":
            return (
                "\n\nIMPORTANT: This is a CATEGORY/COLLECTION PAGE. "
                "Focus on the specific category being shown. "
                "Extract product variety, price ranges, and category positioning."
            )
        return ""

    # Agent 1: Business Context + Trends (merged)
    BUSINESS = """Analyze this website. Determine:
- Currency (from price symbols ₹/$€£), primary market country
- Business scale: small (startup/local), medium (regional), or large (national+)
- Industry vertical
- key_trends: comma-separated trend names (legacy, keep short)
- trends: 3-5 structured trends, each with:
  - name: trend name
  - relevance: "High", "Medium", or "Low"
  - action: one concrete action the brand should take to capitalize on this trend

Website:
{c}"""

    # Agent 2: Brand + Competitors (merged)
    BRAND = """Extract brand insights and competitive positioning from this website.
{page_type_hint}
Brand: name, positioning (1 sentence), value proposition, tone of voice, tagline if visible.
Trust signals: exact numbers (ratings, store count, years in business).
Current offers/promotions visible on the page.
Competitors: identify 3-5 REAL competitor brands (actual company/brand names, not generic categories).
For each competitor, provide:
- name: the actual brand name (e.g. "Nike", "Craftsvilla", not "Fast Fashion Brands")
- threat_level: "High", "Medium", or "Low" based on market overlap
- differentiation: one sentence on how THIS brand beats them
Also provide competitor_edges as "vs CompetitorName: advantage" strings for backward compat.

Website:
{c}"""

    # Agent 3: Products
    PRODUCTS = """Extract products/services from this website for ad campaigns.
{page_type_hint}
For each product/category: name, category, price range if visible, pricing tier (budget/mid/premium), key features (2-3), benefits (2-3), what makes it unique, hero product if highlighted.

Website:
{c}"""

    # Agent 4: Audience
    AUDIENCE = """Build 2-4 target personas for advertising this website's products.
{page_type_hint}
For each persona:
- persona_name: descriptive name (e.g. "Shiva Devotee Home-Pooja Buyer")
- gender (MALE/FEMALE/ALL), age range, locations (comma-separated major cities), language
- pain_points: 2-3 specific frustrations this persona has when shopping for this type of product
- motivations: 2-3 emotional/practical reasons they'd buy
- search_queries: 3-5 exact queries they'd type into Google
- ad_hooks: 2-3 short punchy ad headlines/hooks that would grab this persona's attention

Website:
{c}"""
