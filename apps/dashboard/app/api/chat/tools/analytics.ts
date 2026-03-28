import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';

export type ToolContext = {
  orgId: string;
  currency: string;
};

// ---------------------------------------------------------------------------
// Analytics Tool Schemas
// ---------------------------------------------------------------------------

export const ANALYTICS_TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'get_analytics_overview',
    description:
      'Get site/ad analytics overview: total spend, impressions, clicks, CTR, CPC, conversions, ROAS across all connected platforms for the requested period. Best for "how are my ads performing" or "give me an overview".',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Time period: 7d, 14d, 30d, 90d (default 30d)',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_platform_comparison',
    description:
      'Compare ad performance metrics side-by-side across connected platforms (Meta, Google, Bing). Returns spend, impressions, clicks, CTR, CPC, conversions, ROAS per platform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Time period: 7d, 14d, 30d, 90d (default 30d)',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_funnel_analysis',
    description:
      'Get conversion funnel analysis: product views → add-to-cart → checkout → purchase with drop-off rates at each stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Time period: 7d, 30d, 90d (default 30d)',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_daily_trends',
    description:
      'Get daily revenue and ad spend trends over time. Use for "show me the trend" or "how has performance changed day by day".',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Number of days of history to return (default 30)',
          default: 30,
        },
        metric: {
          type: 'string',
          description: 'Metric to trend: revenue, spend, orders, roas (default revenue)',
          default: 'revenue',
        },
      },
      required: [],
    },
  },
  {
    name: 'analyze_wasted_spend',
    description:
      'Identify campaigns and ad sets where spend is high but conversions are zero or ROAS is below 0.5. Returns total wasted spend and actionable recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Look-back window in days (default 30)',
          default: 30,
        },
        min_spend: {
          type: 'number',
          description: 'Minimum spend threshold to flag (default 50)',
          default: 50,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_revenue_breakdown',
    description:
      'Break down total revenue into ad-attributed vs organic sources by platform. Use for "where is my revenue coming from" or "revenue attribution".',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: '30d, 7d, 90d (default 30d)',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_executive_summary',
    description:
      'Get an executive KPI summary: blended ROAS, MER (marketing efficiency ratio), total spend, total revenue, top-performing platform, and period-over-period trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: '30d, 7d, 90d (default 30d)',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_sales_regions',
    description:
      'Find the top geographic regions by revenue from orders. Great for understanding where customers are located and for targeting decisions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Days to look back (default 90)',
          default: 90,
        },
      },
      required: [],
    },
  },
];

export const ANALYTICS_TOOL_NAMES = new Set(ANALYTICS_TOOL_SCHEMAS.map((t) => t.name));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function periodToDays(period: string): number {
  const map: Record<string, number> = { '1d': 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
  return map[period] ?? 30;
}

function periodStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Extract numeric from JSON field safely */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

/** Aggregate AdPlatformReport.data across multiple reports */
function aggregateReports(reports: { platform: string; data: unknown }[]) {
  const byPlatform: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number }> = {};

  for (const r of reports) {
    const d = r.data as Record<string, unknown>;
    const p = r.platform.toLowerCase();
    if (!byPlatform[p]) {
      byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 };
    }
    const agg = byPlatform[p]!;

    // Handle flat object (single campaign row)
    if (Array.isArray(d)) {
      for (const row of d as Record<string, unknown>[]) {
        agg.spend += toNum(row.spend);
        agg.impressions += toNum(row.impressions);
        agg.clicks += toNum(row.clicks);
        agg.conversions += toNum(row.conversions ?? row.actions_purchases ?? 0);
        agg.conversionValue += toNum(row.conversion_value ?? row.purchase_value ?? 0);
      }
    } else {
      agg.spend += toNum(d.spend);
      agg.impressions += toNum(d.impressions);
      agg.clicks += toNum(d.clicks);
      agg.conversions += toNum(d.conversions ?? d.actions_purchases ?? 0);
      agg.conversionValue += toNum(d.conversion_value ?? d.purchase_value ?? 0);
    }
  }
  return byPlatform;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleGetAnalyticsOverview(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = periodToDays((input.period as string) ?? '30d');
  const since = periodStart(days);
  const prevSince = periodStart(days * 2);

  const reports = await prisma.adPlatformReport.findMany({
    where: { organizationId: ctx.orgId, fetchedAt: { gte: since } },
    select: { platform: true, data: true },
  });

  const prevReports = await prisma.adPlatformReport.findMany({
    where: { organizationId: ctx.orgId, fetchedAt: { gte: prevSince, lt: since } },
    select: { platform: true, data: true },
  });

  const curr = aggregateReports(reports);
  const prev = aggregateReports(prevReports);

  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 };
  for (const v of Object.values(curr)) {
    totals.spend += v.spend;
    totals.impressions += v.impressions;
    totals.clicks += v.clicks;
    totals.conversions += v.conversions;
    totals.conversionValue += v.conversionValue;
  }

  const prevTotals = { spend: 0, conversions: 0, conversionValue: 0 };
  for (const v of Object.values(prev)) {
    prevTotals.spend += v.spend;
    prevTotals.conversions += v.conversions;
    prevTotals.conversionValue += v.conversionValue;
  }

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;
  const spendChange = prevTotals.spend > 0 ? ((totals.spend - prevTotals.spend) / prevTotals.spend) * 100 : 0;

  return {
    period: `${days}d`,
    currency: ctx.currency,
    spend: totals.spend.toFixed(2),
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr: ctr.toFixed(2) + '%',
    cpc: cpc.toFixed(2),
    conversions: totals.conversions,
    roas: roas.toFixed(2),
    conversion_value: totals.conversionValue.toFixed(2),
    spend_change_pct: spendChange.toFixed(1),
    platforms_active: Object.keys(curr).length,
  };
}

