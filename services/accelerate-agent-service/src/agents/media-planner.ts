/**
 * AI Media Planning Pipeline — 5-Agent Sequential Architecture.
 *
 * Each agent is a Claude call with specialized tools and a system prompt.
 * Agents reason about data; they don't just run math.
 *
 * Pipeline:
 *   SCOUT  → Client Assessment    (profile + current spend)
 *   PULSE  → Demand Analysis      (platform demand ceilings, campaign types)
 *   RADAR  → Historical Analysis  (winners, bleeders, trends, diminishing returns)
 *   EDGE   → Budget Allocation    (marginal return optimization)
 *   ORACLE → Prediction           (clicks, conversions, revenue, ROAS)
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaPlannerAgentName = 'scout' | 'pulse' | 'radar' | 'edge' | 'oracle';

export type MediaPlannerProgressEvent =
  | { agent: MediaPlannerAgentName; status: 'running'; activity: string }
  | { agent: MediaPlannerAgentName; status: 'complete'; duration: number; findings: string[] }
  | { agent: MediaPlannerAgentName; status: 'error'; message: string };

export type MediaPlanResult = {
  plan: {
    total_budget: number;
    objective: string;
    selected_platforms: string[] | null;
    generated_at: string;
  };
  agents: {
    scout: Record<string, unknown>;
    pulse: Record<string, unknown>;
    radar: Record<string, unknown>;
    edge: Record<string, unknown>;
    oracle: Record<string, unknown>;
  };
  rich_content: unknown[];
  total_duration_seconds: number;
};

// ---------------------------------------------------------------------------
// Tool implementations — Prisma data sources
// ---------------------------------------------------------------------------

async function toolGetClientProfile(orgId: string): Promise<Record<string, unknown>> {
  try {
    const [org, accounts, campaigns, revenueRows, orderCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, currency: true },
      }),
      prisma.connectedAdAccount.findMany({
        where: { organizationId: orgId, archivedAt: null },
        select: { platform: true, accountName: true, status: true, currency: true },
      }),
      prisma.campaign.findMany({
        where: { organizationId: orgId, archivedAt: null },
        select: { name: true, objective: true, totalBudget: true, status: true },
        take: 20,
      }),
      prisma.dailyRevenueSummary.findMany({
        where: {
          organizationId: orgId,
          date: { gte: new Date(Date.now() - 90 * 86400_000) },
        },
        select: { revenue: true, orders: true },
      }),
      prisma.commerceOrder.count({
        where: { organizationId: orgId },
      }),
    ]);

    const totalRevenue = revenueRows.reduce((s, r) => s + Number(r.revenue), 0);
    const totalOrders = revenueRows.reduce((s, r) => s + r.orders, 0);
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const monthlyRevenue = totalRevenue / 3; // 90-day window → monthly estimate

    const connectedPlatforms = accounts
      .filter((a) => a.status === 'connected')
      .map((a) => ({ platform: a.platform, accountName: a.accountName, currency: a.currency }));

    return {
      org_name: org?.name,
      currency: org?.currency ?? 'USD',
      aov: Math.round(aov * 100) / 100,
      monthly_revenue: Math.round(monthlyRevenue),
      total_orders_all_time: orderCount,
      connected_platforms: connectedPlatforms,
      active_campaigns: campaigns.filter((c) => c.status === 'LIVE').length,
      total_campaigns: campaigns.length,
      campaign_objectives: [...new Set(campaigns.map((c) => c.objective).filter(Boolean))],
    };
  } catch (e) {
    return { error: String(e) };
  }
}

async function toolQueryPerformance(
  orgId: string,
  queryType: string,
  params: { days?: number; platform?: string } = {},
): Promise<Record<string, unknown>> {
  const days = params.days ?? 90;
  const since = new Date(Date.now() - days * 86400_000);

  try {
    // Fetch all platform reports for the org within the window
    const reports = await prisma.adPlatformReport.findMany({
      where: {
        organizationId: orgId,
        archivedAt: null,
        fetchedAt: { gte: since },
        ...(params.platform ? { platform: params.platform } : {}),
      },
      select: { platform: true, reportType: true, data: true, fetchedAt: true },
      orderBy: { fetchedAt: 'desc' },
    });

    // Aggregate data field rows by platform
    type PlatformAgg = {
      spend: number; clicks: number; impressions: number;
      conversions: number; revenue: number; count: number;
    };
    const byPlatform: Record<string, PlatformAgg> = {};

    for (const report of reports) {
      const rows = Array.isArray(report.data) ? report.data : [report.data];
      const platform = report.platform;
      if (!byPlatform[platform]) {
        byPlatform[platform] = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, count: 0 };
      }
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        byPlatform[platform].spend += Number(r.spend ?? r.cost ?? 0);
        byPlatform[platform].clicks += Number(r.clicks ?? 0);
        byPlatform[platform].impressions += Number(r.impressions ?? 0);
        byPlatform[platform].conversions += Number(r.conversions ?? r.purchases ?? 0);
        byPlatform[platform].revenue += Number(r.revenue ?? r.conversion_value ?? r.conversions_value ?? 0);
        byPlatform[platform].count += 1;
      }
    }

    const platforms = Object.entries(byPlatform).map(([platform, agg]) => {
      const cpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0;
      const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      const cvr = agg.clicks > 0 ? (agg.conversions / agg.clicks) * 100 : 0;
      const cpa = agg.conversions > 0 ? agg.spend / agg.conversions : 0;
      const roas = agg.spend > 0 ? agg.revenue / agg.spend : 0;
      const monthlySpend = agg.spend / (days / 30);
      return {
        platform,
        spend: Math.round(agg.spend * 100) / 100,
        monthly_spend: Math.round(monthlySpend * 100) / 100,
        clicks: agg.clicks,
        impressions: agg.impressions,
        conversions: Math.round(agg.conversions * 10) / 10,
        revenue: Math.round(agg.revenue * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        ctr: Math.round(ctr * 100) / 100,
        cvr: Math.round(cvr * 100) / 100,
        cpa: Math.round(cpa * 100) / 100,
        roas: Math.round(roas * 100) / 100,
      };
    });

    if (queryType === 'platform_performance') {
      return { platforms, days };
    }

    if (queryType === 'weekly_trends') {
      const revenueSummary = await prisma.dailyRevenueSummary.findMany({
        where: {
          organizationId: orgId,
          date: { gte: since },
        },
        select: { date: true, revenue: true, orders: true, channel: true },
        orderBy: { date: 'asc' },
      });
      // Group by week
      type WeekAgg = { revenue: number; orders: number };
      const byWeek: Record<string, WeekAgg> = {};
      for (const row of revenueSummary) {
        const d = new Date(row.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split('T')[0];
        if (!byWeek[key]) byWeek[key] = { revenue: 0, orders: 0 };
        byWeek[key].revenue += Number(row.revenue);
        byWeek[key].orders += row.orders;
      }
      const trends = Object.entries(byWeek).map(([week, agg]) => ({ week, ...agg }));
      return { trends, days };
    }

    if (queryType === 'campaign_performance') {
      const campaigns = await prisma.platformCampaign.findMany({
        where: {
          campaign: { organizationId: orgId },
          ...(params.platform ? { platform: params.platform } : {}),
        },
        select: {
          platform: true,
          status: true,
          budget: true,
          campaign: { select: { name: true, objective: true } },
        },
        take: 20,
      });
      return {
        campaigns: campaigns.map((c) => ({
          platform: c.platform,
          name: c.campaign.name,
          objective: c.campaign.objective,
          budget: Number(c.budget),
          status: c.status,
        })),
        days,
      };
    }

    // Default: return platform performance
    return { platforms, days };
  } catch (e) {
    return { error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Agent tool schemas
// ---------------------------------------------------------------------------

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_performance',
    description:
      'Query advertising performance data. query_type options: platform_performance (aggregate spend/ROAS/CPA by platform), weekly_trends (weekly revenue trends), campaign_performance (individual campaign stats). Use params.days for lookback (default 90). Use params.platform to filter to one platform (google, meta, bing).',
    input_schema: {
      type: 'object',
      properties: {
        query_type: { type: 'string', description: 'Type of query' },
        params: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Lookback days (default 90)' },
            platform: { type: 'string', description: 'Filter to platform' },
          },
        },
      },
      required: ['query_type'],
    },
  },
  {
    name: 'get_client_profile',
    description:
      "Get the client's full profile: org name, currency, average order value, monthly revenue, connected ad platforms, and campaign counts.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ---------------------------------------------------------------------------
// Agent system prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  agentName: MediaPlannerAgentName,
  previousOutputs: Record<string, unknown>,
  budget: number,
  objective: string,
): string {
  const context = Object.keys(previousOutputs).length > 0
    ? JSON.stringify(previousOutputs, null, 2)
    : '{}';

  const prompts: Record<MediaPlannerAgentName, string> = {
    scout: `You are SCOUT — the Strategy & Client Operations lead on Accelerate's AI marketing team.

You know every client inside and out. You pull their data, understand their brand, and set the foundation for every plan. You're sharp, thorough, and speak with confidence because you've done the homework.

Your job: Build a comprehensive client profile by calling both tools:
1. get_client_profile — brand, products, ecommerce metrics, connected platforms
2. query_performance with query_type="platform_performance" — actual ad performance

Produce a structured assessment JSON:
{
  "business_type": "ecommerce" | "saas" | "local_business" | "lead_gen",
  "industry": "fashion" | "electronics" | "beauty" | "health" | "food" | "services" | "other",
  "aov": <number>,
  "monthly_revenue": <number>,
  "connected_platforms": ["google", "meta", "bing"],
  "has_historical_data": true/false,
  "brand_tone": "<tone>",
  "current_monthly_spend": <number>,
  "current_blended_roas": <number>,
  "strengths": ["<max 3, one sentence each>"],
  "weaknesses": ["<max 3, one sentence each>"],
  "opportunities": ["<max 3, one sentence each>"]
}

Use actual numbers from the data. Keep strengths/weaknesses/opportunities to MAX 3 bullet points, one sentence each.`,

    pulse: `You are PULSE — Accelerate's Market Intelligence specialist.

You live and breathe market demand. You can feel the pulse of demand across platforms — where buyers are searching, what audiences are hungry, where untapped gold is hiding.

The client wants to spend $${budget.toLocaleString()} with objective: ${objective}.

Previous agent output (client assessment):
${context}

Your job: Query campaign_performance data per platform, then reason about:
1. Search demand ceiling — Based on data, what's the max effective search budget?
2. Campaign type recommendations — For each connected platform, which campaign types make sense:
   - Google: PMax, Search (RSA), Responsive Display (RDA)
   - Meta: Advantage+, Retargeting
   - Bing: Search (RSA)
3. Platform priority — Which platforms should get the most budget and why?

Call query_performance with query_type="campaign_performance" for each connected platform.

Output JSON:
{
  "search_demand_ceiling_monthly": <number>,
  "social_demand_ceiling_monthly": <number>,
  "recommended_campaign_types": {
    "google": [{"type": "pmax", "reason": "...", "budget_pct": 0.30}],
    "meta": [{"type": "advantage_plus", "reason": "...", "budget_pct": 0.25}],
    "bing": [{"type": "search", "reason": "...", "budget_pct": 0.10}]
  },
  "platform_priority": ["google", "meta", "bing"],
  "reasoning": "<2-3 sentences on why this allocation>"
}`,

    radar: `You are RADAR — Accelerate's Performance Analytics lead.

Nothing gets past you. You spot winners before they peak and catch bleeders before they drain the budget.

Budget: $${budget.toLocaleString()} | Objective: ${objective}

Previous agent outputs:
${context}

Query: platform_performance, campaign_performance, weekly_trends.

Analyze:
1. Platform baselines — Actual CPC, CVR, CPA, ROAS per platform
2. Winners vs bleeders — Which campaigns are performing well vs wasting money
3. Trends — Is performance improving or declining?
4. Diminishing returns signals — Is CPA rising as spend increases?

Output JSON:
{
  "platform_baselines": {
    "google": {"cpc": X, "cvr": X, "cpa": X, "roas": X, "monthly_spend": X, "trend": "improving|stable|declining"},
    "meta": {"cpc": X, "cvr": X, "cpa": X, "roas": X, "monthly_spend": X, "trend": "..."},
    "bing": {"cpc": X, "cvr": X, "cpa": X, "roas": X, "monthly_spend": X, "trend": "..."}
  },
  "winners": [{"name": "...", "platform": "...", "roas": X, "reason": "..."}],
  "bleeders": [{"name": "...", "platform": "...", "roas": X, "issue": "..."}],
  "diminishing_returns": {"google": "low|medium|high", "meta": "...", "bing": "..."},
  "recommendations": ["pause X", "scale Y", "test Z"]
}`,

    edge: `You are EDGE — Accelerate's Budget Optimization chief.

You treat every dollar like it's your own money. You figure out exactly where each dollar produces the highest return. You think in marginals — the NEXT dollar, not the average dollar.

Total Budget: $${budget.toLocaleString()}/month | Objective: ${objective}

Previous agent outputs (assessment + demand analysis + historical performance):
${context}

Rules:
- Each dollar goes to the channel where it produces the highest incremental return
- Cap any single channel at 45% of budget
- Every connected platform MUST receive at least 10% of budget
- If historical data shows ROAS < 0.5x, reduce to minimum 5%
- If a platform shows strong ROAS (> 3x), it gets more budget
- Consider campaign types within each platform
- Account for diminishing returns as spend increases

Output JSON:
{
  "allocations": [
    {
      "channel": "google_search",
      "label": "Google Search (RSA)",
      "platform": "google",
      "campaign_type": "search",
      "budget": <dollars>,
      "pct": <percentage 0-100>,
      "reasoning": "<why this amount>",
      "expected_cpc": X,
      "expected_cvr": X,
      "data_source": "historical" | "benchmark"
    }
  ],
  "total_budget": ${budget},
  "allocation_reasoning": "<overall strategy explanation>",
  "key_trade_offs": ["<trade-off 1>", "<trade-off 2>"]
}`,

    oracle: `You are ORACLE — Accelerate's Forecasting specialist.

You see around corners. You take everything the team has gathered and paint a picture of what's going to happen. Not guesses — predictions grounded in data with honest confidence intervals.

Budget: $${budget.toLocaleString()}/month | Objective: ${objective}

All previous agent outputs:
${context}

For EACH channel in the allocation, calculate:
- Predicted Clicks = Budget ÷ Expected CPC
- Predicted Conversions = Clicks × CVR (from historical or benchmark)
- Predicted Revenue = Conversions × AOV (use aov from scout output)
- Predicted ROAS = Revenue ÷ Budget
- Confidence = "high" (historical data, ±15%) or "medium" (benchmark, ±30%)

Output JSON:
{
  "predictions": [
    {
      "channel": "google_search",
      "label": "Google Search (RSA)",
      "budget": X,
      "predicted_clicks": X,
      "predicted_conversions": X,
      "predicted_revenue": X,
      "predicted_roas": X,
      "predicted_cpa": X,
      "confidence": "high" | "medium",
      "data_source": "historical" | "benchmark"
    }
  ],
  "blended_totals": {
    "budget": X,
    "clicks": X,
    "conversions": X,
    "revenue": X,
    "roas": X,
    "cpa": X,
    "revenue_range_low": X,
    "revenue_range_high": X
  },
  "key_assumptions": ["assumption 1", "assumption 2"],
  "risks": ["risk 1", "risk 2"]
}`,
  };

  return prompts[agentName];
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/,
    /```\s*\n([\s\S]*?)\n```/,
    /(\{[\s\S]*\})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try { return JSON.parse(match[1]); } catch { /* fall through */ }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Key findings extractor (for SSE progress events)
