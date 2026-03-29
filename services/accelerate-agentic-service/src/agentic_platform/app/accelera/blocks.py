"""Block schemas for the Accelera AI domain.

15 INLINE blocks — one per TypeScript UI tool they replace.
Frontend maps block_type → existing React component (components unchanged).

Block type → React component mapping:
  metric_cards        → ChatMetricCard
  campaign_table      → ChatCampaignTable
  performance_chart   → ChatPerformanceChart
  product_leaderboard → ChatProductLeaderboard
  inventory_card      → ChatInventoryCard
  health_score_card   → ChatHealthScoreCard
  executive_summary   → ChatExecutiveSummaryCard
  funnel_chart        → ChatFunnelChartCard
  revenue_breakdown   → ChatRevenueBreakdownCard
  wasted_spend        → ChatWastedSpendCard
  platform_comparison → ChatPlatformComparisonCard
  audience_card       → ChatAudienceCard
  feed_health         → ChatFeedHealthCard
  nav_suggestion      → ChatNavSuggestion
  connect_prompt      → ChatConnectPrompt
"""

from typing import Any, Optional
from pydantic import BaseModel, Field

from src.agentic_platform.core.engine.blocks import BlockSpec, register_block_spec
from src.agentic_platform.core.engine.models import BlockDisplay


# ── 1. Metric Cards ──────────────────────────────────────────────────

class MetricItem(BaseModel):
    label: str
    value: str                          # formatted string e.g. "$12,450" or "3.2x"
    change: Optional[str] = None        # e.g. "+12%" or "-5%"
    trend: Optional[str] = None         # "up", "down", "neutral"

class MetricCardsData(BaseModel):
    metrics: list[MetricItem] = Field(description="KPI metric cards")
    title: Optional[str] = Field(default=None, description="Section title")
    period: Optional[str] = Field(default="Last 30 days")
    currency: str = Field(default="USD")

metric_cards_block = register_block_spec(BlockSpec(
    block_type="metric_cards",
    data_schema=MetricCardsData,
    display=BlockDisplay.INLINE,
    description="KPI metric cards — shows key numbers inline in chat.",
))


# ── 2. Campaign Table ─────────────────────────────────────────────────

class CampaignRow(BaseModel):
    id: str
    name: str
    platform: str
    status: str
    spend: float = 0.0
    impressions: int = 0
    clicks: int = 0
    roas: float = 0.0
    budget: float = 0.0
    health: Optional[str] = None        # "winner", "learner", "underperformer", "bleeder"

class CampaignTableData(BaseModel):
    campaigns: list[CampaignRow] = Field(description="Campaign rows")
    total_spend: float = Field(default=0.0)
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")

campaign_table_block = register_block_spec(BlockSpec(
    block_type="campaign_table",
    data_schema=CampaignTableData,
    display=BlockDisplay.INLINE,
    description="Campaign data table — shows all campaigns with metrics inline.",
))


# ── 3. Performance Chart ──────────────────────────────────────────────

class ChartSeries(BaseModel):
    name: str
    data: list[dict[str, Any]] = Field(description="[{date, value}] data points")
    color: Optional[str] = None

class PerformanceChartData(BaseModel):
    series: list[ChartSeries] = Field(description="Chart data series")
    x_axis: str = Field(default="date", description="X-axis field name")
    y_axis_label: str = Field(default="Value")
    chart_type: str = Field(default="line", description="line, bar, area")
    title: str = Field(default="Performance Trend")
    period: str = Field(default="Last 30 days")

performance_chart_block = register_block_spec(BlockSpec(
    block_type="performance_chart",
    data_schema=PerformanceChartData,
    display=BlockDisplay.INLINE,
    description="Time-series performance chart — renders trend data inline.",
))


# ── 4. Product Leaderboard ────────────────────────────────────────────

class ProductRow(BaseModel):
    id: str
    title: str
    price: float
    revenue_l30d: float = 0.0
    sales_velocity: float = 0.0
    inventory_qty: int = 0
    badge: Optional[str] = None         # "top_seller", "trending", "low_stock"
    image_url: Optional[str] = None
    ai_recommendation: Optional[str] = None

class ProductLeaderboardData(BaseModel):
    products: list[ProductRow] = Field(description="Product rows ranked by performance")
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")
    title: str = Field(default="Top Products")

