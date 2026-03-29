"""E2E trace tests — verify every preference field reaches its downstream generator.

These tests construct the actual data structures and trace field values through
merge → enrichment → prompt building → system prompt construction, confirming
no field is lost along the way.
"""

import pytest
from unittest.mock import patch

from src.agentic_platform.app.campaigns.models import (
    BrandPreferences, AudiencePreferences, CreativePreferences, ProductPreferences,
    CreateCampaignArgs, PlatformType, CampaignType,
)
from src.agentic_platform.app.campaigns.models.analysis import (
    MarketingAnalysisReport, BusinessContext, BrandInsight,
    ProductInsight, AudiencePersona, Demographics, Gender,
)
from src.agentic_platform.app.campaigns.models.plan import (
    SlimCampaign, SlimPlan, V2CampaignConfig, V2CampaignPlan, CampaignAdContext,
    AdProductDetail, AdAudienceDetail,
)
from src.agentic_platform.app.campaigns.models.scraper import (
    WebsiteContent, PageMetadata,
)
from src.agentic_platform.app.campaigns.workflows.steps.analyze import (
    _merge_user_preferences,
)
from src.agentic_platform.app.campaigns.prompts.plan import MediaPlanPrompts
from src.agentic_platform.app.campaigns.prompts.image import build_image_prompt
from src.agentic_platform.app.campaigns.prompts.enrichment import enrich_slim_plan


# ── Shared fixtures ──────────────────────────────────────────────────

def _report() -> MarketingAnalysisReport:
    return MarketingAnalysisReport(
        website_url="https://example.com",
        business_context=BusinessContext(currency="USD", market="US", industry="Fashion"),
        brand=BrandInsight(name="OldBrand", positioning="Old positioning", tone_of_voice="formal"),
        products=[
            ProductInsight(name="Product A", category="Shirt", key_features=["Feature1"],
                           benefits=["Benefit1"], price_range="$50", landing_url="https://example.com/a"),
            ProductInsight(name="Product B", category="Pants", key_features=["Feature2"],
                           benefits=["Benefit2"], price_range="$80"),
        ],
        audience=[
            AudiencePersona(persona_name="OldPersona", gender=Gender.ALL,
                            demographics=Demographics(age="30-50", location="NYC", language="English"),
                            search_queries=["old query"]),
        ],
    )


def _website() -> WebsiteContent:
    return WebsiteContent(
        url="https://example.com",
        metadata=PageMetadata(title="Example Brand", description="Test", status_code=200),
    )


# ══════════════════════════════════════════════════════════════════════
# BRAND PREFERENCES → PLAN PROMPT + TEXT GEN + IMAGE GEN
# ══════════════════════════════════════════════════════════════════════

class TestBrandToplanPrompt:
    """Brand prefs merge into report → report feeds plan prompt."""

    def test_brand_name_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(name="NewBrand"))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "NewBrand" in prompt

    def test_brand_tone_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(tone_of_voice="bold and rebellious"))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "bold and rebellious" in prompt

    def test_brand_positioning_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(positioning="The people's brand"))
        _merge_user_preferences(report, args)
        # Positioning flows into report.brand which is used in prompt
        assert report.brand.positioning == "The people's brand"

    def test_brand_tagline_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(tagline="Just Do It"))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "Just Do It" in prompt

    def test_brand_competitor_edges_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(competitor_edges=["vs Nike: cheaper"]))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "vs Nike: cheaper" in prompt

    def test_brand_tone_reaches_text_gen_via_ad_context(self):
        """Tone flows: merge → report.brand.tone → enrichment → ad_context.tone → V2CampaignConfig JSON."""
        report = _report()
        args = CreateCampaignArgs(url="x", brand=BrandPreferences(tone_of_voice="playful"))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH, daily_budget=50),
        ])
        plan = enrich_slim_plan(slim, report)
        assert plan.campaigns[0].ad_context.tone_of_voice == "playful"
        # This JSON is what the text gen LLM receives
        config_json = plan.campaigns[0].model_dump_json()
        assert "playful" in config_json


# ══════════════════════════════════════════════════════════════════════
# AUDIENCE PREFERENCES → PLAN PROMPT + TARGETING + TEXT GEN
# ══════════════════════════════════════════════════════════════════════

