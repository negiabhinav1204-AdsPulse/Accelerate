"""Campaign strategy models (LLM output)."""

from typing import List

from pydantic import BaseModel, Field, model_validator


class ImageSpec(BaseModel):
    """Image to generate for a campaign."""
    description: str = Field(..., description="What the image should depict")
    slot_name: str = Field(..., description="Image slot: marketingImages, squareMarketingImages, portraitMarketingImages, images")
    aspect_ratio: str = Field(..., description="Target aspect ratio: 1.91:1, 1:1, 4:5")


class CampaignIntent(BaseModel):
    """One campaign in the strategy — output from the strategy LLM call.

    All enum-like fields (platform, campaign_type, template_type) are
    normalized to UPPERCASE on construction so LLM output like "search"
    or "google" is automatically corrected.
    """
    name: str
    platform: str  # "GOOGLE" | "BING"
    campaign_type: str  # "SEARCH" | "DISPLAY" | "PERFORMANCE_MAX"
    template_type: str  # TemplateType value
    daily_budget: float
    final_url: str
    target_countries: list[str] = Field(default_factory=list)
    target_languages: list[str] = Field(default_factory=list)
    target_age_ranges: list[str] = Field(default_factory=list)
    target_genders: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    image_specs: list[ImageSpec] = Field(default_factory=list)

    @model_validator(mode="after")
    def _normalize_enums(self) -> "CampaignIntent":
        self.platform = self.platform.upper()
        self.campaign_type = self.campaign_type.upper().replace(" ", "_")
        self.template_type = self.template_type.upper().replace(" ", "_")
        return self


class CampaignStrategy(BaseModel):
    """Full strategy output from the single planning LLM call."""
    plan_name: str = Field(..., description="Short name: brand + product + goal. Max 6 words. No dates, no 'Media Plan', no URLs.")
    strategy_summary: str
    brand_context: str  # extracted brand voice/positioning for text gen
    currency: str = "USD"
    campaigns: list[CampaignIntent]