product_leaderboard_block = register_block_spec(BlockSpec(
    block_type="product_leaderboard",
    data_schema=ProductLeaderboardData,
    display=BlockDisplay.INLINE,
    description="Product leaderboard — ranked products with badges and metrics.",
))


# ── 5. Inventory Card ─────────────────────────────────────────────────

class InventoryAlertRow(BaseModel):
    product_id: str
    title: str
    inventory_qty: int
    days_until_stockout: Optional[float] = None
    at_risk_revenue: float = 0.0
    severity: str = "low"               # "low", "medium", "critical"

class InventoryCardData(BaseModel):
    low_stock: list[InventoryAlertRow] = Field(default_factory=list)
    out_of_stock: list[InventoryAlertRow] = Field(default_factory=list)
    total_at_risk_revenue: float = Field(default=0.0)
    currency: str = Field(default="USD")
    threshold_days: int = Field(default=14)

inventory_card_block = register_block_spec(BlockSpec(
    block_type="inventory_card",
    data_schema=InventoryCardData,
    display=BlockDisplay.INLINE,
    description="Inventory health card — shows low-stock and out-of-stock alerts.",
))


# ── 6. Health Score Card ──────────────────────────────────────────────

class HealthScoreRow(BaseModel):
    campaign_id: str
    campaign_name: str
    platform: str
    category: str                       # "winner", "learner", "underperformer", "bleeder"
    roas: float = 0.0
    spend: float = 0.0
    recommendation: str = ""

class HealthScoreCardData(BaseModel):
    campaigns: list[HealthScoreRow] = Field(description="Campaign health scores")
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")

health_score_card_block = register_block_spec(BlockSpec(
    block_type="health_score_card",
    data_schema=HealthScoreCardData,
    display=BlockDisplay.INLINE,
    description="Campaign health scoring table — winner/learner/underperformer/bleeder.",
))


# ── 7. Executive Summary ──────────────────────────────────────────────

class ExecutiveSummaryData(BaseModel):
    blended_roas: float = Field(default=0.0)
    mer: float = Field(default=0.0, description="Marketing efficiency ratio")
    top_platform: str = Field(default="")
    total_spend: float = Field(default=0.0)
    total_revenue: float = Field(default=0.0)
    insights: list[str] = Field(default_factory=list, description="Key insights bullets")
    period: str = Field(default="Last 30 days")
    currency: str = Field(default="USD")

executive_summary_block = register_block_spec(BlockSpec(
    block_type="executive_summary",
    data_schema=ExecutiveSummaryData,
    display=BlockDisplay.INLINE,
    description="Executive KPI summary card — blended ROAS, MER, top platform.",
))


# ── 8. Funnel Chart ───────────────────────────────────────────────────

class FunnelStageRow(BaseModel):
    name: str
    value: int
    drop_off_rate: float = 0.0

class FunnelChartData(BaseModel):
    stages: list[FunnelStageRow] = Field(description="Funnel stages top-to-bottom")
    overall_conversion_rate: float = Field(default=0.0)
    title: str = Field(default="Conversion Funnel")

funnel_chart_block = register_block_spec(BlockSpec(
    block_type="funnel_chart",
    data_schema=FunnelChartData,
    display=BlockDisplay.INLINE,
    description="Conversion funnel chart — shows drop-off rates between stages.",
))


# ── 9. Revenue Breakdown ──────────────────────────────────────────────

class RevenueBreakdownData(BaseModel):
    ad_attributed: float = Field(default=0.0)
    organic: float = Field(default=0.0)
    total: float = Field(default=0.0)
    ad_percentage: float = Field(default=0.0)
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")

revenue_breakdown_block = register_block_spec(BlockSpec(
    block_type="revenue_breakdown",
    data_schema=RevenueBreakdownData,
    display=BlockDisplay.INLINE,
    description="Revenue breakdown pie — ad-attributed vs organic split.",
))


# ── 10. Wasted Spend ──────────────────────────────────────────────────

class WastedSpendRow(BaseModel):
    campaign_id: str
    campaign_name: str
    platform: str
    spend: float
    roas: float
    conversions: int = 0
    recommendation: str = ""

class WastedSpendData(BaseModel):
    campaigns: list[WastedSpendRow] = Field(description="Underperforming campaigns")
    total_wasted: float = Field(default=0.0)
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")

