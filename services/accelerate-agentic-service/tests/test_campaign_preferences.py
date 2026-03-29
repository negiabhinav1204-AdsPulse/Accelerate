"""Tests for campaign preference inputs — BrandPreferences, AudiencePreferences,
CreativePreferences, ProductPreferences, and their merge into the analysis pipeline."""

import pytest

from src.agentic_platform.app.campaigns.models import (
    BrandPreferences,
    AudiencePreferences,
    CreativePreferences,
    ProductPreferences,
    CreateMediaPlanInput,
    CreateCampaignArgs,
    PlatformType,
    CampaignType,
)
from src.agentic_platform.app.campaigns.models.analysis import (
    MarketingAnalysisReport,
    BusinessContext,
    BrandInsight,
    ProductInsight,
    AudiencePersona,
    Demographics,
    Gender,
)
from src.agentic_platform.app.campaigns.workflows.steps.analyze import (
    _merge_user_preferences,
)


# ── Fixtures ─────────────────────────────────────────────────────────

def _make_report() -> MarketingAnalysisReport:
    """Create a realistic AI-generated report for testing overrides."""
    return MarketingAnalysisReport(
        website_url="https://www.andamen.com/products/shirt",
        scan_date="2026-03-21",
        business_context=BusinessContext(
            currency="INR", market="India",
            business_scale="medium", industry="Fashion",
            key_trends="Sustainable Fashion, Premium Casual",
        ),
        brand=BrandInsight(
            name="Andamen", positioning="Premium casual menswear",
            value_proposition="Quality cotton garments", tone_of_voice="Sophisticated",
            tagline="Dress for life", social_proof=["4.5 stars"],
            offers_and_promotions=["15% OFF"], competitor_edges=["vs Fast Fashion: durability"],
        ),
        products=[
            ProductInsight(
                name="Olive Oxford Shirt", category="Shirt",
                key_features=["100% Cotton", "Oxford weave"],
                benefits=["Durable", "Comfortable"],
                price_range="₹2,550 - ₹2,999",
                differentiation="Designed to soften with wear",
            ),
            ProductInsight(
                name="Navy Polo", category="Polo",
                key_features=["Pique knit"], benefits=["Versatile"],
                price_range="₹1,999",
            ),
        ],
        audience=[
            AudiencePersona(
                persona_name="Professional Minimalist", gender=Gender.MALE,
                demographics=Demographics(age="28-40", location="Mumbai, Delhi", language="English"),
                search_queries=["oxford shirt men", "premium cotton shirt"],
            ),
            AudiencePersona(
                persona_name="Casual Explorer", gender=Gender.ALL,
                demographics=Demographics(age="22-35", location="Bangalore, Pune", language="English"),
                search_queries=["trendy casual shirt", "comfortable shirt online"],
            ),
        ],
    )


def _make_args(**overrides) -> CreateCampaignArgs:
    """Create args with optional preference overrides."""
    base = {"url": "https://www.andamen.com/products/shirt"}
    base.update(overrides)
    return CreateCampaignArgs(**base)


# ── Model Tests ──────────────────────────────────────────────────────

class TestPreferenceModels:
    """Test preference Pydantic models instantiate and validate correctly."""

    def test_brand_preferences_defaults(self):
        bp = BrandPreferences()
        assert bp.name == ""
        assert bp.tone_of_voice == ""
        assert bp.competitor_edges == []

    def test_brand_preferences_partial(self):
        bp = BrandPreferences(name="Nike", tone_of_voice="bold")
        assert bp.name == "Nike"
        assert bp.positioning == ""  # unfilled stays empty

    def test_audience_preferences_defaults(self):
        ap = AudiencePreferences()
        assert ap.target_age == ""
        assert ap.target_locations == []
        assert ap.custom_personas == []

    def test_creative_preferences_all_fields(self):
        cp = CreativePreferences(
            ad_tone="direct", image_style="lifestyle",
            preferred_cta="Shop Now",
            messaging_pillars=["quality", "durability"],
            avoid_themes=["luxury"],
        )
        assert cp.ad_tone == "direct"
        assert len(cp.messaging_pillars) == 2
        assert cp.avoid_themes == ["luxury"]

    def test_product_preferences_defaults(self):
        pp = ProductPreferences()
        assert pp.hero_products == []
        assert pp.landing_url == ""


