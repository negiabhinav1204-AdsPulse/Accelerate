"""Platform domain models — connected accounts, feeds, merchant center."""

from typing import Optional
from pydantic import BaseModel


class ConnectedAccount(BaseModel):
    platform: str                      # "meta", "google", "bing"
    account_id: str
    account_name: str
    currency: str = "USD"
    status: str = "connected"          # "connected", "disconnected", "error"
    is_default: bool = False
    last_synced: Optional[str] = None


class FeedIssue(BaseModel):
    severity: str                      # "error", "warning", "info"
    message: str
    affected_products: int = 0


class FeedHealth(BaseModel):
    score: float = 0.0                 # 0-100
    status: str = "unknown"            # "healthy", "degraded", "error"
    total_products: int = 0
    synced_products: int = 0
    issues: list[FeedIssue] = []
    last_synced: Optional[str] = None
    feed_url: Optional[str] = None


class MerchantCenterStatus(BaseModel):
    connected: bool = False
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    approved_products: int = 0
    pending_products: int = 0
    disapproved_products: int = 0
    last_synced: Optional[str] = None


class CampaignStrategy(BaseModel):
    platform: str
    ad_type: str
    name: str
    description: str
    recommended_for: list[str] = []    # ["awareness", "sales", "retargeting"]
    min_budget: float = 5.0


# Platform strategy matrix (ported from Next.js PLATFORM_STRATEGIES)
PLATFORM_STRATEGIES: dict[str, list[CampaignStrategy]] = {
    "google": [
        CampaignStrategy(platform="google", ad_type="search", name="Search",
            description="Text ads on Google Search results",
            recommended_for=["sales", "leads"], min_budget=10.0),
        CampaignStrategy(platform="google", ad_type="pmax", name="Performance Max",
            description="AI-driven ads across all Google channels",
            recommended_for=["sales", "awareness"], min_budget=20.0),
        CampaignStrategy(platform="google", ad_type="shopping", name="Shopping",
            description="Product listing ads for e-commerce",
            recommended_for=["sales"], min_budget=10.0),
        CampaignStrategy(platform="google", ad_type="display", name="Display",
            description="Image ads across Google Display Network",
            recommended_for=["awareness", "retargeting"], min_budget=5.0),
    ],
    "meta": [
        CampaignStrategy(platform="meta", ad_type="feed", name="Feed Ads",
            description="Ads in Facebook and Instagram feeds",
            recommended_for=["sales", "awareness"], min_budget=5.0),
        CampaignStrategy(platform="meta", ad_type="stories", name="Stories",
            description="Full-screen vertical ads in Stories",
            recommended_for=["awareness", "engagement"], min_budget=5.0),
        CampaignStrategy(platform="meta", ad_type="reels", name="Reels",
            description="Short-form video ads in Reels",
            recommended_for=["awareness", "engagement"], min_budget=5.0),
    ],
    "bing": [
        CampaignStrategy(platform="bing", ad_type="search", name="Search",
            description="Text ads on Bing, Yahoo, and MSN",
            recommended_for=["sales", "leads"], min_budget=5.0),
        CampaignStrategy(platform="bing", ad_type="shopping", name="Shopping",
            description="Product ads on Microsoft Shopping",
            recommended_for=["sales"], min_budget=5.0),
    ],
}