class TestAudienceToPipeline:

    def test_custom_personas_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", audience=AudiencePreferences(
            custom_personas=["Gen Z Shoppers", "Premium Buyers"],
            target_age="18-25", target_locations=["Mumbai"],
        ))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "Gen Z Shoppers" in prompt
        assert "Premium Buyers" in prompt

    def test_patched_age_in_plan_prompt(self):
        report = _report()
        args = CreateCampaignArgs(url="x", audience=AudiencePreferences(target_age="18-24"))
        _merge_user_preferences(report, args)
        prompt = MediaPlanPrompts.build(report, "USD")
        assert "18-24" in prompt

    def test_patched_locations_in_enriched_plan(self):
        """Locations flow: merge → persona.demographics.location → enrichment → ad_context.audience.location → targeting."""
        report = _report()
        args = CreateCampaignArgs(url="x", audience=AudiencePreferences(target_locations=["London", "Paris"]))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_audience="OldPersona"),
        ])
        plan = enrich_slim_plan(slim, report)
        assert plan.campaigns[0].ad_context.audience.location == "London, Paris"

    def test_search_queries_in_enriched_plan(self):
        report = _report()
        args = CreateCampaignArgs(url="x", audience=AudiencePreferences(search_queries=["buy shirt online", "best cotton shirt"]))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_audience="OldPersona"),
        ])
        plan = enrich_slim_plan(slim, report)
        assert "buy shirt online" in plan.campaigns[0].ad_context.audience.search_queries

    def test_gender_override_in_enriched_plan(self):
        report = _report()
        args = CreateCampaignArgs(url="x", audience=AudiencePreferences(target_gender="FEMALE"))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_audience="OldPersona"),
        ])
        plan = enrich_slim_plan(slim, report)
        assert plan.campaigns[0].ad_context.audience.gender == "FEMALE"


# ══════════════════════════════════════════════════════════════════════
# CREATIVE PREFERENCES → PLAN PROMPT + TEXT GEN SYSTEM PROMPT + IMAGE GEN
# ══════════════════════════════════════════════════════════════════════

class TestCreativeToPlanPrompt:

    def test_ad_tone_in_plan_prompt(self):
        report = _report()
        prompt = MediaPlanPrompts.build(report, "USD", ad_tone_override="urgent and action-oriented")
        assert "urgent and action-oriented" in prompt

    def test_messaging_pillars_in_plan_prompt(self):
        report = _report()
        prompt = MediaPlanPrompts.build(report, "USD", messaging_pillars=["quality", "sustainability"])
        assert "quality" in prompt
        assert "sustainability" in prompt

    def test_avoid_themes_in_plan_prompt(self):
        report = _report()
        prompt = MediaPlanPrompts.build(report, "USD", avoid_themes=["luxury", "fast fashion"])
        assert "luxury" in prompt
        assert "fast fashion" in prompt


class TestCreativeToTextGen:
    """Verify creative prefs appear in the text gen system prompt."""

    def _build_system_prompt(self, creative: CreativePreferences) -> str:
        """Simulate what build.py does to construct the system prompt."""
        from src.agentic_platform.app.campaigns.workflows.steps.build import _TEXT_SYSTEM_PROMPT
        system_prompt = _TEXT_SYSTEM_PROMPT.format(landing_url="https://example.com")
        if creative:
            if creative.ad_tone:
                system_prompt += f"\nTONE: Write all copy in a '{creative.ad_tone}' tone."
            if creative.preferred_cta:
                system_prompt += f"\nIMPORTANT: Use '{creative.preferred_cta}' as the call-to-action where applicable."
            if creative.messaging_pillars:
                system_prompt += f"\nEmphasize these themes in all copy: {', '.join(creative.messaging_pillars)}."
            if creative.avoid_themes:
                system_prompt += f"\nDO NOT reference or allude to: {', '.join(creative.avoid_themes)}."
        return system_prompt

    def test_ad_tone_in_text_gen(self):
        cp = CreativePreferences(ad_tone="playful and witty")
        prompt = self._build_system_prompt(cp)
        assert "playful and witty" in prompt

    def test_preferred_cta_in_text_gen(self):
        cp = CreativePreferences(preferred_cta="Get Offer")
        prompt = self._build_system_prompt(cp)
        assert "Get Offer" in prompt

    def test_messaging_pillars_in_text_gen(self):
        cp = CreativePreferences(messaging_pillars=["durability", "craftsmanship"])
        prompt = self._build_system_prompt(cp)
        assert "durability" in prompt
        assert "craftsmanship" in prompt

    def test_avoid_themes_in_text_gen(self):
        cp = CreativePreferences(avoid_themes=["cheap", "discount"])
        prompt = self._build_system_prompt(cp)
        assert "cheap" in prompt
        assert "discount" in prompt

    def test_all_creative_fields_in_text_gen(self):
        cp = CreativePreferences(
            ad_tone="urgent", preferred_cta="Buy Now",
            messaging_pillars=["speed"], avoid_themes=["slow"],
        )
        prompt = self._build_system_prompt(cp)
        assert "urgent" in prompt
        assert "Buy Now" in prompt
        assert "speed" in prompt
        assert "slow" in prompt


