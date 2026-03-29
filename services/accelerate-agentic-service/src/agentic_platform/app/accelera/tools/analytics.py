"""Analytics tools — 12 tools that call reporting-service and analytics-service.

Data flows: reporting-service POST /report → aggregated metrics → BlockSpec.
Phase 7 tools call analytics-service for attribution, geography, LLM traffic, and insights.
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import reporting_client, commerce_client, analytics_client
from src.agentic_platform.app.accelera.blocks import (
    metric_cards_block, MetricCardsData, MetricItem,
    platform_comparison_block, PlatformComparisonData, PlatformComparisonRow,
    funnel_chart_block, FunnelChartData, FunnelStageRow,
    performance_chart_block, PerformanceChartData, ChartSeries,
    wasted_spend_block, WastedSpendData, WastedSpendRow,
    revenue_breakdown_block, RevenueBreakdownData,
    executive_summary_block, ExecutiveSummaryData,
    metric_cards_block,
)


async def _fetch_report(org_id: str, days: int = 30, **kwargs) -> dict:
    """Helper: POST to reporting-service /report with org context."""
    resp = await reporting_client.post("/report", json={"orgId": org_id, "days": days, **kwargs})
    body = resp.get("body", {})
    return body if isinstance(body, dict) else {}


# ── get_analytics_overview ────────────────────────────────────────────

@tool("get_analytics_overview")
async def _get_analytics_overview(days: int = 30) -> dict:
    """Get blended ad performance overview across all connected platforms: spend, impressions,
    clicks, CTR, CPC, conversions, ROAS, and ad-attributed vs organic revenue split.
    Use when the user asks for overall ad performance or a top-level performance summary."""
    org_id = get_org_id()
    import asyncio as _asyncio
    data, attr_resp = await _asyncio.gather(
        _fetch_report(org_id, days=days),
        analytics_client.get(f"/analytics/attribution?org_id={org_id}&days={days}"),
        return_exceptions=True,
    )
    if isinstance(data, Exception):
        data = {}
    attr_body: dict = {}
    if not isinstance(attr_resp, Exception):
        attr_body = attr_resp.get("body", {}) or {}

    spend = data.get("totalSpend") or data.get("total_spend", 0.0)
    impressions = data.get("totalImpressions") or data.get("total_impressions", 0)
    clicks = data.get("totalClicks") or data.get("total_clicks", 0)
    conversions = data.get("totalConversions") or data.get("total_conversions", 0)
    revenue = data.get("totalRevenue") or data.get("total_revenue", 0.0)
    roas = revenue / spend if spend else 0.0
    ctr = (clicks / impressions * 100) if impressions else 0.0
    cpc = spend / clicks if clicks else 0.0
    currency = data.get("currency", "USD")

    ad_rev = attr_body.get("ad_attributed_revenue", 0.0)
    organic_rev = attr_body.get("organic_revenue", 0.0)
    ad_pct = attr_body.get("ad_attribution_pct", 0.0)
    organic_pct = attr_body.get("organic_pct", 0.0)

    metrics = [
        MetricItem(label="Total Spend", value=f"{currency} {spend:,.2f}"),
        MetricItem(label="Revenue", value=f"{currency} {revenue:,.2f}"),
        MetricItem(label="ROAS", value=f"{roas:.2f}x"),
        MetricItem(label="Impressions", value=f"{impressions:,}"),
        MetricItem(label="Clicks", value=f"{clicks:,}"),
        MetricItem(label="CTR", value=f"{ctr:.2f}%"),
        MetricItem(label="CPC", value=f"{currency} {cpc:.2f}"),
        MetricItem(label="Conversions", value=str(conversions)),
    ]
    if ad_rev or organic_rev:
        metrics.append(MetricItem(label="Ad-Attributed Revenue", value=f"{currency} {ad_rev:,.2f} ({ad_pct:.0f}%)"))
        metrics.append(MetricItem(label="Organic Revenue", value=f"{currency} {organic_rev:,.2f} ({organic_pct:.0f}%)"))

    attribution_note = ""
    if ad_rev or organic_rev:
        attribution_note = f" Ad-attributed: {currency} {ad_rev:,.2f} ({ad_pct:.0f}%), Organic: {currency} {organic_rev:,.2f} ({organic_pct:.0f}%)."

    merged = {**data, **attr_body}
    return ToolResponse(
        summary=f"Last {days}d: {currency} {spend:,.2f} spend, {roas:.2f}x ROAS, {conversions} conversions.{attribution_note}",
        data=merged,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Ad Performance Overview", period=f"Last {days} days"))],
    ).model_dump()

get_analytics_overview = AgenticTool(func=_get_analytics_overview, thinking_messages=["Fetching your ad performance..."], tags=[ToolTag.ANALYTICS])


# ── get_platform_comparison ───────────────────────────────────────────

@tool("get_platform_comparison")
async def _get_platform_comparison(days: int = 30) -> dict:
    """Compare ad performance side-by-side across Meta, Google, and Bing.
    Use when the user asks how platforms compare or which is performing best."""
    org_id = get_org_id()
    data = await _fetch_report(org_id, days=days, by_platform=True)

    platforms_raw = data.get("platforms") or data.get("byPlatform", [])
    rows = []
    for p in (platforms_raw if isinstance(platforms_raw, list) else []):
        spend = p.get("spend") or p.get("totalSpend", 0.0)
        clicks = p.get("clicks") or p.get("totalClicks", 0)
        impressions = p.get("impressions") or p.get("totalImpressions", 0)
        conversions = p.get("conversions") or p.get("totalConversions", 0)
        revenue = p.get("revenue") or p.get("totalRevenue", 0.0)
        rows.append(PlatformComparisonRow(
            platform=p.get("platform", ""),
            spend=spend,
            impressions=impressions,
            clicks=clicks,
            ctr=(clicks / impressions * 100) if impressions else 0.0,
            roas=(revenue / spend) if spend else 0.0,
            conversions=conversions,
            cpa=spend / conversions if conversions else 0.0,
        ))

    best = max(rows, key=lambda r: r.roas).platform if rows else "N/A"
    return ToolResponse(
        summary=f"Platform comparison (last {days}d): {len(rows)} platforms. Best ROAS: {best}.",
        data=data,
        ui_blocks=[platform_comparison_block.create(data=PlatformComparisonData(platforms=rows, period=f"Last {days} days"))],
    ).model_dump()

get_platform_comparison = AgenticTool(func=_get_platform_comparison, thinking_messages=["Comparing your ad platforms..."], tags=[ToolTag.ANALYTICS])


# ── get_funnel_analysis ───────────────────────────────────────────────

@tool("get_funnel_analysis")
async def _get_funnel_analysis(days: int = 30) -> dict:
    """Analyze the conversion funnel from ad impressions to purchases, including
    stage-by-stage drop-off percentages and the biggest bottleneck stage.
    Use when the user asks about funnel performance, drop-off, conversion rates,
    where visitors are falling off, or which stage has the highest abandonment."""
    org_id = get_org_id()
    data: dict = {}
    try:
        resp = await analytics_client.get(f"/analytics/funnel?org_id={org_id}&days={days}")
        data = resp.get("body", {}) or {}
    except Exception:
        pass
    if not data:
        data = await _fetch_report(org_id, days=days, funnel=True)

    funnel_data = data.get("funnel") or data
    impressions = funnel_data.get("impressions") or data.get("totalImpressions", 0)
    clicks = funnel_data.get("clicks") or data.get("totalClicks", 0)
    add_to_cart = funnel_data.get("addToCart") or funnel_data.get("add_to_cart", 0)
    checkouts = funnel_data.get("checkouts", 0)
    purchases = funnel_data.get("purchases") or funnel_data.get("conversions") or data.get("totalConversions", 0)

    stages = [
        FunnelStageRow(name="Impressions", value=impressions, drop_off_rate=0.0),
        FunnelStageRow(name="Clicks", value=clicks, drop_off_rate=round((1 - clicks / impressions) * 100, 1) if impressions else 0),
        FunnelStageRow(name="Add to Cart", value=add_to_cart, drop_off_rate=round((1 - add_to_cart / clicks) * 100, 1) if clicks else 0),
        FunnelStageRow(name="Checkout", value=checkouts, drop_off_rate=round((1 - checkouts / add_to_cart) * 100, 1) if add_to_cart else 0),
        FunnelStageRow(name="Purchase", value=purchases, drop_off_rate=round((1 - purchases / checkouts) * 100, 1) if checkouts else 0),
    ]
    cvr = (purchases / impressions * 100) if impressions else 0.0

    # Identify biggest bottleneck (stage with highest drop-off, excluding the first stage)
    bottleneck = max(stages[1:], key=lambda s: s.drop_off_rate) if len(stages) > 1 else None
    bottleneck_note = f" Biggest bottleneck: {bottleneck.name} ({bottleneck.drop_off_rate:.1f}% drop-off)." if bottleneck else ""

    return ToolResponse(
        summary=f"Funnel: {impressions:,} impressions → {purchases} purchases ({cvr:.2f}% CVR).{bottleneck_note}",
        data={"stages": [s.model_dump() for s in stages], "overall_conversion_rate": cvr, "bottleneck_stage": bottleneck.name if bottleneck else None},
        ui_blocks=[funnel_chart_block.create(data=FunnelChartData(stages=stages, overall_conversion_rate=cvr))],
    ).model_dump()

get_funnel_analysis = AgenticTool(func=_get_funnel_analysis, thinking_messages=["Analyzing your conversion funnel..."], tags=[ToolTag.ANALYTICS])


# ── get_daily_trends ──────────────────────────────────────────────────

@tool("get_daily_trends")
async def _get_daily_trends(days: int = 30) -> dict:
    """Get daily revenue and ad spend trends over time.
    Use when the user wants to see trends, patterns, or time-series performance data."""
    org_id = get_org_id()
    report_resp, revenue_resp = await __import__("asyncio").gather(
        _fetch_report(org_id, days=days, daily=True),
        commerce_client.get(f"/revenue/daily?org_id={org_id}&days={days}"),
    )

    daily_ad = report_resp.get("daily") or []
    body_rev = revenue_resp.get("body", {})
    daily_rev = body_rev.get("daily") or [] if isinstance(body_rev, dict) else []

    rev_by_date = {d.get("date", ""): d.get("revenue", 0.0) for d in daily_rev}
    spend_series = [{"date": d.get("date", ""), "value": d.get("spend", 0.0)} for d in daily_ad]
    revenue_series = [{"date": d.get("date", ""), "value": rev_by_date.get(d.get("date", ""), 0.0)} for d in daily_ad]

    return ToolResponse(
        summary=f"Daily trends over the last {days} days.",
        data={"spend": spend_series, "revenue": revenue_series},
        ui_blocks=[performance_chart_block.create(data=PerformanceChartData(
            series=[
                ChartSeries(name="Ad Spend", data=spend_series, color="#6366f1"),
                ChartSeries(name="Revenue", data=revenue_series, color="#22c55e"),
            ],
            title=f"Daily Trends — Last {days} Days",
            period=f"Last {days} days",
        ))],
    ).model_dump()

get_daily_trends = AgenticTool(func=_get_daily_trends, thinking_messages=["Loading daily performance trends..."], tags=[ToolTag.ANALYTICS])


# ── analyze_wasted_spend ──────────────────────────────────────────────

@tool("analyze_wasted_spend")
async def _analyze_wasted_spend(days: int = 30, roas_threshold: float = 0.5) -> dict:
    """Identify campaigns with high spend but low or zero ROAS (wasted spend).
    Use when the user asks about underperforming campaigns or where money is being wasted."""
    org_id = get_org_id()
    data = await _fetch_report(org_id, days=days, by_platform=True)

    campaigns_raw = data.get("campaigns") or []
    wasted = []
    total_wasted = 0.0
    for c in campaigns_raw:
        spend = c.get("spend", 0.0)
        revenue = c.get("revenue", 0.0)
        roas = revenue / spend if spend else 0.0
        if roas < roas_threshold and spend > 0:
            total_wasted += spend
            wasted.append(WastedSpendRow(
                campaign_id=c.get("id", ""),
                campaign_name=c.get("name", "Unknown"),
                platform=c.get("platform", ""),
                spend=spend,
                roas=roas,
                conversions=c.get("conversions", 0),
                recommendation="Pause or reduce budget — ROAS below threshold.",
            ))

    return ToolResponse(
        summary=f"Found {len(wasted)} campaigns wasting ${total_wasted:,.2f} (ROAS < {roas_threshold}x).",
        data={"wasted_campaigns": [w.model_dump() for w in wasted], "total_wasted": total_wasted},
        ui_blocks=[wasted_spend_block.create(data=WastedSpendData(campaigns=wasted, total_wasted=total_wasted))],
    ).model_dump()

analyze_wasted_spend = AgenticTool(func=_analyze_wasted_spend, thinking_messages=["Identifying wasted ad spend..."], tags=[ToolTag.ANALYTICS])


# ── get_revenue_breakdown ─────────────────────────────────────────────

@tool("get_revenue_breakdown")
async def _get_revenue_breakdown(days: int = 30) -> dict:
    """Break down revenue into ad-attributed vs organic.
    Use when the user asks about revenue sources or ad attribution."""
    org_id = get_org_id()
    import asyncio
    report_data, rev_resp = await asyncio.gather(
        _fetch_report(org_id, days=days),
        commerce_client.get(f"/revenue/summary?org_id={org_id}&days={days}"),
    )
    rev_body = rev_resp.get("body", {})

    total = rev_body.get("revenue", 0.0) if isinstance(rev_body, dict) else 0.0
    ad_revenue = report_data.get("totalRevenue") or report_data.get("total_revenue", 0.0)
    organic = max(0.0, total - ad_revenue)
    ad_pct = (ad_revenue / total * 100) if total else 0.0
    currency = rev_body.get("currency", "USD") if isinstance(rev_body, dict) else "USD"

    return ToolResponse(
        summary=f"Revenue breakdown: {currency} {ad_revenue:,.2f} ad-attributed ({ad_pct:.1f}%), {currency} {organic:,.2f} organic.",
        data={"ad_attributed": ad_revenue, "organic": organic, "total": total, "currency": currency},
        ui_blocks=[revenue_breakdown_block.create(data=RevenueBreakdownData(
            ad_attributed=ad_revenue, organic=organic, total=total, ad_percentage=ad_pct, currency=currency,
        ))],
    ).model_dump()

get_revenue_breakdown = AgenticTool(func=_get_revenue_breakdown, thinking_messages=["Calculating revenue breakdown..."], tags=[ToolTag.ANALYTICS])


# ── get_executive_summary ─────────────────────────────────────────────

@tool("get_executive_summary")
async def _get_executive_summary(days: int = 30) -> dict:
    """Get an executive KPI summary: blended ROAS, MER, top platform, and key insights.
    Use when the user wants a high-level overview for reporting or stakeholder updates."""
    org_id = get_org_id()
    import asyncio
    report_data, rev_resp = await asyncio.gather(
        _fetch_report(org_id, days=days, by_platform=True),
        commerce_client.get(f"/revenue/summary?org_id={org_id}&days={days}"),
    )
    rev_body = rev_resp.get("body", {}) if isinstance(rev_resp.get("body"), dict) else {}

    total_revenue = rev_body.get("revenue", 0.0)
    total_spend = report_data.get("totalSpend") or report_data.get("total_spend", 0.0)
    blended_roas = total_revenue / total_spend if total_spend else 0.0
    mer = total_revenue / total_spend if total_spend else 0.0
    currency = rev_body.get("currency", "USD")

    platforms = report_data.get("platforms") or report_data.get("byPlatform", [])
    top_platform = ""
    if platforms:
        best = max(platforms, key=lambda p: (p.get("revenue", 0) / p.get("spend", 1)) if p.get("spend") else 0)
        top_platform = best.get("platform", "")

    insights = []
    if blended_roas >= 3:
        insights.append(f"Strong blended ROAS of {blended_roas:.2f}x — campaigns are performing well.")
    elif blended_roas < 1:
        insights.append(f"Blended ROAS of {blended_roas:.2f}x is below break-even — review underperformers.")
    if top_platform:
        insights.append(f"{top_platform.capitalize()} is your best-performing platform.")

    return ToolResponse(
        summary=f"Executive summary: {blended_roas:.2f}x ROAS, {currency} {total_spend:,.2f} spend, top platform: {top_platform}.",
        data={"blended_roas": blended_roas, "mer": mer, "top_platform": top_platform, "total_spend": total_spend, "total_revenue": total_revenue},
        ui_blocks=[executive_summary_block.create(data=ExecutiveSummaryData(
            blended_roas=blended_roas, mer=mer, top_platform=top_platform,
            total_spend=total_spend, total_revenue=total_revenue, insights=insights, currency=currency,
        ))],
    ).model_dump()

get_executive_summary = AgenticTool(func=_get_executive_summary, thinking_messages=["Building executive summary..."], tags=[ToolTag.ANALYTICS])


# ── get_sales_regions ─────────────────────────────────────────────────

@tool("get_sales_regions")
async def _get_sales_regions(days: int = 30, limit: int = 10) -> dict:
    """Get top geographic regions by revenue.
    Use when the user asks about regional performance or where their customers are."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/revenue/by-channel?org_id={org_id}&days={days}")
    body = resp.get("body", {})
    channels = body.get("channels") or body.get("by_channel", []) if isinstance(body, dict) else []

    total = sum(c.get("revenue", 0.0) for c in channels) or 1.0
    regions = [
        {
            "region": c.get("channel") or c.get("region", "Unknown"),
            "revenue": c.get("revenue", 0.0),
            "orders": c.get("orders", 0),
            "percentage": round(c.get("revenue", 0.0) / total * 100, 1),
        }
        for c in channels[:limit]
    ]

    metrics = [MetricItem(label=r["region"], value=f"${r['revenue']:,.2f}", change=f"{r['percentage']}%") for r in regions[:5]]

    return ToolResponse(
        summary=f"Top {len(regions)} revenue regions in the last {days} days.",
        data={"regions": regions},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Top Revenue Regions"))],
    ).model_dump()