wasted_spend_block = register_block_spec(BlockSpec(
    block_type="wasted_spend",
    data_schema=WastedSpendData,
    display=BlockDisplay.INLINE,
    description="Wasted spend alert — campaigns with high spend and low/zero ROAS.",
))


# ── 11. Platform Comparison ───────────────────────────────────────────

class PlatformComparisonRow(BaseModel):
    platform: str
    spend: float = 0.0
    impressions: int = 0
    clicks: int = 0
    ctr: float = 0.0
    roas: float = 0.0
    conversions: int = 0
    cpa: float = 0.0

class PlatformComparisonData(BaseModel):
    platforms: list[PlatformComparisonRow] = Field(description="Per-platform metrics")
    currency: str = Field(default="USD")
    period: str = Field(default="Last 30 days")

platform_comparison_block = register_block_spec(BlockSpec(
    block_type="platform_comparison",
    data_schema=PlatformComparisonData,
    display=BlockDisplay.INLINE,
    description="Platform comparison table — Meta vs Google vs Bing side-by-side.",
))


# ── 12. Audience Card ─────────────────────────────────────────────────

class AudienceRow(BaseModel):
    id: str
    name: str
    type: str                           # "custom", "lookalike", "saved"
    estimated_size: int = 0
    status: str = "ready"
    platform: str = "meta"

class AudienceCardData(BaseModel):
    audiences: list[AudienceRow] = Field(description="Audience segments")
    total_count: int = Field(default=0)

audience_card_block = register_block_spec(BlockSpec(
    block_type="audience_card",
    data_schema=AudienceCardData,
    display=BlockDisplay.INLINE,
    description="Audience list card — custom and lookalike audiences with sizes.",
))


# ── 13. Feed Health ───────────────────────────────────────────────────

class FeedIssueRow(BaseModel):
    severity: str                       # "error", "warning", "info"
    message: str
    affected_products: int = 0

class FeedHealthData(BaseModel):
    score: float = Field(default=0.0, description="Feed health score 0-100")
    status: str = Field(default="unknown", description="healthy, degraded, error")
    total_products: int = Field(default=0)
    synced_products: int = Field(default=0)
    issues: list[FeedIssueRow] = Field(default_factory=list)
    last_synced: Optional[str] = Field(default=None)

feed_health_block = register_block_spec(BlockSpec(
    block_type="feed_health",
    data_schema=FeedHealthData,
    display=BlockDisplay.INLINE,
    description="Feed health card — product feed score, sync status, and issues.",
))


# ── 14. Nav Suggestion ────────────────────────────────────────────────

class NavSuggestionData(BaseModel):
    destination: str = Field(description="Route slug: create-campaign, campaigns, reporting, etc.")
    label: str = Field(description="Button label")
    reason: str = Field(default="", description="Why this navigation is suggested")

nav_suggestion_block = register_block_spec(BlockSpec(
    block_type="nav_suggestion",
    data_schema=NavSuggestionData,
    display=BlockDisplay.INLINE,
    description="Navigation suggestion button — directs user to relevant page.",
))


# ── 15. Connect Prompt ────────────────────────────────────────────────

class ConnectPromptData(BaseModel):
    platform: str = Field(description="Platform to connect: meta, google, bing")
    reason: str = Field(default="", description="Why connecting this platform is recommended")

connect_prompt_block = register_block_spec(BlockSpec(
    block_type="connect_prompt",
    data_schema=ConnectPromptData,
    display=BlockDisplay.INLINE,
    description="Account connection prompt — suggests connecting an ad platform.",
))


# ── 16. Campaign Summary Card (MODAL — pre-launch review) ─────────────

class CampaignSummaryData(BaseModel):
    name: str = Field(description="Campaign name")
    objective: str = Field(description="Campaign objective: sales, traffic, awareness, lead_generation")
    platforms: list[str] = Field(description="Target platforms: google, meta, bing")
    daily_budget: float = Field(default=0.0)
    currency: str = Field(default="USD")
    product_id: Optional[str] = Field(default=None)
    product_title: Optional[str] = Field(default=None)
    product_image_url: Optional[str] = Field(default=None)
    headline: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    targeting: dict[str, Any] = Field(default_factory=dict)
    estimated_reach: Optional[str] = Field(default=None)
    estimated_cpc: Optional[float] = Field(default=None)
    landing_url: Optional[str] = Field(default=None)