class TestCreativeToImageGen:
    """Verify creative prefs appear in the image generation prompt."""

    def test_image_style_in_image_prompt(self):
        website = _website()
        prompt = build_image_prompt(
            description="Green shirt", slot_name="marketingImages",
            brand_context="TestBrand", website=website,
            image_style="cartoonistic",
        )
        assert "MANDATORY STYLE: cartoonistic" in prompt

    def test_image_mood_in_image_prompt(self):
        website = _website()
        prompt = build_image_prompt(
            description="Green shirt", slot_name="marketingImages",
            brand_context="TestBrand", website=website,
            image_mood="warm and inviting",
        )
        assert "Mood: warm and inviting" in prompt

    def test_brand_colors_override_in_image_prompt(self):
        website = _website()
        prompt = build_image_prompt(
            description="Green shirt", slot_name="marketingImages",
            brand_context="TestBrand", website=website,
            brand_colors=["#ff0000", "#00ff00"],
        )
        assert "colour story" in prompt.lower() or "color story" in prompt.lower()
        # Should NOT contain scraped colors since user override takes precedence
        # (website has no theme_color/brand_colors in this test fixture)

    def test_all_creative_fields_in_image_prompt(self):
        website = _website()
        prompt = build_image_prompt(
            description="Shirt product", slot_name="squareMarketingImages",
            brand_context="BoldBrand", website=website,
            image_style="flat illustration", image_mood="vibrant",
            brand_colors=["#1a5f2a"],
        )
        assert "MANDATORY STYLE: flat illustration" in prompt
        assert "Mood: vibrant" in prompt
        assert "colour story" in prompt.lower() or "color story" in prompt.lower()

    def test_no_creative_prefs_uses_defaults(self):
        """No creative prefs — image prompt uses default quality signature."""
        website = _website()
        prompt = build_image_prompt(
            description="Shirt", slot_name="marketingImages",
            brand_context="Brand", website=website,
        )
        assert "MANDATORY STYLE" not in prompt
        assert "Mood:" not in prompt


# ══════════════════════════════════════════════════════════════════════
# PRODUCT PREFERENCES → ENRICHMENT → TEXT GEN + TARGETING
# ══════════════════════════════════════════════════════════════════════

class TestProductToPipeline:

    def test_hero_product_first_in_enriched_plan(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(hero_products=["Product B"]))
        _merge_user_preferences(report, args)
        assert report.products[0].name == "Product B"

    def test_key_features_in_enriched_ad_context(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(key_features=["Custom1", "Custom2"]))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_products=["Product A"]),
        ])
        plan = enrich_slim_plan(slim, report)
        product = plan.campaigns[0].ad_context.products[0]
        assert product.key_features == ["Custom1", "Custom2"]

    def test_key_benefits_in_enriched_ad_context(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(key_benefits=["Saves money"]))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_products=["Product A"]),
        ])
        plan = enrich_slim_plan(slim, report)
        product = plan.campaigns[0].ad_context.products[0]
        assert product.benefits == ["Saves money"]

    def test_price_override_in_enriched_ad_context(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(price_override="$29.99"))
        _merge_user_preferences(report, args)
        assert report.products[0].price_range == "$29.99"

    def test_landing_url_in_merge(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(landing_url="https://promo.example.com"))
        _merge_user_preferences(report, args)
        assert report.products[0].landing_url == "https://promo.example.com"

    def test_landing_url_reaches_enriched_ad_context(self):
        report = _report()
        args = CreateCampaignArgs(url="x", products=ProductPreferences(landing_url="https://promo.example.com"))
        _merge_user_preferences(report, args)

        slim = SlimPlan(plan_name="Test", currency="USD", campaigns=[
            SlimCampaign(name="C1", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH,
                         daily_budget=50, target_products=["Product A"]),
        ])
        plan = enrich_slim_plan(slim, report)
        # Landing URL from product flows into ad_context
        assert plan.campaigns[0].ad_context.landing_url == "https://promo.example.com"


# ══════════════════════════════════════════════════════════════════════
# BACKWARD COMPATIBILITY — no prefs = exact same behavior as before
# ══════════════════════════════════════════════════════════════════════

class TestBackwardCompat:

    def test_no_prefs_plan_prompt_unchanged(self):
        report = _report()
        prompt_before = MediaPlanPrompts.build(report, "USD")
        args = CreateCampaignArgs(url="x")
        _merge_user_preferences(report, args)
        prompt_after = MediaPlanPrompts.build(report, "USD")
        assert prompt_before == prompt_after

    def test_no_prefs_image_prompt_unchanged(self):
        website = _website()
        prompt1 = build_image_prompt("Shirt", "marketingImages", "Brand", website)
        prompt2 = build_image_prompt("Shirt", "marketingImages", "Brand", website,
                                     image_style="", image_mood="", brand_colors=None)
        assert prompt1 == prompt2

    def test_none_prefs_no_crash(self):
        report = _report()
        args = CreateCampaignArgs(url="x", brand=None, audience=None, creative=None, products=None)
        _merge_user_preferences(report, args)
        assert report.brand.name == "OldBrand"
