"""Accelerate analytics proxy tools.

Proxies the 10 analytics data tools from the Accelerate Next.js service.
Each tool calls /api/internal/tools on the dashboard via make_accelerate_tool.
"""

from typing import Optional
from pydantic import Field

from src.agentic_platform.core.engine.models import ToolTag, UIBlock
from src.agentic_platform.app.campaigns.tools.accelerate_tools import make_accelerate_tool


# ── Block builders (result → summary + ui_blocks) ────────────────────────────

def _overview_blocks(r: dict):
    cur = r.get("currency", "")
    spend = float(r.get("spend", 0))
    roas = r.get("roas", "0")
    ctr = r.get("ctr", "0%")
    convs = r.get("conversions", 0)
    imps = r.get("impressions", 0)
    cpc = r.get("cpc", "0")
    sc = float(r.get("spend_change_pct", 0))
    period = r.get("period", "30d")
    metrics = [
        {"label": "Total Spend", "value": f"{cur} {spend:,.0f}",
         "change": f"{sc:+.1f}%", "trend": "up" if sc > 0 else ("down" if sc < 0 else "neutral")},
        {"label": "ROAS", "value": f"{roas}x", "trend": "neutral"},
        {"label": "CTR", "value": ctr, "trend": "neutral"},
        {"label": "Conversions", "value": f"{int(convs):,}", "trend": "neutral"},
        {"label": "Impressions", "value": f"{int(imps):,}", "trend": "neutral"},
        {"label": "Avg. CPC", "value": f"{cur} {cpc}", "trend": "neutral"},
    ]
    summary = (
        f"Last {period}: {cur} {spend:,.0f} spend, {roas}x ROAS, "
        f"{int(convs):,} conversions, {ctr} CTR across "
        f"{r.get('platforms_active', 0)} platform(s). "
        f"Spend {'up' if sc > 0 else 'down'} {abs(sc):.1f}% vs prior period."
    )
    blocks = [UIBlock(type="metric_cards", data={"title": f"Ad Performance — Last {period}", "metrics": metrics})]
    return summary, blocks


def _executive_summary_blocks(r: dict):
    spend = float(r.get("total_spend", 0))
    rev = float(r.get("total_revenue", 0))
    roas = r.get("blended_roas", "0")
    sc = float(r.get("spend_change_pct", 0))
    rc = float(r.get("revenue_change_pct", 0))
    cur = r.get("currency", "")
    top = r.get("top_platform", "N/A")
    period = r.get("period", "30d")
    summary = (
        f"Executive KPIs — Last {period}: {cur} {spend:,.0f} spend ({sc:+.1f}%), "
        f"{cur} {rev:,.0f} revenue ({rc:+.1f}%), blended ROAS {roas}x, "
        f"top platform: {top}."
    )
    blocks = [UIBlock(type="executive_summary", data=r)]
    return summary, blocks


def _platform_comparison_blocks(r: dict):
    platforms = r.get("platforms", [])
    period = r.get("period", "30d")
    top = max(platforms, key=lambda p: float(p.get("roas", 0)), default={})
    summary = (
        f"Platform comparison — Last {period}: {len(platforms)} active platform(s). "
        + (f"Best ROAS: {top.get('platform', '')} at {top.get('roas', '0')}x." if top else "")
    )
    blocks = [UIBlock(type="platform_comparison", data=r)]
    return summary, blocks


def _wasted_spend_blocks(r: dict):
    total = r.get("total_wasted", "0")
    count = r.get("items_count", 0)
    cur = r.get("currency", "")
    summary = (
        r.get("summary", "")
        or (f"No wasted spend detected." if count == 0 else f"{cur} {total} in potential wasted spend across {count} campaign(s).")
    )
    blocks = [UIBlock(type="wasted_spend", data=r)]
    return summary, blocks


def _funnel_blocks(r: dict):
    rate = r.get("overall_conversion_rate", "N/A")
    opp = r.get("biggest_opportunity", "")
    period = r.get("period", "30d")
    summary = f"Conversion funnel — Last {period}: {rate} overall rate." + (f" Biggest opportunity: {opp}." if opp else "")
    blocks = [UIBlock(type="funnel_chart", data=r)]
    return summary, blocks

# ── get_analytics_overview ──────────────────────────────────────────────────

get_analytics_overview = make_accelerate_tool(
    name="get_analytics_overview",
    description=(
        "Get site/ad analytics overview: total spend, impressions, clicks, CTR, CPC, "
        "conversions, ROAS across all connected platforms for the requested period. "
        "Best for 'how are my ads performing' or 'give me an overview'."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="Time period: 7d, 14d, 30d, 90d (default 30d)"),
        ),
    },
    thinking_messages=["Pulling your analytics overview...", "Crunching the numbers..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
    post_processor=_overview_blocks,
)

# ── get_platform_comparison ─────────────────────────────────────────────────