get_sales_regions = AgenticTool(func=_get_sales_regions, thinking_messages=["Analyzing regional sales data..."], tags=[ToolTag.ANALYTICS])


# ── get_revenue_attribution ──────────────────────────────────────────

@tool("get_revenue_attribution")
async def _get_revenue_attribution(
    days: int = 30,
) -> dict:
    """Get revenue attribution breakdown: how much revenue came from each ad platform vs organic.
    Returns total revenue, ad-attributed vs organic split, ROAS per platform, and daily trend.

    Use when the user asks about revenue sources, attribution, ROAS by platform, or
    ad vs organic revenue split."""
    org_id = get_org_id()

    data: dict = {}
    try:
        resp = await analytics_client.get(f"/analytics/attribution?org_id={org_id}&days={days}")
        data = resp.get("body", {}) or {}
    except Exception:
        pass

    platforms = data.get("platforms", [])
    total_rev = data.get("total_revenue", 0)
    ad_rev = data.get("ad_attributed_revenue", 0)
    organic_rev = data.get("organic_revenue", 0)

    summary = (
        f"Revenue attribution ({days}d): Total ${total_rev:,.0f}. "
        f"Ad-attributed: ${ad_rev:,.0f} ({data.get('ad_attribution_pct', 0):.0f}%), "
        f"Organic: ${organic_rev:,.0f} ({data.get('organic_pct', 0):.0f}%). "
    )
    if platforms:
        top = max(platforms, key=lambda p: p.get("roas") or 0)
        summary += f"Best ROAS: {top.get('name')} at {top.get('roas', 0):.1f}x."

    metrics = [
        MetricItem(label="Total Revenue", value=f"${total_rev:,.0f}"),
        MetricItem(label="Ad-Attributed", value=f"${ad_rev:,.0f} ({data.get('ad_attribution_pct', 0):.0f}%)"),
        MetricItem(label="Organic", value=f"${organic_rev:,.0f} ({data.get('organic_pct', 0):.0f}%)"),
    ]
    for p in platforms:
        if p.get("roas"):
            metrics.append(MetricItem(label=p["name"], value=f"ROAS {p['roas']:.1f}x"))

    return ToolResponse(
        summary=summary,
        data=data,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"Revenue Attribution — Last {days} Days",
        ))],
    ).model_dump()