// ---------------------------------------------------------------------------

function extractFindings(agentName: MediaPlannerAgentName, output: Record<string, unknown> | null): string[] {
  if (!output) return [];
  const findings: string[] = [];

  if (agentName === 'scout') {
    if (output.aov) findings.push(`AOV: $${Number(output.aov).toLocaleString()}`);
    const platforms = output.connected_platforms as string[] | undefined;
    if (platforms?.length) findings.push(`Platforms: ${platforms.join(', ')}`);
    if (output.current_blended_roas) findings.push(`Current ROAS: ${Number(output.current_blended_roas).toFixed(1)}x`);
    if (output.current_monthly_spend) findings.push(`Monthly spend: $${Number(output.current_monthly_spend).toLocaleString()}`);
  } else if (agentName === 'pulse') {
    if (output.search_demand_ceiling_monthly) findings.push(`Search ceiling: $${Number(output.search_demand_ceiling_monthly).toLocaleString()}/mo`);
    const priority = output.platform_priority as string[] | undefined;
    if (priority?.length) findings.push(`Priority: ${priority.slice(0, 3).join(' → ')}`);
  } else if (agentName === 'radar') {
    const winners = output.winners as Array<{ name?: string; roas?: number }> | undefined;
    if (winners?.length) findings.push(`Top performer: ${winners[0].name} (${winners[0].roas?.toFixed(1)}x ROAS)`);
    const bleeders = output.bleeders as unknown[] | undefined;
    if (bleeders?.length) findings.push(`${bleeders.length} campaign${bleeders.length > 1 ? 's' : ''} underperforming`);
  } else if (agentName === 'edge') {
    const allocs = output.allocations as Array<{ label?: string; pct?: number; budget?: number }> | undefined;
    if (allocs?.length) {
      for (const a of allocs.slice(0, 3)) {
        findings.push(`${a.label}: ${a.pct?.toFixed(0)}% ($${Number(a.budget).toLocaleString()}/mo)`);
      }
    }
  } else if (agentName === 'oracle') {
    const totals = output.blended_totals as { roas?: number; revenue?: number; conversions?: number } | undefined;
    if (totals) {
      if (totals.roas) findings.push(`Predicted ROAS: ${totals.roas.toFixed(1)}x`);
      if (totals.revenue) findings.push(`Projected revenue: $${Number(totals.revenue).toLocaleString()}/mo`);
      if (totals.conversions) findings.push(`Expected conversions: ${Number(totals.conversions).toFixed(0)}/mo`);
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Single agent runner
// ---------------------------------------------------------------------------

async function runAgent(
  agentName: MediaPlannerAgentName,
  orgId: string,
  previousOutputs: Record<string, unknown>,
  budget: number,
  objective: string,
  progressCallback?: (event: MediaPlannerProgressEvent) => void,
  skipTools = false,
): Promise<{ output: Record<string, unknown> | null; duration: number }> {
  const systemPrompt = buildSystemPrompt(agentName, previousOutputs, budget, objective);
  const start = Date.now();
  let toolCalls = 0;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Analyze the data and produce your structured JSON assessment. Call the tools you need first.',
    },
  ];

  for (let iteration = 0; iteration < 6; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      ...(skipTools ? {} : { tools: AGENT_TOOLS }),
    });

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        toolCalls++;
        const input = block.input as { query_type?: string; params?: { days?: number; platform?: string } };

        // Notify activity
        let activity = `Running ${block.name}...`;
        if (block.name === 'query_performance') {
          const qtype = input.query_type ?? 'platform_performance';
          const activityMap: Record<string, string> = {
            platform_performance: 'Pulling platform performance data...',
            weekly_trends: 'Reviewing weekly spend & revenue trends...',
            campaign_performance: 'Analyzing campaign-level metrics...',
          };
          activity = activityMap[qtype] ?? `Querying ${qtype.replace(/_/g, ' ')}...`;
        } else if (block.name === 'get_client_profile') {
          activity = 'Loading client profile, commerce data & connections...';
        }
        progressCallback?.({ agent: agentName, status: 'running', activity });

        // Execute tool
        let result: Record<string, unknown>;
        if (block.name === 'query_performance') {
          result = await toolQueryPerformance(orgId, input.query_type ?? 'platform_performance', input.params ?? {});
        } else if (block.name === 'get_client_profile') {
          result = await toolGetClientProfile(orgId);
        } else {
          result = { error: `Unknown tool: ${block.name}` };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Final response
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const output = extractJson(text);
    const duration = (Date.now() - start) / 1000;
    return { output, duration };
  }

  return { output: null, duration: (Date.now() - start) / 1000 };
}

