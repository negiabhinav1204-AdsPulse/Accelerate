"""Slim plan models (LLM output) and enriched campaign models (post-LLM, for build + save)."""

from typing import List, Optional

from pydantic import BaseModel, Field

from .enums import CampaignType, PlatformType, TemplateType


# ── Slim plan models (LLM output — minimal fields) ──────────────

class SlimCampaign(BaseModel):
    """Minimal campaign config — what the LLM decides. template_type derived in code."""
    name: str
    platform: PlatformType
    campaign_type: CampaignType
    daily_budget: float
    target_audience: str = ""
    target_products: List[str] = Field(default_factory=list)
    key_message: str = ""
    ad_tone: str = "versatile"


class SlimPlan(BaseModel):
    """Lightweight media plan — LLM output. No assumptions, no summaries."""
    plan_name: str = Field(..., description="Short name: brand + product + goal. Max 6 words. No dates, no 'Media Plan', no URLs.")
    currency: str = "USD"
    campaigns: List[SlimCampaign] = Field(..., min_length=1, max_length=6)


# ── Enriched campaign models (post-LLM, for build + save) ───────

class AdProductDetail(BaseModel):
    name: str
    category: str = ""
    price_range: Optional[str] = None
    key_features: List[str] = Field(default_factory=list)
    benefits: List[str] = Field(default_factory=list)
    differentiation: str = ""
    exact_price: Optional[str] = None
    discount_percentage: Optional[float] = None
    currency: Optional[str] = None


class AdAudienceDetail(BaseModel):
    persona_name: str
    gender: str = "ALL"
    age_range: str = ""
    location: str = ""
    language: str = "English"
    search_queries: List[str] = Field(default_factory=list)


class CampaignAdContext(BaseModel):
    """Resolved context for text gen + targeting. Built by enrich, not LLM."""
    brand_name: str
    tone_of_voice: str = ""
    tagline: Optional[str] = None
    landing_url: str = ""
    products: List[AdProductDetail] = Field(default_factory=list)
    audience: Optional[AdAudienceDetail] = None
    social_proof: List[str] = Field(default_factory=list)
    offers: List[str] = Field(default_factory=list)
    competitor_edges: List[str] = Field(default_factory=list)


class V2CampaignConfig(BaseModel):
    """Full campaign config — assembled in code from SlimCampaign + enrichment."""
    name: str
    platform: PlatformType
    campaign_type: CampaignType
    template_type: TemplateType
    daily_budget: float = 0
    budget_currency: str = "USD"
    start_date: str = ""
    end_date: str = ""
    target_audience: str = ""
    target_products: List[str] = Field(default_factory=list)
    key_message: str = ""
    ad_tone: str = "versatile"
    ad_context: Optional[CampaignAdContext] = None


class V2CampaignPlan(BaseModel):
    """Full plan — assembled in code from SlimPlan + enrichment."""
    plan_name: str
    currency: str = "USD"
    campaigns: List[V2CampaignConfig] = Field(default_factory=list)


# Keep for backward compat (imported by other modules)
class AgentSummary(BaseModel):
    agent_name: str = ""
    display_name: str = ""
    summary: str = ""
    key_findings: List[str] = Field(default_factory=list)

class CompetitorInsight(BaseModel):
    name: str = ""
    differentiator_against: str = ""

class MarketTrend(BaseModel):
    trend_name: str = ""