get_revenue_attribution = AgenticTool(
    func=_get_revenue_attribution,
    thinking_messages=["Analysing revenue attribution...", "Breaking down ad vs organic revenue..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)


# ── get_geographic_analytics ─────────────────────────────────────────

@tool("get_geographic_analytics")
async def _get_geographic_analytics(
    days: int = 30,
) -> dict:
    """Get revenue and conversion data broken down by country and city.
    Returns top countries with revenue, order count, visitors, and conversion rates.

    Use when the user asks about geographic performance, which countries are converting,
    international sales, or where revenue is coming from."""
    org_id = get_org_id()

    data: dict = {}
    try:
        resp = await analytics_client.get(f"/analytics/geography?org_id={org_id}&days={days}")
        data = resp.get("body", {}) or {}
    except Exception:
        pass

    countries = data.get("countries", [])
    top_country = data.get("top_country", "N/A")
    total_countries = data.get("total_countries", 0)

    summary = (
        f"Geographic breakdown ({days}d): Revenue from {total_countries} countries. "
        f"Top market: {top_country}. "
    )
    if countries:
        top3 = countries[:3]
        summary += "Top 3: " + ", ".join(f"{c['country']} (${c.get('revenue', 0):,.0f})" for c in top3) + "."

    metrics = [MetricItem(label="Total Markets", value=str(total_countries))]
    for c in countries[:5]:
        metrics.append(MetricItem(
            label=c["country"],
            value=f"${c.get('revenue', 0):,.0f} ({c.get('cvr', 0):.1f}% CVR)"
        ))

    return ToolResponse(
        summary=summary,
        data=data,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"Geographic Revenue — Last {days} Days",
        ))],
    ).model_dump()

