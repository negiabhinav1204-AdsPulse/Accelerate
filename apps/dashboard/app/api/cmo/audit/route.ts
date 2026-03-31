/**
 * CAIR — Connected Account Intelligence Report
 *
 * GET  /api/cmo/audit        — Run Phase 1 instant audit (heuristic, <30s)
 *                              Returns structured findings with severity + CTAs
 * POST /api/cmo/audit        — Trigger Phase 2 deep audit (async, AI-powered)
 *                              Saves AuditReport record, fires notification when done
 * GET  /api/cmo/audit?phase=latest — Fetch latest completed audit report
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import { createNotification } from '~/lib/notifications';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'warning' | 'opportunity' | 'healthy';

interface Finding {
  id: string;
  category: string;
  severity: Severity;
  platform: string | null;
  title: string;
  description: string;
  impact: string;
  cta: {
    label: string;
    action: 'navigate' | 'prefill_campaign' | 'open_docs';
    target: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Phase 1 — Instant heuristic audit (<30s)
// ---------------------------------------------------------------------------

async function runInstantAudit(orgId: string, orgSlug: string): Promise<{
  findings: Finding[];
  summary: { critical: number; warning: number; opportunity: number; healthy: number };
  accountsAudited: Array<{ platform: string; accountId: string; accountName: string }>;
  aiSummary: string;
}> {
  const accounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: orgId, archivedAt: null },
    select: {
      id: true, platform: true, accountId: true, accountName: true,
      status: true, lastSyncAt: true,
    },
  });

  const campaigns = await prisma.platformCampaign.findMany({
    where: { campaign: { organizationId: orgId } },
    select: {
      platform: true, status: true, budget: true,
      campaign: { select: { name: true, objective: true, createdAt: true } },
    },
  });

  const reports = await prisma.adPlatformReport.findMany({
    where: {
      organizationId: orgId,
      archivedAt: null,
      fetchedAt: { gte: new Date(Date.now() - 7 * 86400_000) },
    },
    select: { platform: true, data: true, reportType: true },
  });

  const findings: Finding[] = [];
  let fId = 0;
  const nextId = () => `f${String(++fId).padStart(3, '0')}`;

  // --- Category 1: Account Health ---

  // Disconnected / suspended accounts
  for (const acc of accounts) {
    if (acc.status === 'error' || acc.status === 'disconnected') {
      findings.push({
        id: nextId(), category: 'account_health', severity: 'critical',
        platform: acc.platform,
        title: `${acc.platform.toUpperCase()} account disconnected`,
        description: `${acc.accountName} (${acc.accountId}) is no longer connected. Campaigns may have stopped.`,
        impact: 'Ad delivery could be paused until reconnected.',
        cta: { label: 'Reconnect Account', action: 'navigate', target: `/organizations/${orgSlug}/connectors` },
      });
    }
  }

  // Stale sync (>48h)
  for (const acc of accounts.filter((a) => a.status === 'connected')) {
    const hoursAgo = acc.lastSyncAt
      ? (Date.now() - new Date(acc.lastSyncAt).getTime()) / 3600_000
      : 999;
    if (hoursAgo > 48) {
      findings.push({
        id: nextId(), category: 'account_health', severity: 'warning',
        platform: acc.platform,
        title: `${acc.platform.toUpperCase()} data sync overdue`,
        description: `Last sync was ${Math.round(hoursAgo)} hours ago for ${acc.accountName}.`,
        impact: 'Performance data may be stale. Reporting and optimization are less accurate.',
        cta: { label: 'View Connectors', action: 'navigate', target: `/organizations/${orgSlug}/connectors` },
      });
    }
  }

  // No accounts connected at all
  if (accounts.length === 0) {
    findings.push({
      id: nextId(), category: 'account_health', severity: 'critical', platform: null,
      title: 'No ad accounts connected',
      description: 'Connect your Google and Meta accounts to start running campaigns.',
      impact: 'Cannot create or manage campaigns without connected accounts.',
      cta: { label: 'Connect Accounts', action: 'navigate', target: `/organizations/${orgSlug}/connectors` },
    });
  }

  // --- Category 2: Tracking & Attribution ---

  const connectedPlatforms = accounts.map((a) => a.platform);
  const hasGoogle = connectedPlatforms.includes('google');
  const hasMeta = connectedPlatforms.includes('meta');

  // Check pixel presence via reports — look for pixel/conversion data
  const metaReports = reports.filter((r) => r.platform === 'meta');
  const googleReports = reports.filter((r) => r.platform === 'google');

  if (hasMeta && metaReports.length === 0) {
    findings.push({
      id: nextId(), category: 'tracking', severity: 'critical', platform: 'meta',
      title: 'No Meta tracking data detected',
      description: 'No Meta Pixel events have been received in the last 7 days.',
      impact: 'Meta conversion campaigns cannot optimise without pixel signals. CPA will be significantly higher.',
      cta: { label: 'Set Up Pixel', action: 'navigate', target: `/organizations/${orgSlug}/settings` },
    });
  }

  if (hasGoogle && googleReports.length === 0) {
    findings.push({
      id: nextId(), category: 'tracking', severity: 'critical', platform: 'google',
      title: 'No Google conversion data detected',
      description: 'No Google Ads conversion tracking data found in the last 7 days.',
      impact: 'Smart Bidding and Target CPA strategies require conversion data to function.',
      cta: { label: 'Set Up Conversion Tracking', action: 'navigate', target: `/organizations/${orgSlug}/settings` },
    });
  }

  // Cross-platform attribution gap
  if (hasMeta && hasGoogle && metaReports.length > 0 && googleReports.length > 0) {
    findings.push({
      id: nextId(), category: 'tracking', severity: 'opportunity', platform: null,
      title: 'Cross-platform attribution not unified',
      description: 'Google and Meta are both active but attribution windows may differ (Google: 30d click, Meta: 7d click).',
      impact: 'Revenue may be double-counted. Blended ROAS comparisons can be misleading.',
      cta: { label: 'View Attribution Settings', action: 'navigate', target: `/organizations/${orgSlug}/reporting` },
    });
  }

  // --- Category 3: Campaign Structure ---

  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const pausedCampaigns = campaigns.filter((c) => c.status === 'paused');

  // Zombie campaigns — active but no recent spend
  const platformsWithSpend = new Set(reports.map((r) => r.platform));
  const activePlatforms = new Set(activeCampaigns.map((c) => c.platform));
  const zombiePlatforms = [...activePlatforms].filter((p) => !platformsWithSpend.has(p));

  for (const platform of zombiePlatforms) {
    const count = activeCampaigns.filter((c) => c.platform === platform).length;
    if (count > 0) {
      findings.push({
        id: nextId(), category: 'campaign_structure', severity: 'warning', platform,
        title: `${count} active ${platform.toUpperCase()} campaign${count > 1 ? 's' : ''} with no recent spend`,
        description: `${count} campaign${count > 1 ? 's are' : ' is'} active but recorded no spend in the last 7 days.`,
        impact: 'Budget is allocated but not delivering. This could indicate disapproved ads, low bids, or targeting issues.',
        cta: { label: 'Review Campaigns', action: 'navigate', target: `/organizations/${orgSlug}/campaigns?filter=active&platform=${platform}` },
      });
    }
  }

  // No active campaigns
  if (activeCampaigns.length === 0 && accounts.length > 0) {
    findings.push({
      id: nextId(), category: 'campaign_structure', severity: 'warning', platform: null,
      title: 'No active campaigns running',
      description: `You have ${pausedCampaigns.length} paused campaign${pausedCampaigns.length !== 1 ? 's' : ''} but nothing is live.`,
      impact: 'No ad delivery means no traffic or conversions during this period.',
      cta: { label: 'View Campaigns', action: 'navigate', target: `/organizations/${orgSlug}/campaigns` },
    });
  }

  // Single platform risk
  if (activePlatforms.size === 1 && accounts.length > 1) {
    const [onlyPlatform] = activePlatforms;
    findings.push({
      id: nextId(), category: 'campaign_structure', severity: 'opportunity', platform: onlyPlatform ?? null,
      title: 'All spend concentrated on one platform',
      description: `You have multiple accounts connected but all active campaigns are on ${(onlyPlatform ?? '').toUpperCase()}.`,
      impact: 'Platform outages or policy issues could halt all delivery. Cross-platform diversification reduces risk.',
      cta: { label: 'Create Campaign', action: 'navigate', target: `/organizations/${orgSlug}/create-campaign` },
    });
  }

  // --- Category 4: Quick Wins ---

  // Campaigns without budgets set
  const noBudget = campaigns.filter((c) => c.status === 'active' && (!c.budget || Number(c.budget) === 0));
  if (noBudget.length > 0) {
    findings.push({
      id: nextId(), category: 'quick_wins', severity: 'warning', platform: null,
      title: `${noBudget.length} active campaign${noBudget.length > 1 ? 's' : ''} with no budget set`,
      description: 'These campaigns are active but have no daily budget configured in Accelerate.',
      impact: 'Uncontrolled spend risk. Platform default budgets may overspend.',
      cta: { label: 'Review Campaigns', action: 'navigate', target: `/organizations/${orgSlug}/campaigns` },
    });
  }

  // Healthy signals
  if (activeCampaigns.length > 0 && platformsWithSpend.size > 0) {
    findings.push({
      id: nextId(), category: 'quick_wins', severity: 'healthy', platform: null,
      title: 'Campaigns actively delivering',
      description: `${activeCampaigns.length} campaign${activeCampaigns.length > 1 ? 's are' : ' is'} live and spending across ${platformsWithSpend.size} platform${platformsWithSpend.size > 1 ? 's' : ''}.`,
      impact: '',
      cta: null,
    });
  }

  if (accounts.filter((a) => a.status === 'connected').length > 1) {
    findings.push({
      id: nextId(), category: 'quick_wins', severity: 'healthy', platform: null,
      title: 'Multiple platforms connected',
      description: `${accounts.filter((a) => a.status === 'connected').length} ad accounts are connected and active.`,
      impact: '',
      cta: null,
    });
  }

  // --- Summary counts ---
  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    opportunity: findings.filter((f) => f.severity === 'opportunity').length,
    healthy: findings.filter((f) => f.severity === 'healthy').length,
  };

  // --- AI-generated one-paragraph summary ---
  let aiSummary = '';
  try {
    const prompt = `You are an AI CMO. Based on this account audit, write one concise paragraph (3-4 sentences) summarising the state of this advertising account. Be direct and specific. No emojis. No bullet points. No headers.

Audit findings:
${JSON.stringify({ summary, findingTitles: findings.map((f) => ({ severity: f.severity, title: f.title })) }, null, 2)}

Connected platforms: ${accounts.map((a) => a.platform).join(', ') || 'none'}
Active campaigns: ${activeCampaigns.length}`;

    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    aiSummary = res.content.find((b) => b.type === 'text')?.text ?? '';
  } catch {
    aiSummary = `Your account has ${summary.critical} critical issue${summary.critical !== 1 ? 's' : ''} and ${summary.warning} warning${summary.warning !== 1 ? 's' : ''} that need attention. Review the findings below and act on critical items first.`;
  }

  return {
    findings,
    summary,
    accountsAudited: accounts.map((a) => ({
      platform: a.platform,
      accountId: a.accountId,
      accountName: a.accountName,
    })),
    aiSummary,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const orgId = ctx.organization.id;
    const orgSlug = ctx.organization.slug;
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase');

    // Return latest stored report
    if (phase === 'latest') {
      const latest = await prisma.auditReport.findFirst({
        where: { organizationId: orgId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ report: latest ?? null });
    }

    // Run instant Phase 1 audit
    const audit = await runInstantAudit(orgId, orgSlug);

    // Persist the instant report
    await prisma.auditReport.create({
      data: {
        organizationId: orgId,
        phase: 'instant',
        status: 'completed',
        triggeredBy: 'manual',
        findings: audit.findings as object[],
        accountsAudited: audit.accountsAudited,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      phase: 'instant',
      generated_at: new Date().toISOString(),
      accounts_audited: audit.accountsAudited,
      summary: audit.summary,
      findings: audit.findings,
      ai_summary: audit.aiSummary,
    });
  } catch (err) {
    console.error('[GET /api/cmo/audit]', err);
    return NextResponse.json({ error: 'Audit failed', detail: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const orgId = ctx.organization.id;
    const orgSlug = ctx.organization.slug;

    const body = await request.json() as { triggeredBy?: string };
    const triggeredBy = (body.triggeredBy ?? 'manual') as string;

    // Create a pending deep audit record
    const report = await prisma.auditReport.create({
      data: {
        organizationId: orgId,
        phase: 'deep',
        status: 'running',
        triggeredBy,
        findings: [],
        accountsAudited: [],
      },
    });

    // Run async — don't await. In production this would be a Kafka event or Cloud Run job.
    // For now we run it in the background and update the record when done.
    void runDeepAuditAsync(orgId, orgSlug, report.id);

    return NextResponse.json({ reportId: report.id, status: 'running' });
  } catch (err) {
    console.error('[POST /api/cmo/audit]', err);
    return NextResponse.json({ error: 'Failed to trigger audit', detail: String(err) }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Deep audit (AI-powered, runs async)
// ---------------------------------------------------------------------------

async function runDeepAuditAsync(orgId: string, orgSlug: string, reportId: string): Promise<void> {
  try {
    const since90d = new Date(Date.now() - 90 * 86400_000);

    const [accounts, campaigns, reports90d, audiences] = await Promise.all([
      prisma.connectedAdAccount.findMany({
        where: { organizationId: orgId, archivedAt: null },
        select: { platform: true, accountId: true, accountName: true },
      }),
      prisma.platformCampaign.findMany({
        where: { campaign: { organizationId: orgId } },
        select: {
          platform: true, status: true, budget: true,
          campaign: { select: { name: true, objective: true } },
        },
      }),
      prisma.adPlatformReport.findMany({
        where: { organizationId: orgId, archivedAt: null, fetchedAt: { gte: since90d } },
        select: { platform: true, data: true, reportType: true, fetchedAt: true },
        orderBy: { fetchedAt: 'desc' },
        take: 500,
      }),
      prisma.audienceSegment.findMany({
        where: { organizationId: orgId },
        select: { name: true, type: true, size: true },
      }),
    ]);

    // Aggregate 90-day platform performance
    type PlatformAgg = { spend: number; clicks: number; impressions: number; conversions: number; revenue: number; reportCount: number };
    const byPlatform: Record<string, PlatformAgg> = {};
    for (const report of reports90d) {
      const rows = Array.isArray(report.data) ? report.data : [report.data];
      if (!byPlatform[report.platform]) {
        byPlatform[report.platform] = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, reportCount: 0 };
      }
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        byPlatform[report.platform].spend += Number(r.spend ?? r.cost ?? 0);
        byPlatform[report.platform].clicks += Number(r.clicks ?? 0);
        byPlatform[report.platform].impressions += Number(r.impressions ?? 0);
        byPlatform[report.platform].conversions += Number(r.conversions ?? r.purchases ?? 0);
        byPlatform[report.platform].revenue += Number(r.revenue ?? r.conversion_value ?? 0);
        byPlatform[report.platform].reportCount++;
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
    }));

    const totalSpend = platformStats.reduce((s, p) => s + p.spend, 0);
    const totalRevenue = platformStats.reduce((s, p) => s + p.revenue, 0);
    const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    const contextData = {
      accounts_audited: accounts,
      platform_stats_90d: platformStats,
      total_spend_90d: Math.round(totalSpend * 100) / 100,
      total_revenue_90d: Math.round(totalRevenue * 100) / 100,
      blended_roas_90d: Math.round(blendedRoas * 100) / 100,
      campaigns: {
        total: campaigns.length,
        active: campaigns.filter((c) => c.status === 'active').length,
        paused: campaigns.filter((c) => c.status === 'paused').length,
        by_platform: Object.fromEntries(
          [...new Set(campaigns.map((c) => c.platform))].map((p) => [
            p,
            { total: campaigns.filter((c) => c.platform === p).length, active: campaigns.filter((c) => c.platform === p && c.status === 'active').length },
          ])
        ),
      },
      audiences: { count: audiences.length, types: [...new Set(audiences.map((a) => a.type))] },
    };

    const prompt = `You are an expert AI CMO performing a deep account audit. Analyse this advertising account's 90-day performance data and produce a comprehensive audit report.

Data:
${JSON.stringify(contextData, null, 2)}

Produce a JSON report with exactly this structure:
{
  "overall_health_score": <0-100>,
  "score_breakdown": {
    "tracking_attribution": <0-20>,
    "spend_efficiency": <0-20>,
    "creative_health": <0-15>,
    "audience_targeting": <0-15>,
    "funnel_health": <0-15>,
    "budget_pacing": <0-15>
  },
  "executive_summary": "<3-4 sentences. Direct, specific, no emojis>",
  "findings": [
    {
      "id": "f001",
      "category": "spend_efficiency",
      "severity": "critical|warning|opportunity|healthy",
      "platform": "<platform or null>",
      "title": "<concise title>",
      "description": "<1-2 sentences>",
      "impact": "<business impact>",
      "cta_label": "<action label>",
      "cta_target": "<path>"
    }
  ],
  "recommendations": [
    {
      "id": "r001",
      "title": "<campaign recommendation title>",
      "rationale": "<why based on the data>",
      "estimated_impact": "<projected improvement>",
      "platform": "meta|google|bing",
      "objective": "CONVERSIONS|TRAFFIC|AWARENESS",
      "suggested_budget": <monthly USD number>
    }
  ],
  "savings_estimate": {
    "monthly_wasted_spend": <number>,
    "potential_cpa_improvement_pct": <number>,
    "potential_roas_improvement_pct": <number>
  }
}

Limit findings to the 10 most impactful. Limit recommendations to 3. Base all numbers strictly on the data provided. If data is insufficient for a dimension, score it at 5/max and note it in findings.`;

    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    let parsed: Record<string, unknown> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch { /* use empty */ }

    const score = typeof parsed.overall_health_score === 'number' ? parsed.overall_health_score : null;

    await prisma.auditReport.update({
      where: { id: reportId },
      data: {
        status: 'completed',
        phase: 'deep',
        overallScore: score,
        scoreBreakdown: (parsed.score_breakdown as object) ?? null,
        findings: (parsed.findings as object[]) ?? [],
        recommendations: (parsed.recommendations as object[]) ?? null,
        savingsEstimate: (parsed.savings_estimate as object) ?? null,
        accountsAudited: accounts,
        dataWindowStart: since90d,
        dataWindowEnd: new Date(),
        completedAt: new Date(),
      },
    });

    // Notify admins
    await createNotification({
      orgId,
      type: 'audit_ready',
      subject: 'Your AI CMO deep analysis is ready',
      content: `Account health score: ${score ?? 'N/A'}/100. ${
        Array.isArray(parsed.findings)
          ? `${(parsed.findings as Array<{ severity: string }>).filter((f) => f.severity === 'critical').length} critical findings detected.`
          : ''
      }`,
      link: `/organizations/${orgSlug}/cmo?tab=deep-analysis`,
    });
  } catch (err) {
    console.error('[runDeepAuditAsync]', err);
    await prisma.auditReport.update({
      where: { id: reportId },
      data: { status: 'failed', completedAt: new Date() },
    }).catch(() => { /* ignore */ });
  }
}