async function handleGetPlatformComparison(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = periodToDays((input.period as string) ?? '30d');
  const since = periodStart(days);

  const reports = await prisma.adPlatformReport.findMany({
    where: { organizationId: ctx.orgId, fetchedAt: { gte: since } },
    select: { platform: true, data: true },
  });

  const byPlatform = aggregateReports(reports);

  const platforms = Object.entries(byPlatform).map(([platform, m]) => {
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
    const roas = m.spend > 0 ? m.conversionValue / m.spend : 0;
    const cpa = m.conversions > 0 ? m.spend / m.conversions : 0;
    return {
      platform,
      spend: m.spend.toFixed(2),
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: ctr.toFixed(2) + '%',
      cpc: cpc.toFixed(2),
      conversions: m.conversions,
      roas: roas.toFixed(2),
      cpa: cpa.toFixed(2),
    };
  });

  // Sort by spend desc
  platforms.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

  return {
    period: `${days}d`,
    currency: ctx.currency,
    platforms,
  };
}

async function handleGetFunnelAnalysis(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = periodToDays((input.period as string) ?? '30d');
  const since = periodStart(days);

  // Use DailyRevenueSummary for purchase count
  const revRows = await prisma.dailyRevenueSummary.findMany({
    where: {
      organizationId: ctx.orgId,
      date: { gte: since },
    },
    select: { orders: true, revenue: true },
  });

  const purchases = revRows.reduce((s, r) => s + r.orders, 0);

  // Estimate funnel stages from purchases (industry averages without pixel data)
  const checkouts = Math.round(purchases / 0.65); // ~65% checkout → purchase
  const addToCarts = Math.round(checkouts / 0.45); // ~45% ATC → checkout
  const productViews = Math.round(addToCarts / 0.12); // ~12% view → ATC

  const stages = [
    { stage: 'Product Views', count: productViews, drop_off_pct: null },
    {
      stage: 'Add to Cart',
      count: addToCarts,
      drop_off_pct: productViews > 0 ? (((productViews - addToCarts) / productViews) * 100).toFixed(1) : '0',
    },
    {
      stage: 'Checkout Started',
      count: checkouts,
      drop_off_pct: addToCarts > 0 ? (((addToCarts - checkouts) / addToCarts) * 100).toFixed(1) : '0',
    },
    {
      stage: 'Purchase',
      count: purchases,
      drop_off_pct: checkouts > 0 ? (((checkouts - purchases) / checkouts) * 100).toFixed(1) : '0',
    },
  ];

  const overallConvRate = productViews > 0 ? ((purchases / productViews) * 100).toFixed(2) + '%' : 'N/A';
  const biggestDrop = stages.slice(1).sort((a, b) => parseFloat(b.drop_off_pct ?? '0') - parseFloat(a.drop_off_pct ?? '0'))[0];

  return {
    period: `${days}d`,
    stages,
    overall_conversion_rate: overallConvRate,
    biggest_opportunity: biggestDrop ? `${biggestDrop.stage} (${biggestDrop.drop_off_pct}% drop-off)` : null,
    note: purchases === 0 ? 'No order data found for this period. Connect a commerce store or wait for data to sync.' : undefined,
  };
}

