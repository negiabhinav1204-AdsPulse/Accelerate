"""Campaign domain models.

Pydantic models for:
- Web scraping results (WebsiteContent, PageMetadata, Shopify/Generic product data)
- LLM strategy output (CampaignStrategy, CampaignIntent)
- Per-template text asset schemas (Search, Display, PMax for Google & Bing)
- Campaign service connections (ConnectionsResponse, ConnectedPlatform)
- Platform enums (PlatformType, CampaignType, TemplateType, CTAs)

Re-exports everything from submodules for backwards compatibility.
"""

from .enums import (
    AdGroupTargetingType,
    AssetGroupStatus,
    BingCallToAction,
    BudgetType,
    CampaignTargetingType,
    CampaignType,
    Gender,
    GoogleCallToAction,
    PlatformType,
    SlotDataOperation,
    TemplateType,
)

from .scraper import (
    GenericProductData,
    PageMetadata,
    ShopifyImage,
    ShopifyProductData,
    ShopifyVariant,
    WebsiteContent,
)

from .strategy import (
    CampaignIntent,
    CampaignStrategy,
    ImageSpec,
)

from .text_assets import (
    TEMPLATE_IMAGE_SLOTS,
    TEMPLATE_TEXT_ASSET_MAP,
    BingPerformanceMaxTextAssets,
    BingResponsiveDisplayAdTextAssets,
    BingResponsiveSearchAdTextAssets,
    GooglePerformanceMaxTextAssets,
    GoogleResponsiveDisplayAdTextAssets,
    GoogleResponsiveSearchAdTextAssets,
    Str25,
    Str30,
    Str90,
    Str100,
    TextAssetBase,
    fix_excessive_capitalization,
    sanitize_ad_text,
    _AD_TEXT_DISALLOWED_RE,
    _ALLOWED_CAPS,
    _MULTI_SPACE_RE,
    _SKIP_FIELDS,
)

from .connections import (
    AccountInfo,
    ConnectedPlatform,
    ConnectionsResponse,
    PlatformConnection,
    PlatformConnectionInfo,
)

from .context import CampaignContext

from .campaign_request import (
    AdGroupRequest,
    AdRequest,
    AssetGroupRequest,
    BudgetRequest,
    CampaignRequest,
    CampaignTargetingRequest,
    AdGroupTargetingRequest,
    SlotDataUpdateEntry,
)

from .analysis import (
    AudienceAnalysisResult,
    AudiencePersona,
    BrandAnalysisResult,
    BrandInsight,
    BusinessContext,
    Competitor,
    Demographics,
    Trend,
    MarketingAnalysisReport,
    ProductAnalysisResult,
    ProductInsight,
)

from .plan import (
    AdAudienceDetail,
    AdProductDetail,
    AgentSummary,
    CampaignAdContext,
    CompetitorInsight,
    MarketTrend,
    SlimCampaign,
    SlimPlan,
    V2CampaignConfig,
    V2CampaignPlan,
)

from .workflow_io import (
    AudiencePreferences,
    BrandPreferences,
    BuildStepData,
    BuiltCampaignAssets,
    CampaignConfigDefaults,
    CampaignConfigFormInput,
    CampaignConfigPayload,
    ConfigureStepData,
    CreateCampaignArgs,
    CreateMediaPlanInput,
    CreativePreferences,
    PlanStepData,
    PlatformCampaignTypeOption,
    PlatformCampaignTypes,
    ProductPreferences,
)

__all__ = [
    # enums
    "AdGroupTargetingType",
    "AssetGroupStatus",
    "BingCallToAction",
    "BudgetType",
    "CampaignTargetingType",
    "CampaignType",
    "Gender",
    "GoogleCallToAction",
    "PlatformType",
    "SlotDataOperation",
    "TemplateType",
    # scraper
    "GenericProductData",
    "PageMetadata",
    "ShopifyImage",
    "ShopifyProductData",
    "ShopifyVariant",
    "WebsiteContent",
    # strategy
    "CampaignIntent",
    "CampaignStrategy",
    "ImageSpec",
    # text_assets
    "TEMPLATE_IMAGE_SLOTS",
    "TEMPLATE_TEXT_ASSET_MAP",
    "BingPerformanceMaxTextAssets",
    "BingResponsiveDisplayAdTextAssets",
    "BingResponsiveSearchAdTextAssets",
    "GooglePerformanceMaxTextAssets",
    "GoogleResponsiveDisplayAdTextAssets",
    "GoogleResponsiveSearchAdTextAssets",
    "Str25",
    "Str30",
    "Str90",
    "Str100",
    "TextAssetBase",
    "fix_excessive_capitalization",
    "sanitize_ad_text",
    "_AD_TEXT_DISALLOWED_RE",
    "_ALLOWED_CAPS",
    "_MULTI_SPACE_RE",
    "_SKIP_FIELDS",
    # connections
    "AccountInfo",
    "CampaignContext",
    "ConnectedPlatform",
    "ConnectionsResponse",
    "PlatformConnection",
    "PlatformConnectionInfo",
    # campaign_request
    "AdGroupRequest",
    "AdRequest",
    "AssetGroupRequest",
    "BudgetRequest",
    "CampaignRequest",
    "CampaignTargetingRequest",
    "AdGroupTargetingRequest",
    "SlotDataUpdateEntry",
    # analysis
    "AudienceAnalysisResult",
    "AudiencePersona",
    "BrandAnalysisResult",
    "BrandInsight",
    "BusinessContext",
    "Competitor",
    "Demographics",
    "MarketingAnalysisReport",
    "ProductAnalysisResult",
    "ProductInsight",
    # plan
    "AdAudienceDetail",
    "AdProductDetail",
    "AgentSummary",
    "CampaignAdContext",
    "CompetitorInsight",
    "MarketTrend",
    "SlimCampaign",
    "SlimPlan",
    "V2CampaignConfig",
    "V2CampaignPlan",
    # workflow_io
    "AudiencePreferences",
    "BrandPreferences",
    "BuildStepData",
    "BuiltCampaignAssets",
    "CampaignConfigDefaults",
    "CampaignConfigFormInput",
    "CampaignConfigPayload",
    "ConfigureStepData",
    "CreateCampaignArgs",
    "CreateMediaPlanInput",
    "CreativePreferences",
    "PlanStepData",
    "PlatformCampaignTypeOption",
    "PlatformCampaignTypes",
    "ProductPreferences",
]
