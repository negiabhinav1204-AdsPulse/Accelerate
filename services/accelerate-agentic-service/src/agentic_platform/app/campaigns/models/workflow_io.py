"""Pydantic models for data flowing between campaign workflow steps.

These replace plain dicts and loose ctx.args.get() calls with validated,
typed models at every step boundary:

  trigger args  → CreateCampaignArgs  (also used as @tool args_schema via CreateMediaPlanInput)
  configure out → ConfigureStepData  (persisted) + CampaignConfigFormInput (HITL)
  plan out      → PlanStepData       (persisted)
  build out     → BuildStepData      (persisted) + BuiltCampaignAssets (per-campaign)
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from .context import CampaignContext
from .enums import PlatformType, CampaignType
from .plan import V2CampaignPlan
from .connections import ConnectedPlatform

logger = logging.getLogger(__name__)


# ── Optional preference inputs ────────────────────────────────────
# All fields optional — LLM fills what it can from the user's message.
# When provided, they override AI-generated analysis. When absent,
# the pipeline auto-detects everything as before.

class BrandPreferences(BaseModel):
    """Override AI-detected brand identity."""
    name: str = Field(default="", description="Brand name if different from what's on the website")
    tone_of_voice: str = Field(default="", description="Brand voice: 'bold and adventurous', 'professional and understated', etc.")
    positioning: str = Field(default="", description="One-sentence brand positioning statement")
    tagline: str = Field(default="", description="Brand tagline")
    competitor_edges: list[str] = Field(default_factory=list, description="Competitive advantages, e.g. 'vs Nike: more affordable'")

class AudiencePreferences(BaseModel):
    """Override or seed AI-generated audience targeting."""
    target_age: str = Field(default="", description="Age range, e.g. '25-40'")
    target_gender: str = Field(default="", description="MALE, FEMALE, or ALL")
    target_locations: list[str] = Field(default_factory=list, description="Target cities or countries")
    target_language: str = Field(default="", description="Primary language for ads")
    custom_personas: list[str] = Field(default_factory=list, description="Custom audience personas, e.g. 'Budget-conscious college students'")
    search_queries: list[str] = Field(default_factory=list, description="Keywords your customers search for")

class CreativePreferences(BaseModel):
    """Guide ad copy and image generation."""
    ad_tone: str = Field(default="", description="Ad copy tone: 'direct', 'aspirational', 'playful', 'urgent'")
    image_style: str = Field(default="", description="Image style: 'cartoonistic', 'photorealistic', 'lifestyle', 'editorial', 'minimal', 'flat illustration'")
    image_mood: str = Field(default="", description="Image mood: 'warm and inviting', 'cool and professional', 'vibrant and energetic', 'muted and elegant'")
    brand_colors: list[str] = Field(default_factory=list, description="Brand color palette as hex codes for images, e.g. ['#1a5f2a', '#f5f0e1']")
    preferred_cta: str = Field(default="", description="Preferred call-to-action: 'Shop Now', 'Learn More', 'Get Offer'")
    messaging_pillars: list[str] = Field(default_factory=list, description="Key themes to emphasize, e.g. 'quality', 'affordability'")
    avoid_themes: list[str] = Field(default_factory=list, description="Themes to avoid in messaging, e.g. 'luxury', 'fast fashion'")

class ProductPreferences(BaseModel):
    """Override or focus product selection."""
    hero_products: list[str] = Field(default_factory=list, description="Product names to prioritize in campaigns")
    key_features: list[str] = Field(default_factory=list, description="Product features to highlight in ads")
    key_benefits: list[str] = Field(default_factory=list, description="Customer benefits to emphasize")
    price_override: str = Field(default="", description="Override detected price, e.g. '₹2,550'")
    landing_url: str = Field(default="", description="Custom landing page URL for all campaigns")


# ── Tool input schema (args_schema for @tool) ────────────────────

class CreateMediaPlanInput(BaseModel):
    """Input schema for the create_media_plan tool.

    LangChain sends this schema to the LLM, which constrains it to only
    produce valid PlatformType/CampaignType enum values — no aliases or
    typo normalization needed.
    """
    url: str = Field(description="Website URL to create campaigns from")
    platform_selections: dict[PlatformType, list[CampaignType]] = Field(
        default_factory=dict,
        description="Per-platform campaign type selections. Maps each platform to its campaign types. "
                    "Examples: 'google pmax and bing search' → {GOOGLE: [PERFORMANCE_MAX], BING: [SEARCH]}. "
                    "'only google ads' → {GOOGLE: []}. "
                    "An empty list means all supported types for that platform. "
                    "Omit entirely (empty dict) to auto-detect from connected accounts.",
    )
    total_budget: float = Field(default=0, ge=0, description="Monthly budget in account currency. 0 means auto-detect")
    start_date: str = Field(default="", description="ISO format YYYY-MM-DD")
    end_date: str = Field(default="", description="ISO format YYYY-MM-DD")
    goal: str = Field(default="", description="Campaign objective, e.g. 'maximize ROAS', 'drive traffic'")
    brand: BrandPreferences | None = Field(default=None, description="Optional brand identity overrides")
    audience: AudiencePreferences | None = Field(default=None, description="Optional audience targeting preferences")
    creative: CreativePreferences | None = Field(default=None, description="Optional creative direction preferences")
    products: ProductPreferences | None = Field(default=None, description="Optional product focus and overrides")


# ── Trigger args ──────────────────────────────────────────────────

class CreateCampaignArgs(BaseModel):
    """Validated trigger arguments from ctx.args (LLM tool call).

    Platforms and campaign types are typed as enum lists — the LLM is
    constrained by the tool's args_schema to only produce valid values.
    """
    url: str = ""
    platform_selections: dict[PlatformType, list[CampaignType]] = Field(default_factory=dict)
    total_budget: float = Field(default=0, ge=0)
    start_date: str = ""
    end_date: str = ""
    goal: str = ""
    brand: BrandPreferences | None = None
    audience: AudiencePreferences | None = None
    creative: CreativePreferences | None = None
    products: ProductPreferences | None = None

    @classmethod
    def from_ctx_args(cls, args: dict[str, Any]) -> CreateCampaignArgs:
        return cls(**{k: args.get(k, v.default) for k, v in cls.model_fields.items()})


# ── HITL form: configure → plan ──────────────────────────────────

class CampaignConfigFormInput(BaseModel):
    """User's selections from the HITL campaign configuration form.

    Emitted by configure step as HITL form, consumed by plan step
    via configure_result.metadata["user_input"].
    """
    total_budget: float = 0
    start_date: str = ""
    end_date: str = ""
    platforms: list[str] = Field(default_factory=list)
    campaign_types: list[str] = Field(default_factory=list)
    platform_selections: dict[str, list[str]] = Field(default_factory=dict)
    goal: str = ""

    @model_validator(mode="before")
    @classmethod
    def _coerce_nulls(cls, data: Any) -> Any:
        """Frontend sends null for empty optional fields — coerce to defaults."""
        if isinstance(data, dict):
            if data.get("total_budget") is None:
                data["total_budget"] = 0
            for key in ("goal", "start_date", "end_date"):
                if data.get(key) is None:
                    data[key] = ""
        return data


class CampaignConfigDefaults(BaseModel):
    """Default values pre-filled in the HITL campaign configuration form."""
    start_date: str
    end_date: str
    total_budget: float | None = None
    selected_types: dict[str, list[str]] = Field(default_factory=dict)
    goal: str | None = None


class PlatformCampaignTypeOption(BaseModel):
    """A single campaign type option within a platform."""
    value: str
    label: str


class PlatformCampaignTypes(BaseModel):
    """Available campaign types for a connected platform."""
    label: str
    types: list[PlatformCampaignTypeOption]


class CampaignConfigPayload(BaseModel):
    """Typed payload for the campaign configuration HITL form."""
    form_type: str = "campaign_configure"
    url: str = ""
    website: str = ""
    currency: str = "USD"
    platform_campaign_types: dict[str, PlatformCampaignTypes] = Field(default_factory=dict)
    defaults: CampaignConfigDefaults


# ── Step data: configure → plan/build/save ────────────────────────

class ConfigureStepData(BaseModel):
    """Persisted data from configure step NodeResponse.data."""
    url: str = ""
    website_title: str = ""
    campaign_context: CampaignContext | None = None
    org_id: str = ""
    user_id: str = ""

    def to_node_data(self) -> dict[str, Any]:
        """Serialize for NodeResponse.data with underscore-prefixed internal keys."""
        d: dict[str, Any] = {"url": self.url, "website_title": self.website_title}
        if self.campaign_context:
            d["_campaign_context"] = self.campaign_context.model_dump()
        d["_org_id"] = self.org_id
        d["_user_id"] = self.user_id
        return d


class PlanStepData(BaseModel):
    """Persisted data from plan step NodeResponse.data."""
    campaign_plan: V2CampaignPlan
    campaign_context: CampaignContext | None = None
    org_id: str = ""
    user_id: str = ""

    def to_node_data(self) -> dict[str, Any]:
        """Serialize for NodeResponse.data with underscore-prefixed internal keys."""
        d: dict[str, Any] = {**self.campaign_plan.model_dump()}
        if self.campaign_context:
            d["_campaign_context"] = self.campaign_context.model_dump()
        d["_org_id"] = self.org_id
        d["_user_id"] = self.user_id
        return d


# ── Build step: per-campaign result + overall step data ───────────

class BuiltCampaignAssets(BaseModel):
    """Output of building one campaign (text + images + keywords)."""
    campaign: dict[str, Any]
    text_assets: dict[str, Any] = Field(default_factory=dict)
    image_urls: dict[str, list[str]] = Field(default_factory=dict)
    logo_url: str | None = None
    keywords: list[dict[str, Any]] = Field(default_factory=list)  # KeywordEntry dicts for Search campaigns


class BuildStepData(BaseModel):
    """Persisted data from build step NodeResponse.data."""
    campaigns: list[BuiltCampaignAssets]
    plan: dict[str, Any]
    campaign_context: CampaignContext | None = None
    org_id: str = ""
    user_id: str = ""
    media_plan: dict[str, Any] = Field(default_factory=dict)

    def to_node_data(self) -> dict[str, Any]:
        """Serialize for NodeResponse.data with underscore-prefixed internal keys."""
        return {
            "campaigns": [c.model_dump() for c in self.campaigns],
            "plan": self.plan,
            "_campaign_context": self.campaign_context.model_dump() if self.campaign_context else None,
            "_connected_platforms": (
                [c.model_dump() for c in self.campaign_context.supported_connections]
                if self.campaign_context else []
            ),
            "_org_id": self.org_id,
            "_user_id": self.user_id,
            "_media_plan": self.media_plan,
        }

    @classmethod
    def from_node_data(cls, data: dict[str, Any]) -> BuildStepData:
        """Parse from NodeResponse.data (with underscore-prefixed keys)."""
        campaign_ctx = CampaignContext.from_step_data(data)
        campaigns_raw = data.get("campaigns", [])
        campaigns = [
            BuiltCampaignAssets(**c) if isinstance(c, dict) else c
            for c in campaigns_raw
        ]
        return cls(
            campaigns=campaigns,
            plan=data.get("plan", {}),
            campaign_context=campaign_ctx,
            org_id=data.get("_org_id", ""),
            user_id=data.get("_user_id", ""),
            media_plan=data.get("_media_plan", {}),
        )