get_geographic_analytics = AgenticTool(
    func=_get_geographic_analytics,
    thinking_messages=["Analysing geographic data...", "Breaking down revenue by country..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)


# ── get_llm_traffic_report ───────────────────────────────────────────

@tool("get_llm_traffic_report")
async def _get_llm_traffic_report(
    days: int = 30,
) -> dict:
    """Get LLM/AI traffic analytics: how much traffic is arriving from AI platforms like
    ChatGPT, Claude, Perplexity, Gemini, and how well it converts vs organic traffic.

    Use when the user asks about AI traffic, bot traffic, ChatGPT referrals, LLM visitors,
    or whether AI platforms are sending customers."""
    org_id = get_org_id()

    data: dict = {}
    try:
        resp = await analytics_client.get(f"/analytics/llm-traffic?org_id={org_id}&days={days}")
        data = resp.get("body", {}) or {}
    except Exception:
        pass

    llm_pct = data.get("llm_pct", 0)
    llm_visitors = data.get("llm_visitors", 0)
    platforms = data.get("platforms", [])

    summary = (
        f"LLM traffic ({days}d): {llm_pct:.1f}% of visitors ({llm_visitors:,}) arrive from AI platforms. "
    )
    if platforms:
        top = platforms[0] if platforms else {}
        summary += f"Top source: {top.get('display_name', '')} at {top.get('pct', 0):.1f}%. "
        avg_cvr = sum(p.get("conversion_rate", 0) for p in platforms) / len(platforms)
        summary += f"Avg LLM conversion rate: {avg_cvr:.1f}%."

    metrics = [
        MetricItem(label="LLM Visitors", value=f"{llm_visitors:,} ({llm_pct:.1f}%)"),
    ]
    for p in platforms[:4]:
        metrics.append(MetricItem(
            label=p.get("display_name", p.get("platform", "")),
            value=f"{p.get('visitors', 0):,} visitors, {p.get('conversion_rate', 0):.1f}% CVR"
        ))

    return ToolResponse(
        summary=summary,
        data=data,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"LLM / AI Traffic — Last {days} Days",
        ))],
    ).model_dump()

