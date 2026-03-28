/**
 * AI CMO API — Strategic Marketing Intelligence
 *
 * GET /api/cmo?action=brief&orgId=...       — Daily cross-platform snapshot
 * GET /api/cmo?action=health&orgId=...      — Health score 0-100
 * GET /api/cmo?action=forecast&orgId=...&days=30 — Revenue/ROAS forecast
 * GET /api/cmo?action=dashboard&orgId=...   — Blended cross-platform dashboard
 * POST /api/cmo (body: { action: 'ask', question, orgId }) — NL question
 * POST /api/cmo (body: { action: 'plan', orgId, goals, budget }) — Strategic plan
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';
import { getAuthOrganizationContext } from '@workspace/auth/context';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function getPerformanceData(orgId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);

  const [reports, revenue, campaigns, connectedAccounts] = await Promise.all([
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, archivedAt: null, fetchedAt: { gte: since } },
      select: { platform: true, data: true, fetchedAt: true },
    }),
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: orgId, date: { gte: since } },
      select: { date: true, revenue: true, orders: true, channel: true },
      orderBy: { date: 'asc' },
    }),
    prisma.platformCampaign.findMany({
      where: { campaign: { organizationId: orgId } },
      select: { platform: true, status: true, budget: true, campaign: { select: { name: true, objective: true } } },
    }),
    prisma.connectedAdAccount.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { platform: true, status: true },
    }),
  ]);

  // Aggregate by platform
  type PlatformAgg = { spend: number; clicks: number; impressions: number; conversions: number; revenue: number };
  const byPlatform: Record<string, PlatformAgg> = {};

  for (const report of reports) {
    const rows = Array.isArray(report.data) ? report.data : [report.data];
    if (!byPlatform[report.platform]) {
      byPlatform[report.platform] = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 };
    }
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      byPlatform[report.platform].spend += Number(r.spend ?? r.cost ?? 0);
      byPlatform[report.platform].clicks += Number(r.clicks ?? 0);
      byPlatform[report.platform].impressions += Number(r.impressions ?? 0);
      byPlatform[report.platform].conversions += Number(r.conversions ?? r.purchases ?? 0);
      byPlatform[report.platform].revenue += Number(r.revenue ?? r.conversion_value ?? 0);
    }
  }

  const platformStats = Object.entries(byPlatform).map(([platform, agg]) => ({
    platform,
    spend: Math.round(agg.spend * 100) / 100,
    clicks: agg.clicks,
    impressions: agg.impressions,
    conversions: Math.round(agg.conversions * 10) / 10,
    revenue: Math.round(agg.revenue * 100) / 100,
    roas: agg.spend > 0 ? Math.round((agg.revenue / agg.spend) * 100) / 100 : 0,
    cpa: agg.conversions > 0 ? Math.round((agg.spend / agg.conversions) * 100) / 100 : 0,
    ctr: agg.impressions > 0 ? Math.round((agg.clicks / agg.impressions) * 10000) / 100 : 0,
    campaign_count: campaigns.filter((c) => c.platform === platform).length,
    active_campaigns: campaigns.filter((c) => c.platform === platform && c.status === 'active').length,
  }));

  const totalRevenue = revenue.reduce((s: number, r: { revenue: { toString(): string } }) => s + Number(r.revenue), 0);
  const totalOrders = revenue.reduce((s: number, r: { orders: number }) => s + r.orders, 0);
  const totalSpend = platformStats.reduce((s: number, p: { spend: number }) => s + p.spend, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const connectedPlatforms = connectedAccounts
    .filter((a) => a.status === 'connected')
    .map((a) => a.platform);

  return {
    days,
    total_spend: Math.round(totalSpend * 100) / 100,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_orders: totalOrders,
    blended_roas: Math.round(blendedRoas * 100) / 100,
    platforms: platformStats,
    revenue_trend: revenue,
    connected_platforms: connectedPlatforms,
    active_campaigns: campaigns.filter((c) => c.status === 'active').length,
  };
}

// ---------------------------------------------------------------------------
// CMO actions
// ---------------------------------------------------------------------------

async function getBrief(orgId: string) {
  const data = await getPerformanceData(orgId, 7);

  const prompt = `You are the AI CMO for this brand's marketing operations. Produce a concise daily marketing brief based on the last 7 days of data.

Data:
${JSON.stringify(data, null, 2)}

Write a brief with:
1. Executive headline (1 sentence — the most important thing)
2. Key numbers: total spend, revenue, ROAS
3. Platform breakdown (1 line per active platform)
4. Top priority action for today
5. Watch out for (any concern)

Keep it under 200 words. Write like a CMO briefing a CEO — direct, confident, no fluff.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';

  return {
    action: 'brief',
    period: '7d',
    summary: {
      total_spend: data.total_spend,
      total_revenue: data.total_revenue,
      blended_roas: data.blended_roas,
      platforms: data.platforms.length,
    },
    brief: text,
    generated_at: new Date().toISOString(),
  };
}

async function getHealth(orgId: string) {
  const [recent, prior] = await Promise.all([
    getPerformanceData(orgId, 7),
    getPerformanceData(orgId, 30),
  ]);

  const scores: Record<string, { score: number; max: number; label: string; detail: string }> = {};

  // 1. Spend efficiency (ROAS) — 0-20 pts
  const roas = recent.blended_roas;
  let roasScore = 0;
  let roasLabel = '';
  if (roas >= 4) { roasScore = 20; roasLabel = 'Excellent ROAS'; }
  else if (roas >= 3) { roasScore = 16; roasLabel = 'Strong ROAS'; }
  else if (roas >= 2) { roasScore = 12; roasLabel = 'Good ROAS'; }
  else if (roas >= 1) { roasScore = 7; roasLabel = 'Break-even'; }
  else if (roas > 0) { roasScore = 3; roasLabel = 'Losing money'; }
  else { roasScore = 0; roasLabel = 'No revenue data'; }

  // Trend bonus
  const priorRoas = prior.blended_roas;
  if (priorRoas > 0 && roas > priorRoas) { roasScore = Math.min(20, roasScore + 2); roasLabel += ' (improving)'; }
  else if (priorRoas > 0 && roas < priorRoas * 0.8) { roasScore = Math.max(0, roasScore - 2); roasLabel += ' (declining)'; }
  scores.spend_efficiency = { score: roasScore, max: 20, label: roasLabel, detail: `7d ROAS: ${roas.toFixed(2)}x, 30d ROAS: ${priorRoas.toFixed(2)}x` };

  // 2. Audience health (segment coverage) — 0-20 pts
  const audienceCount = await prisma.audienceSegment.count({ where: { organizationId: orgId } });
  let audienceScore = 0;
  let audienceLabel = '';
  if (audienceCount >= 5) { audienceScore = 20; audienceLabel = 'Strong audience library'; }
  else if (audienceCount >= 3) { audienceScore = 15; audienceLabel = 'Good segment coverage'; }
  else if (audienceCount >= 1) { audienceScore = 8; audienceLabel = 'Limited audience segments'; }
  else { audienceScore = 0; audienceLabel = 'No audience segments — create some'; }
  scores.audience_health = { score: audienceScore, max: 20, label: audienceLabel, detail: `${audienceCount} audience segment${audienceCount !== 1 ? 's' : ''} configured` };

  // 3. Creative performance (CTR) — 0-20 pts
  const blendedCtr = recent.platforms.length > 0
    ? recent.platforms.reduce((s, p) => s + p.ctr, 0) / recent.platforms.length
    : 0;
  let creativeScore = 0;
  let creativeLabel = '';
  if (blendedCtr >= 3) { creativeScore = 20; creativeLabel = 'High-performing creatives'; }
  else if (blendedCtr >= 1.5) { creativeScore = 15; creativeLabel = 'Good creative performance'; }
  else if (blendedCtr >= 0.5) { creativeScore = 8; creativeLabel = 'Average CTR — test new creatives'; }
  else if (blendedCtr > 0) { creativeScore = 4; creativeLabel = 'Low CTR — refresh creatives'; }
  else { creativeScore = 0; creativeLabel = 'No click data'; }
  scores.creative_performance = { score: creativeScore, max: 20, label: creativeLabel, detail: `Blended CTR: ${blendedCtr.toFixed(2)}%` };

  // 4. Funnel health (conversion rate from clicks) — 0-20 pts
  const totalClicks = recent.platforms.reduce((s, p) => s + p.clicks, 0);
  const totalConversions = recent.platforms.reduce((s, p) => s + p.conversions, 0);
  const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  let funnelScore = 0;
  let funnelLabel = '';
  if (convRate >= 3) { funnelScore = 20; funnelLabel = 'Excellent conversion rate'; }
  else if (convRate >= 1.5) { funnelScore = 15; funnelLabel = 'Good conversion rate'; }
  else if (convRate >= 0.5) { funnelScore = 10; funnelLabel = 'Average conversion rate'; }
  else if (convRate > 0) { funnelScore = 5; funnelLabel = 'Low conversion rate'; }
  else { funnelScore = 0; funnelLabel = 'No conversion data'; }
  scores.funnel_health = { score: funnelScore, max: 20, label: funnelLabel, detail: `Conversion rate: ${convRate.toFixed(2)}% (${totalConversions} conversions from ${totalClicks} clicks)` };

  // 5. Budget pacing — 0-20 pts
  const activePlatforms = recent.platforms.filter((p) => p.spend > 0);
  let pacingScore = 0;
  let pacingLabel = '';
  if (activePlatforms.length >= 3) { pacingScore = 20; pacingLabel = 'Well diversified across 3+ platforms'; }
  else if (activePlatforms.length === 2) { pacingScore = 14; pacingLabel = '2 platforms active — consider adding Bing'; }
  else if (activePlatforms.length === 1) { pacingScore = 7; pacingLabel = 'Single platform — diversify to reduce risk'; }
  else { pacingScore = 0; pacingLabel = 'No active spend detected'; }
  scores.budget_pacing = { score: pacingScore, max: 20, label: pacingLabel, detail: `${activePlatforms.length} platform${activePlatforms.length !== 1 ? 's' : ''} with active spend` };

  const total = Object.values(scores).reduce((s, d) => s + d.score, 0);
  const maxScore = Object.values(scores).reduce((s, d) => s + d.max, 0);
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';

  // Generate recommendations
  const recommendations = Object.entries(scores)
    .filter(([, d]) => d.score < d.max * 0.7)
    .sort(([, a], [, b]) => (a.score / a.max) - (b.score / b.max))
    .slice(0, 3)
    .map(([dim, d]) => ({
      dimension: dim.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      label: d.label,
      priority: d.score / d.max < 0.4 ? 'high' : 'medium',
    }));

  return {
    action: 'health',
    overall_score: total,
    max_score: maxScore,
    grade,
    dimensions: scores,
    recommendations,
    generated_at: new Date().toISOString(),
  };
}

async function getForecast(orgId: string, daysAhead = 30) {
  const historical = await getPerformanceData(orgId, 90);

  const prompt = `You are an expert media forecaster. Based on the last 90 days of advertising performance data, forecast the next ${daysAhead} days.

Historical data (90 days):
${JSON.stringify(historical, null, 2)}

Produce a forecast JSON:
{
  "spend_forecast": <number>,
  "revenue_forecast": <number>,
  "roas_forecast": <number>,
  "conversions_forecast": <number>,
  "revenue_range_low": <number>,
  "revenue_range_high": <number>,
  "confidence": "high" | "medium" | "low",
  "trend": "improving" | "stable" | "declining",
  "weekly_breakdown": [
    {"week": 1, "spend": X, "revenue": X, "roas": X}
  ],
  "key_assumptions": ["assumption 1", "assumption 2"],
  "risks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}

Use the historical ROAS, spend trajectory, and conversion rates to build the forecast. Be honest about uncertainty.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  let forecast: Record<string, unknown> = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) forecast = JSON.parse(match[0]);
  } catch { /* fall through */ }

  return {
    action: 'forecast',
    days_ahead: daysAhead,
    historical_summary: {
      total_spend: historical.total_spend,
      blended_roas: historical.blended_roas,
      monthly_spend: Math.round(historical.total_spend / 3),
    },
    forecast,
    generated_at: new Date().toISOString(),
  };
}