get_platform_comparison = make_accelerate_tool(
    name="get_platform_comparison",
    description=(
        "Compare ad performance metrics side-by-side across connected platforms "
        "(Meta, Google, Bing). Returns spend, impressions, clicks, CTR, CPC, "
        "conversions, ROAS per platform."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="Time period: 7d, 14d, 30d, 90d (default 30d)"),
        ),
    },
    thinking_messages=["Comparing platforms...", "Pulling platform data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
    post_processor=_platform_comparison_blocks,
)

# ── get_funnel_analysis ─────────────────────────────────────────────────────

get_funnel_analysis = make_accelerate_tool(
    name="get_funnel_analysis",
    description=(
        "Get conversion funnel analysis: product views → add-to-cart → checkout → "
        "purchase with drop-off rates at each stage."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="Time period: 7d, 30d, 90d (default 30d)"),
        ),
    },
    thinking_messages=["Analysing your conversion funnel...", "Mapping the funnel..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
    post_processor=_funnel_blocks,
)

# ── get_daily_trends ────────────────────────────────────────────────────────

get_daily_trends = make_accelerate_tool(
    name="get_daily_trends",
    description=(
        "Get daily revenue and ad spend trends over time. Use for 'show me the trend' "
        "or 'how has performance changed day by day'."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Number of days of history to return (default 30)"),
        ),
        "metric": (
            Optional[str],
            Field(
                default="revenue",
                description="Metric to trend: revenue, spend, orders, roas (default revenue)",
            ),
        ),
    },
    thinking_messages=["Loading daily trends...", "Pulling trend data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── analyze_wasted_spend ────────────────────────────────────────────────────

analyze_wasted_spend = make_accelerate_tool(
    name="analyze_wasted_spend",
    description=(
        "Identify campaigns and ad sets where spend is high but conversions are zero "
        "or ROAS is below 0.5. Returns total wasted spend and actionable recommendations."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Look-back window in days (default 30)"),
        ),
        "min_spend": (
            Optional[float],
            Field(default=50, description="Minimum spend threshold to flag (default 50)"),
        ),
    },
    thinking_messages=["Scanning for wasted spend...", "Identifying inefficiencies..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=60,
    post_processor=_wasted_spend_blocks,
)

# ── get_revenue_breakdown ───────────────────────────────────────────────────

get_revenue_breakdown = make_accelerate_tool(
    name="get_revenue_breakdown",
    description=(
        "Break down total revenue into ad-attributed vs organic sources by platform. "
        "Use for 'where is my revenue coming from' or 'revenue attribution'."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="30d, 7d, 90d (default 30d)"),
        ),
    },
    thinking_messages=["Calculating revenue attribution...", "Breaking down revenue sources..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_executive_summary ───────────────────────────────────────────────────

get_executive_summary = make_accelerate_tool(
    name="get_executive_summary",
    description=(
        "Get an executive KPI summary: blended ROAS, MER (marketing efficiency ratio), "
        "total spend, total revenue, top-performing platform, and period-over-period trends."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="30d, 7d, 90d (default 30d)"),
        ),
    },
    thinking_messages=["Preparing your executive summary...", "Compiling top-line KPIs..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
    post_processor=_executive_summary_blocks,
)

# ── get_sales_regions ──────────────────────────────────────────────────────

get_sales_regions = make_accelerate_tool(
    name="get_sales_regions",
    description=(
        "Find the top geographic regions by revenue from orders. Great for understanding "
        "where customers are located and for targeting decisions."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=90, description="Days to look back (default 90)"),
        ),
    },
    thinking_messages=["Finding your top regions...", "Mapping sales geography..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_demographic_insights ────────────────────────────────────────────────

get_demographic_insights = make_accelerate_tool(
    name="get_demographic_insights",
    description=(
        "Get demographic performance breakdown: age ranges and gender performance — "
        "spend, conversions, CPA, ROAS per segment. Use for: 'who is buying', "
        "'age breakdown', 'gender performance', 'which age group converts best', "
        "'audience demographics'."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Days to look back (default 30)"),
        ),
    },
    thinking_messages=["Analysing demographic data...", "Breaking down audience segments..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_placement_insights ──────────────────────────────────────────────────

get_placement_insights = make_accelerate_tool(
    name="get_placement_insights",
    description=(
        "Get ad placement performance: Facebook Feed vs Instagram Stories vs Reels vs "
        "Search vs other placements — spend, conversions, CPA, ROAS per placement. "
        "Use for: 'which placements work', 'Facebook vs Instagram', 'feed vs stories', "
        "'where are my ads showing', 'placement performance'."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Days to look back (default 30)"),
        ),
    },
    thinking_messages=["Checking placement performance...", "Analysing ad placements..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── Public exports ──────────────────────────────────────────────────────────

ACCELERATE_ANALYTICS_TOOLS = [
    get_analytics_overview,
    get_platform_comparison,
    get_funnel_analysis,
    get_daily_trends,
    analyze_wasted_spend,
    get_revenue_breakdown,
    get_executive_summary,
    get_sales_regions,
    get_demographic_insights,
    get_placement_insights,
]