get_llm_traffic_report = AgenticTool(
    func=_get_llm_traffic_report,
    thinking_messages=["Analysing AI platform traffic...", "Checking LLM referral sources..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)


# ── get_analytics_insights ───────────────────────────────────────────

@tool("get_analytics_insights")
async def _get_analytics_insights() -> dict:
    """Get AI-generated analytics insights: anomaly detection, conversion opportunities,
    geographic gaps, and traffic trends automatically surfaced from your data.

    Use when the user asks for insights, recommendations, what's unusual, what needs attention,
    or a summary of actionable findings from their analytics data."""
    org_id = get_org_id()

    insights: list = []
    try:
        resp = await analytics_client.get(f"/analytics/insights?org_id={org_id}")
        body = resp.get("body", {}) or {}
        insights = body.get("insights", [])
    except Exception:
        pass

    if not insights:
        summary = "No insights available yet. Analytics data is still being collected."
    else:
        high_priority = [i for i in insights if i.get("priority") == "high"]
        summary = f"Found {len(insights)} analytics insights"
        if high_priority:
            summary += f" ({len(high_priority)} high priority)"
        summary += ". Top: " + "; ".join(i.get("title", "") for i in insights[:3]) + "."

    metrics = []
    for ins in insights[:5]:
        priority_prefix = "🔴" if ins.get("priority") == "high" else "🟡" if ins.get("priority") == "medium" else "🔵"
        metrics.append(MetricItem(
            label=f"{priority_prefix} {ins.get('type', '').replace('_', ' ').title()}",
            value=ins.get("title", "")[:50]
        ))

    return ToolResponse(
        summary=summary,
        data={"insights": insights, "total": len(insights)},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics or [MetricItem(label="Status", value="No insights yet")],
            title="Analytics Insights",
        ))],
    ).model_dump()

get_analytics_insights = AgenticTool(
    func=_get_analytics_insights,
    thinking_messages=["Scanning your analytics...", "Detecting anomalies and opportunities..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)
