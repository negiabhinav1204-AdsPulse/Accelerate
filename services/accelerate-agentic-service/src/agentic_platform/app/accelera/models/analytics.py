"""Analytics domain models — ad platform reports, performance metrics."""

from typing import Optional
from pydantic import BaseModel


class PlatformMetrics(BaseModel):
    platform: str                      # "meta", "google", "bing"
    spend: float = 0.0
    impressions: int = 0
    clicks: int = 0
    ctr: float = 0.0                   # click-through rate %
    cpc: float = 0.0                   # cost per click
    conversions: int = 0
    revenue: float = 0.0
    roas: float = 0.0                  # return on ad spend
    cpa: float = 0.0                   # cost per acquisition


class AnalyticsOverview(BaseModel):
    total_spend: float = 0.0
    total_impressions: int = 0
    total_clicks: int = 0
    total_conversions: int = 0
    total_revenue: float = 0.0
    blended_roas: float = 0.0
    blended_ctr: float = 0.0
    blended_cpc: float = 0.0
    period_days: int = 30
    currency: str = "USD"
    platforms: list[PlatformMetrics] = []


class FunnelStage(BaseModel):
    name: str
    value: int
    drop_off_rate: float = 0.0         # % drop from previous stage


class FunnelAnalysis(BaseModel):
    stages: list[FunnelStage] = []
    overall_conversion_rate: float = 0.0


class DailyTrend(BaseModel):
    date: str
    spend: float = 0.0
    revenue: float = 0.0
    roas: float = 0.0
    clicks: int = 0
    conversions: int = 0


class WastedSpendCampaign(BaseModel):
    campaign_id: str
    campaign_name: str
    platform: str
    spend: float
    conversions: int
    roas: float
    recommendation: str


class RevenueBreakdown(BaseModel):
    ad_attributed: float = 0.0
    organic: float = 0.0
    total: float = 0.0
    ad_percentage: float = 0.0
    currency: str = "USD"


class ExecutiveSummary(BaseModel):
    blended_roas: float = 0.0
    mer: float = 0.0                   # marketing efficiency ratio
    top_platform: str = ""
    total_spend: float = 0.0
    total_revenue: float = 0.0
    period_days: int = 30
    currency: str = "USD"
    insights: list[str] = []


class SalesRegion(BaseModel):
    region: str
    revenue: float
    orders: int
    percentage: float