class CampaignSummaryTrigger(BaseModel):
    label: str = Field(default="Review Campaign")
    icon: str = Field(default="rocket")

campaign_summary_block = register_block_spec(BlockSpec(
    block_type="campaign_summary_card",
    data_schema=CampaignSummaryData,
    trigger_schema=CampaignSummaryTrigger,
    display=BlockDisplay.MODAL,
    description="Pre-launch campaign review card — shows targeting, budget, and creative for user approval.",
))


# ── 17. Experiment Results Card (INLINE — A/B test summary) ──────────

class ExperimentVariantRow(BaseModel):
    name: str
    visitors: int = Field(default=0)
    conversions: int = Field(default=0)
    conversion_rate: float = Field(default=0.0)
    lift: float = Field(default=0.0, description="% lift vs control")
    is_winner: bool = Field(default=False)
    is_control: bool = Field(default=False)

class ExperimentResultsData(BaseModel):
    experiment_id: str = Field(default="")
    experiment_name: str = Field(default="")
    status: str = Field(default="running", description="running, ended, paused")
    confidence: float = Field(default=0.0, description="Statistical confidence 0-100")
    is_significant: bool = Field(default=False)
    variants: list[ExperimentVariantRow] = Field(default_factory=list)
    days_running: int = Field(default=0)

experiment_results_block = register_block_spec(BlockSpec(
    block_type="experiment_results_card",
    data_schema=ExperimentResultsData,
    display=BlockDisplay.INLINE,
    description="A/B experiment results card — variant comparison with significance and lift.",
))


# ── 18. Onboarding Plan Card (INLINE — auto-onboard suggestions) ─────

class OnboardingCampaignSuggestion(BaseModel):
    product_id: str = Field(default="")
    product_title: str
    product_image_url: Optional[str] = Field(default=None)
    suggested_platform: str = Field(description="Recommended platform: google, meta, bing")
    suggested_budget: float = Field(default=50.0)
    currency: str = Field(default="USD")
    objective: str = Field(default="sales")
    estimated_roas: float = Field(default=0.0)
    rationale: str = Field(default="")

class OnboardingPlanData(BaseModel):
    suggestions: list[OnboardingCampaignSuggestion] = Field(default_factory=list)
    total_budget: float = Field(default=0.0)
    currency: str = Field(default="USD")
    message: str = Field(default="")

onboarding_plan_block = register_block_spec(BlockSpec(
    block_type="onboarding_plan_card",
    data_schema=OnboardingPlanData,
    display=BlockDisplay.INLINE,
    description="Auto-onboarding plan — top products with suggested campaigns and budgets.",
))


# ── 19. Media Plan Card (SIDEBAR — full platform allocation) ──────────

class MediaPlanAllocation(BaseModel):
    platform: str
    budget: float = Field(default=0.0)
    budget_pct: float = Field(default=0.0, description="% of total budget")
    objective: str = Field(default="sales")
    ad_type: str = Field(default="")
    rationale: str = Field(default="")
    estimated_impressions: Optional[int] = Field(default=None)
    estimated_roas: Optional[float] = Field(default=None)

class MediaPlanData(BaseModel):
    title: str = Field(default="Media Plan")
    total_budget: float = Field(default=0.0)
    currency: str = Field(default="USD")
    duration_days: int = Field(default=30)
    allocations: list[MediaPlanAllocation] = Field(default_factory=list)
    thirty_day_goal: str = Field(default="")
    sixty_day_goal: str = Field(default="")
    ninety_day_goal: str = Field(default="")
    key_insights: list[str] = Field(default_factory=list)

class MediaPlanTrigger(BaseModel):
    label: str = Field(default="View Full Media Plan")
    total_budget: float = Field(default=0.0)
    currency: str = Field(default="USD")

media_plan_block = register_block_spec(BlockSpec(
    block_type="media_plan_card",
    data_schema=MediaPlanData,
    trigger_schema=MediaPlanTrigger,
    display=BlockDisplay.SIDEBAR,
    description="Full media plan card — platform allocations, budget split, and 30/60/90 day roadmap.",
))