class TestCreateMediaPlanInput:
    """Test tool schema with preferences."""

    def test_no_preferences(self):
        inp = CreateMediaPlanInput(url="https://example.com")
        assert inp.brand is None
        assert inp.audience is None
        assert inp.creative is None
        assert inp.products is None

    def test_with_all_preferences(self):
        inp = CreateMediaPlanInput(
            url="https://example.com",
            brand=BrandPreferences(name="Test"),
            audience=AudiencePreferences(target_age="25-40"),
            creative=CreativePreferences(ad_tone="playful"),
            products=ProductPreferences(hero_products=["Widget"]),
        )
        assert inp.brand.name == "Test"
        assert inp.audience.target_age == "25-40"
        assert inp.creative.ad_tone == "playful"
        assert inp.products.hero_products == ["Widget"]

    def test_backward_compat_no_preferences(self):
        """Old-style call without preferences still works."""
        inp = CreateMediaPlanInput(
            url="https://example.com",
            platforms=[PlatformType.GOOGLE],
            campaign_types=[CampaignType.SEARCH],
            total_budget=1000,
        )
        assert inp.brand is None
        assert inp.total_budget == 1000


class TestCreateCampaignArgs:
    """Test trigger args parsing with preferences."""

    def test_from_ctx_args_no_preferences(self):
        args = CreateCampaignArgs.from_ctx_args({"url": "https://example.com"})
        assert args.brand is None
        assert args.creative is None

    def test_from_ctx_args_with_preferences(self):
        args = CreateCampaignArgs.from_ctx_args({
            "url": "https://example.com",
            "brand": {"name": "TestBrand", "tone_of_voice": "bold"},
            "audience": {"target_age": "18-30", "target_locations": ["NYC", "LA"]},
            "creative": {"ad_tone": "urgent", "messaging_pillars": ["speed", "value"]},
            "products": {"hero_products": ["Widget A"], "landing_url": "https://example.com/promo"},
        })
        assert args.brand.name == "TestBrand"
        assert args.brand.tone_of_voice == "bold"
        assert args.audience.target_age == "18-30"
        assert args.audience.target_locations == ["NYC", "LA"]
        assert args.creative.ad_tone == "urgent"
        assert args.creative.messaging_pillars == ["speed", "value"]
        assert args.products.hero_products == ["Widget A"]
        assert args.products.landing_url == "https://example.com/promo"

    def test_from_ctx_args_partial_preferences(self):
        """Only brand provided, rest None."""
        args = CreateCampaignArgs.from_ctx_args({
            "url": "https://example.com",
            "brand": {"tone_of_voice": "casual"},
        })
        assert args.brand.tone_of_voice == "casual"
        assert args.brand.name == ""  # unfilled
        assert args.audience is None
        assert args.creative is None


# ── Merge Tests ──────────────────────────────────────────────────────