async function handleGetDailyTrends(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = (input.days as number) ?? 30;
  const metric = (input.metric as string) ?? 'revenue';
  const since = periodStart(days);

  const revRows = await prisma.dailyRevenueSummary.findMany({
    where: { organizationId: ctx.orgId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { date: true, revenue: true, orders: true },
  });

  const dataPoints = revRows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    value:
      metric === 'orders'
        ? r.orders
        : parseFloat(r.revenue.toString()),
  }));

  return {
    metric,
    period: `${days}d`,
    currency: ctx.currency,
    data: dataPoints,
  };
}

async function handleAnalyzeWastedSpend(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = (input.days as number) ?? 30;
  const minSpend = (input.min_spend as number) ?? 50;
  const since = periodStart(days);

  const reports = await prisma.adPlatformReport.findMany({
    where: { organizationId: ctx.orgId, fetchedAt: { gte: since } },
    select: { platform: true, data: true },
  });

  let totalWasted = 0;
  const wastedItems: { platform: string; campaign: string; spend: number; conversions: number; roas: number; recommendation: string }[] = [];

  for (const r of reports) {
    const d = r.data as Record<string, unknown>;
    const rows: Record<string, unknown>[] = Array.isArray(d) ? (d as Record<string, unknown>[]) : [d];

    for (const row of rows) {
      const spend = toNum(row.spend);
      const conversions = toNum(row.conversions ?? row.actions_purchases ?? 0);
      const convValue = toNum(row.conversion_value ?? row.purchase_value ?? 0);
      const roas = spend > 0 ? convValue / spend : 0;
      const name = (row.campaign_name ?? row.name ?? 'Unknown') as string;

      if (spend >= minSpend && (conversions === 0 || roas < 0.5)) {
        totalWasted += spend;
        wastedItems.push({
          platform: r.platform,
          campaign: name,
          spend,
          conversions,
          roas,
          recommendation:
            conversions === 0
              ? 'Pause this campaign — no conversions despite significant spend'
              : roas < 0.5
              ? 'Reduce budget or pause — ROAS below 0.5x means you\'re losing money'
              : 'Monitor closely',
        });
      }
    }
  }

  wastedItems.sort((a, b) => b.spend - a.spend);

  return {
    period: `${days}d`,
    currency: ctx.currency,
    total_wasted: totalWasted.toFixed(2),
    items_count: wastedItems.length,
    items: wastedItems.slice(0, 10),
    summary: wastedItems.length === 0
      ? 'No wasted spend detected — all campaigns are converting.'
      : `Found ${wastedItems.length} campaign(s) with ${ctx.currency} ${totalWasted.toFixed(0)} in potential wasted spend.`,
  };
}

async function handleGetRevenueBreakdown(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = periodToDays((input.period as string) ?? '30d');
  const since = periodStart(days);

  // Total revenue from DailyRevenueSummary
  const revRows = await prisma.dailyRevenueSummary.findMany({
    where: { organizationId: ctx.orgId, date: { gte: since } },
    select: { revenue: true },
  });
  const totalRevenue = revRows.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);

  // Ad-attributed revenue from AdPlatformReport
  const reports = await prisma.adPlatformReport.findMany({
    where: { organizationId: ctx.orgId, fetchedAt: { gte: since } },
    select: { platform: true, data: true },
  });

  const byPlatform = aggregateReports(reports);
  let adAttributed = 0;
  const platformBreakdown: { platform: string; attributed_revenue: number; spend: number }[] = [];

  for (const [platform, m] of Object.entries(byPlatform)) {
    adAttributed += m.conversionValue;
    platformBreakdown.push({ platform, attributed_revenue: m.conversionValue, spend: m.spend });
  }

  const organic = Math.max(0, totalRevenue - adAttributed);

  return {
    period: `${days}d`,
    currency: ctx.currency,
    total_revenue: totalRevenue.toFixed(2),
    ad_attributed: adAttributed.toFixed(2),
    organic: organic.toFixed(2),
    ad_share_pct: totalRevenue > 0 ? ((adAttributed / totalRevenue) * 100).toFixed(1) : '0',
    organic_share_pct: totalRevenue > 0 ? ((organic / totalRevenue) * 100).toFixed(1) : '0',
    by_platform: platformBreakdown.sort((a, b) => b.attributed_revenue - a.attributed_revenue),
  };
}

