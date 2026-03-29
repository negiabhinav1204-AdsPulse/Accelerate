"""Campaign domain models — campaigns, health scores, platform campaigns."""

from typing import Optional
from pydantic import BaseModel


class PlatformCampaign(BaseModel):
    id: str
    platform: str                      # "meta", "google", "bing"
    platform_campaign_id: Optional[str] = None
    status: str = "paused"             # "paused", "active", "ended"
    daily_budget: float = 0.0
    total_spend: float = 0.0
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    revenue: float = 0.0
    roas: float = 0.0


class HealthScore(BaseModel):
    category: str                      # "winner", "learner", "underperformer", "bleeder"
    score: float = 0.0                 # 0-100
    roas: float = 0.0
    spend: float = 0.0
    recommendation: str = ""


class Campaign(BaseModel):
    id: str
    name: str
    status: str = "paused"
    total_budget: float = 0.0
    daily_budget: float = 0.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    objective: str = "SALES"
    platform_campaigns: list[PlatformCampaign] = []
    health: Optional[HealthScore] = None
    created_at: Optional[str] = None


class OptimizationAction(BaseModel):
    campaign_id: str
    campaign_name: str
    action: str                        # "pause", "scale_budget", "optimize_targeting"
    reason: str
    priority: str = "medium"           # "high", "medium", "low"
    estimated_impact: str = ""
