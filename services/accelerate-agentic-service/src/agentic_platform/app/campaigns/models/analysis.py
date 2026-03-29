"""Analysis models (optimized — no field descriptions, relaxed constraints).

Field descriptions are removed to shrink the instructor JSON Schema sent to the LLM.
The prompts already tell the LLM what to produce.
"""

from typing import List, Optional

from pydantic import BaseModel, Field

from .enums import Gender
from .scraper import ShopifyProductData


class Demographics(BaseModel):
    age: str
    location: str  # comma-separated cities/countries
    language: str = "English"


class Competitor(BaseModel):
    name: str
    threat_level: str = "Medium"  # High, Medium, Low
    differentiation: str = ""  # how WE beat them

class BrandInsight(BaseModel):
    name: str
    positioning: str
    value_proposition: str = ""
    tone_of_voice: str = ""
    tagline: Optional[str] = None
    social_proof: List[str] = Field(default_factory=list)
    offers_and_promotions: List[str] = Field(default_factory=list)
    competitor_edges: List[str] = Field(default_factory=list)  # legacy — kept for compat
    competitors: List[Competitor] = Field(default_factory=list)


class Trend(BaseModel):
    name: str
    relevance: str = "High"  # High, Medium, Low
    action: str = ""  # what to do about it

class BusinessContext(BaseModel):
    currency: str
    market: str
    business_scale: str = "medium"
    industry: str = ""
    key_trends: str = ""  # comma-separated (legacy)
    trends: List[Trend] = Field(default_factory=list)


class ProductInsight(BaseModel):
    name: str
    category: str = ""
    key_features: List[str] = Field(default_factory=list)
    benefits: List[str] = Field(default_factory=list)
    pricing_signal: str = ""
    price_range: Optional[str] = None
    landing_url: Optional[str] = None
    hero_product: Optional[str] = None
    differentiation: str = ""


class AudiencePersona(BaseModel):
    persona_name: str
    gender: Gender = Gender.ALL
    demographics: Demographics
    pain_points: List[str] = Field(default_factory=list)
    motivations: List[str] = Field(default_factory=list)
    search_queries: List[str] = Field(default_factory=list)
    ad_hooks: List[str] = Field(default_factory=list)


# Wrapper models for parallel LLM calls
class BrandAnalysisResult(BaseModel):
    brand: BrandInsight

class ProductAnalysisResult(BaseModel):
    products: List[ProductInsight] = Field(default_factory=list)

class AudienceAnalysisResult(BaseModel):
    audience: List[AudiencePersona] = Field(default_factory=list)


class MarketingAnalysisReport(BaseModel):
    """Output of the analysis step — feeds into the planner."""
    website_url: str
    scan_date: str = ""
    business_context: BusinessContext
    brand: BrandInsight
    products: List[ProductInsight] = Field(default_factory=list)
    audience: List[AudiencePersona] = Field(default_factory=list)
    marketing_brief: str = ""  # free-text: competitors, trends, campaign implications

    # Visual identity (from scraper, not LLM)
    brand_colors: List[str] = Field(default_factory=list)
    theme_color: Optional[str] = None
    og_image: Optional[str] = None
    favicon_url: Optional[str] = None
    page_type: str = "homepage"
    shopify_product: Optional[ShopifyProductData] = None