async function getDashboard(orgId: string, days = 30) {
  const [current, previous] = await Promise.all([
    getPerformanceData(orgId, days),
    getPerformanceData(orgId, days * 2),
  ]);

  const pctChange = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

  // Approximate previous period from prev 2x window minus current
  const prevSpend = previous.total_spend - current.total_spend;
  const prevRevenue = previous.total_revenue - current.total_revenue;
  const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;

  return {
    action: 'dashboard',
    period: { days },
    overview: {
      total_spend: current.total_spend,
      total_revenue: current.total_revenue,
      blended_roas: current.blended_roas,
      total_orders: current.total_orders,
      active_campaigns: current.active_campaigns,
    },
    period_comparison: {
      spend_change_pct: pctChange(current.total_spend, prevSpend),
      revenue_change_pct: pctChange(current.total_revenue, prevRevenue),
      roas_change_pct: pctChange(current.blended_roas, prevRoas),
    },
    platforms: current.platforms,
    revenue_trend: current.revenue_trend.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      revenue: Number(r.revenue),
      orders: r.orders,
    })),
    generated_at: new Date().toISOString(),
  };
}

async function askCmo(orgId: string, question: string) {
  const data = await getPerformanceData(orgId, 30);

  const prompt = `You are the AI CMO for this brand. Answer the following marketing question based on the data provided.

Marketing data (last 30 days):
${JSON.stringify(data, null, 2)}

Question: ${question}

Give a direct, insightful answer. Reference specific numbers from the data. If you can't answer from the data provided, say so clearly and explain what data would be needed.

Keep your answer under 150 words. Write like a seasoned CMO — confident, direct, actionable.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const answer = response.content.find((b) => b.type === 'text')?.text ?? '';

  return {
    action: 'ask',
    question,
    answer,
    data_summary: {
      total_spend: data.total_spend,
      blended_roas: data.blended_roas,
      platforms: data.platforms.map((p) => p.platform),
    },
    generated_at: new Date().toISOString(),
  };
}

async function getStrategicPlan(orgId: string, goals?: string, budget?: number) {
  const data = await getPerformanceData(orgId, 90);

  const prompt = `You are the AI CMO for this brand. Create a strategic marketing plan based on the last 90 days of data.

Data:
${JSON.stringify(data, null, 2)}

${goals ? `Business goals: ${goals}` : ''}
${budget ? `Monthly budget: $${budget.toLocaleString()}` : ''}

Produce a strategic plan JSON:
{
  "executive_summary": "<2-3 sentences>",
  "primary_objective": "<one clear goal>",
  "platform_strategy": [
    {
      "platform": "google",
      "role": "<what role this platform plays>",
      "recommended_budget_pct": <number>,
      "campaign_types": ["search", "pmax"],
      "priority": "primary" | "secondary" | "test"
    }
  ],
  "90_day_roadmap": [
    {"month": 1, "focus": "...", "actions": ["action 1", "action 2"]},
    {"month": 2, "focus": "...", "actions": ["action 1", "action 2"]},
    {"month": 3, "focus": "...", "actions": ["action 1", "action 2"]}
  ],
  "quick_wins": ["<action that can be done this week>"],
  "growth_levers": ["<lever 1>", "<lever 2>"],
  "risks": ["<risk 1>", "<risk 2>"]
}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  let plan: Record<string, unknown> = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) plan = JSON.parse(match[0]);
  } catch { /* fall through */ }

  return {
    action: 'plan',
    plan,
    data_summary: {
      blended_roas: data.blended_roas,
      total_spend: data.total_spend,
      connected_platforms: data.connected_platforms,
    },
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const orgId = ctx.organization.id;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'dashboard';
    const days = parseInt(searchParams.get('days') ?? '30', 10);

    let result: Record<string, unknown>;

    switch (action) {
      case 'brief':
        result = await getBrief(orgId);
        break;
      case 'health':
        result = await getHealth(orgId);
        break;
      case 'forecast':
        result = await getForecast(orgId, days);
        break;
      case 'dashboard':
      default:
        result = await getDashboard(orgId, days);
        break;
    }

    return NextResponse.json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[CMO GET]', err);
    return NextResponse.json({ error: 'Failed to fetch CMO data', detail: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const orgId = ctx.organization.id;

    const body = await request.json() as { action: string; question?: string; goals?: string; budget?: number };
    const { action } = body;

    let result: Record<string, unknown>;

    switch (action) {
      case 'ask':
        if (!body.question) return NextResponse.json({ error: 'question is required' }, { status: 400 });
        result = await askCmo(orgId, body.question);
        break;
      case 'plan':
        result = await getStrategicPlan(orgId, body.goals, body.budget);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[CMO POST]', err);
    return NextResponse.json({ error: 'CMO request failed', detail: String(err) }, { status: 500 });
  }
}