// ---------------------------------------------------------------------------
// Rich content builder
// ---------------------------------------------------------------------------

function buildRichContent(
  agentOutputs: Record<string, unknown>,
  budget: number,
  objective: string,
): unknown[] {
  const rich: unknown[] = [];

  const toDict = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

  const scout = toDict(agentOutputs.scout);
  const edge = toDict(agentOutputs.edge);
  const oracle = toDict(agentOutputs.oracle);

  // 1. KPI overview card
  const kpiItems: unknown[] = [];
  if (scout.aov) kpiItems.push({ label: 'AOV', value: `$${Number(scout.aov).toLocaleString()}`, icon: 'cart' });
  if (scout.current_blended_roas) kpiItems.push({ label: 'Current ROAS', value: `${Number(scout.current_blended_roas).toFixed(1)}x`, icon: 'chart' });
  if (scout.current_monthly_spend) kpiItems.push({ label: 'Current Spend', value: `$${Number(scout.current_monthly_spend).toLocaleString()}/mo`, icon: 'dollar' });
  kpiItems.push({ label: 'Plan Budget', value: `$${budget.toLocaleString()}/mo`, sub_value: `$${Math.round(budget / 30).toLocaleString()}/day`, icon: 'target' });
  if (kpiItems.length > 0) {
    rich.push({ type: 'kpi_cards', items: kpiItems });
  }

  // 2. Budget allocation card
  const allocs = (edge.allocations as unknown[]) ?? [];
  if (allocs.length > 0) {
    rich.push({
      type: 'budget_allocation',
      title: `AI-Optimized Plan — ${objective.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
      total_daily: Math.round(budget / 30 * 100) / 100,
      total_monthly: budget,
      context: edge.allocation_reasoning ?? '',
      items: allocs.map((a) => {
        const alloc = toDict(a);
        const src = String(alloc.data_source ?? 'benchmark').toLowerCase();
        return {
          platform: alloc.label ?? alloc.channel,
          label: alloc.label ?? alloc.channel,
          value: Number(alloc.budget ?? 0),
          daily_value: Math.round(Number(alloc.budget ?? 0) / 30 * 100) / 100,
          badge: src === 'historical' ? 'Historical' : 'Benchmark',
          description: alloc.reasoning ?? `${Number(alloc.pct ?? 0).toFixed(0)}% of budget · ${alloc.campaign_type ?? ''}`,
        };
      }),
    });
  }

  // 3. Revenue prediction
  const totals = toDict(oracle.blended_totals);
  if (totals.revenue) {
    const rev = Number(totals.revenue);
    const roas = Number(totals.roas ?? 0);
    const revLow = Number(totals.revenue_range_low ?? rev * 0.8);
    const revHigh = Number(totals.revenue_range_high ?? rev * 1.2);
    rich.push({
      type: 'metric_highlight',
      label: 'Monthly Revenue Projection',
      value: `$${Math.round(rev).toLocaleString()}`,
      context: `At ${roas.toFixed(1)}x blended ROAS · 80% CI: $${Math.round(revLow).toLocaleString()}–$${Math.round(revHigh).toLocaleString()}`,
      color: roas >= 2 ? '#10B981' : roas >= 1 ? '#F59E0B' : '#EF4444',
      sub_metrics: [
        { label: 'Conversions', value: `${Number(totals.conversions ?? 0).toFixed(0)}` },
        { label: 'CPA', value: `$${Number(totals.cpa ?? 0).toFixed(0)}` },
        { label: 'Clicks', value: `${Number(totals.clicks ?? 0).toLocaleString()}` },
      ],
    });
  }

  // 4. Platform comparison
  const preds = (oracle.predictions as unknown[]) ?? [];
  if (preds.length > 0) {
    rich.push({
      type: 'platform_comparison',
      title: 'Predicted Performance by Channel',
      items: preds.map((p) => {
        const pred = toDict(p);
        const clicks = Number(pred.predicted_clicks ?? 0);
        const convs = Number(pred.predicted_conversions ?? 0);
        return {
          platform: pred.label ?? pred.channel,
          spend: Number(pred.budget ?? 0),
          revenue: Number(pred.predicted_revenue ?? 0),
          roas: `${Number(pred.predicted_roas ?? 0).toFixed(1)}x`,
          description: `${Math.round(clicks).toLocaleString()} clicks · ${Math.round(convs).toLocaleString()} conv · ${pred.confidence ?? 'medium'} confidence`,
        };
      }),
    });
  }

  return rich;
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

export async function runMediaPlanningPipeline(params: {
  orgId: string;
  budget: number;
  objective: string;
  selectedPlatforms?: string[];
  progressCallback?: (event: MediaPlannerProgressEvent) => void;
}): Promise<MediaPlanResult> {
  const { orgId, budget, objective, selectedPlatforms, progressCallback } = params;
  const pipelineStart = Date.now();

  const agentOutputs: Record<string, unknown> = {};

  const AGENTS: MediaPlannerAgentName[] = ['scout', 'pulse', 'radar', 'edge', 'oracle'];

  for (const agentName of AGENTS) {
    progressCallback?.({ agent: agentName, status: 'running', activity: 'Starting analysis...' });

    // Inject selected platforms constraint for EDGE
    if (agentName === 'edge' && selectedPlatforms?.length) {
      agentOutputs._selected_platforms = selectedPlatforms;
    }

    const skipTools = agentName === 'oracle'; // ORACLE has all data from previous agents
    const { output, duration } = await runAgent(
      agentName,
      orgId,
      { ...agentOutputs },
      budget,
      objective,
      progressCallback,
      skipTools,
    );

    agentOutputs[agentName] = output ?? {};
    const findings = extractFindings(agentName, output);
    progressCallback?.({ agent: agentName, status: 'complete', duration, findings });
  }

  const rich_content = buildRichContent(agentOutputs, budget, objective);
  const totalDuration = (Date.now() - pipelineStart) / 1000;

  return {
    plan: {
      total_budget: budget,
      objective,
      selected_platforms: selectedPlatforms ?? null,
      generated_at: new Date().toISOString(),
    },
    agents: {
      scout: (agentOutputs.scout ?? {}) as Record<string, unknown>,
      pulse: (agentOutputs.pulse ?? {}) as Record<string, unknown>,
      radar: (agentOutputs.radar ?? {}) as Record<string, unknown>,
      edge: (agentOutputs.edge ?? {}) as Record<string, unknown>,
      oracle: (agentOutputs.oracle ?? {}) as Record<string, unknown>,
    },
    rich_content,
    total_duration_seconds: Math.round(totalDuration * 10) / 10,
  };
}