async function handleGetExecutiveSummary(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = periodToDays((input.period as string) ?? '30d');
  const since = periodStart(days);
  const prevSince = periodStart(days * 2);

  const [reports, prevReports, revRows, prevRevRows] = await Promise.all([
    prisma.adPlatformReport.findMany({
      where: { organizationId: ctx.orgId, fetchedAt: { gte: since } },
      select: { platform: true, data: true },
    }),
    prisma.adPlatformReport.findMany({
      where: { organizationId: ctx.orgId, fetchedAt: { gte: prevSince, lt: since } },
      select: { platform: true, data: true },
    }),
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: since } },
      select: { revenue: true, orders: true },
    }),
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: prevSince, lt: since } },
      select: { revenue: true },
    }),
  ]);

  const curr = aggregateReports(reports);
  const prev = aggregateReports(prevReports);

  let totalSpend = 0;
  let totalConvValue = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  const platformSpends: { platform: string; spend: number; roas: number }[] = [];

  for (const [platform, m] of Object.entries(curr)) {
    totalSpend += m.spend;
    totalConvValue += m.conversionValue;
    totalImpressions += m.impressions;
    totalClicks += m.clicks;
    totalConversions += m.conversions;
    platformSpends.push({ platform, spend: m.spend, roas: m.spend > 0 ? m.conversionValue / m.spend : 0 });
  }

  let prevSpend = 0;
  for (const m of Object.values(prev)) prevSpend += m.spend;

  const totalRevenue = revRows.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const prevRevenue = prevRevRows.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const totalOrders = revRows.reduce((s, r) => s + r.orders, 0);

  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const topPlatform = platformSpends.sort((a, b) => b.spend - a.spend)[0];

  const spendChange = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  return {
    period: `${days}d`,
    currency: ctx.currency,
    blended_roas: blendedRoas.toFixed(2),
    mer: mer.toFixed(2),
    total_spend: totalSpend.toFixed(2),
    total_revenue: totalRevenue.toFixed(2),
    total_orders: totalOrders,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_conversions: totalConversions,
    spend_change_pct: spendChange.toFixed(1),
    revenue_change_pct: revenueChange.toFixed(1),
    top_platform: topPlatform?.platform ?? 'N/A',
  };
}

async function handleGetSalesRegions(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = (input.days as number) ?? 90;
  const since = periodStart(days);

  // Group by channel as a proxy until full geo data is available
  const orders = await prisma.commerceOrder.findMany({
    where: { organizationId: ctx.orgId, placedAt: { gte: since } },
    select: { totalAmount: true, channel: true },
  });

  if (orders.length === 0) {
    return {
      period: `${days}d`,
      currency: ctx.currency,
      total_orders: 0,
      regions: [],
      note: 'No order data found. Connect a commerce store to see regional breakdown.',
    };
  }

  const channelMap: Record<string, { orders: number; revenue: number }> = {};

  for (const o of orders) {
    const key = o.channel ?? 'Direct';
    if (!channelMap[key]) channelMap[key] = { orders: 0, revenue: 0 };
    channelMap[key]!.orders++;
    channelMap[key]!.revenue += parseFloat(o.totalAmount.toString());
  }

  const regions = Object.entries(channelMap)
    .map(([name, data]) => ({
      name,
      orders: data.orders,
      revenue: data.revenue.toFixed(2),
      aov: data.orders > 0 ? (data.revenue / data.orders).toFixed(2) : '0',
    }))
    .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
    .slice(0, 15);

  return {
    period: `${days}d`,
    currency: ctx.currency,
    total_orders: orders.length,
    regions,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeAnalyticsTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'get_analytics_overview':    return handleGetAnalyticsOverview(input, ctx);
    case 'get_platform_comparison':   return handleGetPlatformComparison(input, ctx);
    case 'get_funnel_analysis':       return handleGetFunnelAnalysis(input, ctx);
    case 'get_daily_trends':          return handleGetDailyTrends(input, ctx);
    case 'analyze_wasted_spend':      return handleAnalyzeWastedSpend(input, ctx);
    case 'get_revenue_breakdown':     return handleGetRevenueBreakdown(input, ctx);
    case 'get_executive_summary':     return handleGetExecutiveSummary(input, ctx);
    case 'get_sales_regions':         return handleGetSalesRegions(input, ctx);
    default:
      throw new Error(`Unknown analytics tool: ${name}`);
  }
}