class TestMergeUserPreferences:
    """Test _merge_user_preferences override logic."""

    # ── Brand overrides ──

    def test_brand_name_override(self):
        report = _make_report()
        args = _make_args(brand=BrandPreferences(name="Nike"))
        _merge_user_preferences(report, args)
        assert report.brand.name == "Nike"

    def test_brand_tone_override(self):
        report = _make_report()
        args = _make_args(brand=BrandPreferences(tone_of_voice="bold and adventurous"))
        _merge_user_preferences(report, args)
        assert report.brand.tone_of_voice == "bold and adventurous"
        # Other brand fields untouched
        assert report.brand.name == "Andamen"
        assert report.brand.positioning == "Premium casual menswear"

    def test_brand_positioning_override(self):
        report = _make_report()
        args = _make_args(brand=BrandPreferences(positioning="Budget menswear for all"))
        _merge_user_preferences(report, args)
        assert report.brand.positioning == "Budget menswear for all"

    def test_brand_tagline_override(self):
        report = _make_report()
        args = _make_args(brand=BrandPreferences(tagline="Just Do It"))
        _merge_user_preferences(report, args)
        assert report.brand.tagline == "Just Do It"

    def test_brand_competitor_edges_override(self):
        report = _make_report()
        args = _make_args(brand=BrandPreferences(competitor_edges=["vs Adidas: lighter", "vs Puma: cheaper"]))
        _merge_user_preferences(report, args)
        assert report.brand.competitor_edges == ["vs Adidas: lighter", "vs Puma: cheaper"]

    def test_brand_empty_fields_dont_override(self):
        """Empty strings/lists should NOT override AI values."""
        report = _make_report()
        args = _make_args(brand=BrandPreferences())  # all defaults (empty)
        _merge_user_preferences(report, args)
        assert report.brand.name == "Andamen"  # unchanged
        assert report.brand.tone_of_voice == "Sophisticated"  # unchanged

    def test_no_brand_preferences(self):
        report = _make_report()
        args = _make_args()  # brand=None
        _merge_user_preferences(report, args)
        assert report.brand.name == "Andamen"

    # ── Audience overrides ──

    def test_audience_patch_age(self):
        """Patching age on existing AI personas."""
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(target_age="18-25"))
        _merge_user_preferences(report, args)
        assert len(report.audience) == 2  # same personas, patched
        assert report.audience[0].demographics.age == "18-25"
        assert report.audience[1].demographics.age == "18-25"
        # Names unchanged
        assert report.audience[0].persona_name == "Professional Minimalist"

    def test_audience_patch_gender(self):
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(target_gender="FEMALE"))
        _merge_user_preferences(report, args)
        assert report.audience[0].gender == Gender.FEMALE
        assert report.audience[1].gender == Gender.FEMALE

    def test_audience_patch_locations(self):
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(target_locations=["NYC", "SF"]))
        _merge_user_preferences(report, args)
        assert report.audience[0].demographics.location == "NYC, SF"

    def test_audience_patch_search_queries(self):
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(search_queries=["custom query 1", "custom query 2"]))
        _merge_user_preferences(report, args)
        assert report.audience[0].search_queries == ["custom query 1", "custom query 2"]
        assert report.audience[1].search_queries == ["custom query 1", "custom query 2"]

    def test_audience_custom_personas_replace(self):
        """Custom personas completely replace AI personas."""
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(
            custom_personas=["College Students", "Young Professionals"],
            target_age="18-30", target_gender="ALL",
            target_locations=["Mumbai"], target_language="Hindi",
            search_queries=["affordable shirt"],
        ))
        _merge_user_preferences(report, args)
        assert len(report.audience) == 2
        assert report.audience[0].persona_name == "College Students"
        assert report.audience[1].persona_name == "Young Professionals"
        assert report.audience[0].demographics.age == "18-30"
        assert report.audience[0].demographics.location == "Mumbai"
        assert report.audience[0].demographics.language == "Hindi"
        assert report.audience[0].gender == Gender.ALL
        assert report.audience[0].search_queries == ["affordable shirt"]

    def test_audience_custom_personas_defaults(self):
        """Custom personas with minimal info use sensible defaults."""
        report = _make_report()
        args = _make_args(audience=AudiencePreferences(
            custom_personas=["Bargain Hunters"],
        ))
        _merge_user_preferences(report, args)
        assert len(report.audience) == 1
        assert report.audience[0].persona_name == "Bargain Hunters"
        assert report.audience[0].demographics.age == "18-65"  # default
        assert report.audience[0].demographics.language == "English"  # default
        assert report.audience[0].gender == Gender.ALL  # default

    def test_audience_empty_doesnt_override(self):
        report = _make_report()
        args = _make_args(audience=AudiencePreferences())  # all defaults
        _merge_user_preferences(report, args)
        assert report.audience[0].demographics.age == "28-40"  # unchanged

    # ── Product overrides ──

    def test_products_hero_reorder(self):
        report = _make_report()
        assert report.products[0].name == "Olive Oxford Shirt"
        args = _make_args(products=ProductPreferences(hero_products=["Navy Polo"]))
        _merge_user_preferences(report, args)
        assert report.products[0].name == "Navy Polo"
        assert report.products[1].name == "Olive Oxford Shirt"

    def test_products_features_override(self):
        report = _make_report()
        args = _make_args(products=ProductPreferences(key_features=["Wrinkle-free", "Machine washable"]))
        _merge_user_preferences(report, args)
        assert report.products[0].key_features == ["Wrinkle-free", "Machine washable"]
        # Second product unchanged
        assert report.products[1].key_features == ["Pique knit"]

    def test_products_benefits_override(self):
        report = _make_report()
        args = _make_args(products=ProductPreferences(key_benefits=["Saves time", "Looks great"]))
        _merge_user_preferences(report, args)
        assert report.products[0].benefits == ["Saves time", "Looks great"]

    def test_products_price_override(self):
        report = _make_report()
        args = _make_args(products=ProductPreferences(price_override="₹1,999"))
        _merge_user_preferences(report, args)
        assert report.products[0].price_range == "₹1,999"

    def test_products_no_products_in_report(self):
        """Product prefs with empty product list — no crash."""
        report = _make_report()
        report.products = []
        args = _make_args(products=ProductPreferences(key_features=["Test"]))
        _merge_user_preferences(report, args)  # should not crash
        assert report.products == []

    def test_products_hero_not_found(self):
        """Hero product name doesn't match any product — order unchanged."""
        report = _make_report()
        args = _make_args(products=ProductPreferences(hero_products=["Nonexistent Product"]))
        _merge_user_preferences(report, args)
        assert report.products[0].name == "Olive Oxford Shirt"  # unchanged

    # ── Combined overrides ──

    def test_all_preferences_combined(self):
        """Multiple preference groups applied together."""
        report = _make_report()
        args = _make_args(
            brand=BrandPreferences(name="TestBrand", tone_of_voice="playful"),
            audience=AudiencePreferences(target_age="20-30"),
            products=ProductPreferences(hero_products=["Navy Polo"], key_features=["Custom Feature"]),
        )
        _merge_user_preferences(report, args)
        assert report.brand.name == "TestBrand"
        assert report.brand.tone_of_voice == "playful"
        assert report.audience[0].demographics.age == "20-30"
        assert report.products[0].name == "Navy Polo"
        assert report.products[0].key_features == ["Custom Feature"]

    def test_no_preferences_no_changes(self):
        """No preferences at all — report unchanged."""
        report = _make_report()
        original_name = report.brand.name
        original_age = report.audience[0].demographics.age
        args = _make_args()
        _merge_user_preferences(report, args)
        assert report.brand.name == original_name
        assert report.audience[0].demographics.age == original_age


# ── Creative Preferences Flow Tests ──────────────────────────────────

class TestCreativePreferencesFlow:
    """Test that creative preferences are correctly structured for downstream use."""

    def test_creative_prefs_in_args(self):
        args = CreateCampaignArgs.from_ctx_args({
            "url": "https://example.com",
            "creative": {
                "ad_tone": "urgent",
                "preferred_cta": "Buy Now",
                "messaging_pillars": ["speed", "reliability"],
                "avoid_themes": ["cheap", "budget"],
            },
        })
        assert args.creative.ad_tone == "urgent"
        assert args.creative.preferred_cta == "Buy Now"
        assert args.creative.messaging_pillars == ["speed", "reliability"]
        assert args.creative.avoid_themes == ["cheap", "budget"]

    def test_creative_none_by_default(self):
        args = CreateCampaignArgs.from_ctx_args({"url": "https://example.com"})
        assert args.creative is None

    def test_creative_partial(self):
        """Only some creative fields provided."""
        args = CreateCampaignArgs.from_ctx_args({
            "url": "https://example.com",
            "creative": {"preferred_cta": "Learn More"},
        })
        assert args.creative.preferred_cta == "Learn More"
        assert args.creative.ad_tone == ""
        assert args.creative.messaging_pillars == []
