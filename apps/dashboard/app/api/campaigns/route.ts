/**
 * GET /api/campaigns
 *
 * Lists campaigns for the current user's org with filters and pagination.
 *
 * Query params:
 *   orgId (required)
 *   source, platform, status, objective
 *   dateRange ('1'|'7'|'15'|'30'|'custom'), dateFrom, dateTo
 *   search (name or acceId)
 *   page (default 1), perPage (default 10, max 100)
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { orgKey, redis, TTL } from '~/lib/redis';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;

  const orgId = searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  // Verify user is a member of the org
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const source = searchParams.get('source') as 'accelerate' | 'external' | null;
  const platform = searchParams.get('platform');
  const statusParam = searchParams.get('status');
  const objective = searchParams.get('objective');
  const dateRange = searchParams.get('dateRange');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const search = searchParams.get('search');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '10', 10)));

  // Build date filter on updatedAt
  let updatedAtFilter: Record<string, Date> | undefined;
  if (dateRange && dateRange !== 'all') {
    if (dateRange === 'custom' && dateFrom && dateTo) {
      updatedAtFilter = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    } else {
      const daysMap: Record<string, number> = { '1': 1, '7': 7, '15': 15, '30': 30 };
      const days = daysMap[dateRange];
      if (days !== undefined) {
        const cutoff =
          dateRange === '1'
            ? new Date(new Date().setHours(0, 0, 0, 0))
            : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        updatedAtFilter = { gte: cutoff };
      }
    }
  }

  // Build search filter
  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { acceId: { contains: search, mode: 'insensitive' as const } }
        ]
      }
    : undefined;

  // Build platform filter — campaigns that have a PlatformCampaign with that platform
  const platformFilter = platform
    ? { platformCampaigns: { some: { platform } } }
    : undefined;

  // Check Redis cache for default unfiltered list (most common request)
  const isDefaultQuery = !search && !statusParam && !objective && !dateRange && !platform && page === 1 && perPage === 10;
  const campaignsCacheKey = isDefaultQuery
    ? orgKey(orgId, `campaigns:${source ?? 'all'}:p1`)
    : null;

  if (campaignsCacheKey) {
    try {
      const cached = await redis.get(campaignsCacheKey);
      if (cached) return NextResponse.json(cached);
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  // Fetch active (non-archived) platforms so we can hide disconnected external campaigns
  const connectedAccounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: orgId, archivedAt: null },
    select: { platform: true },
    distinct: ['platform']
  });
  const activePlatforms = connectedAccounts.map((a) => a.platform.toLowerCase());

  // External campaigns from disconnected platforms should not be shown.
  // Accelerate-created campaigns are always shown regardless of connector state.
  const connectorFilter =
    source === 'accelerate'
      ? undefined
      : {
          OR: [
            { source: 'accelerate' as const },
            { platformCampaigns: { some: { platform: { in: activePlatforms } } } }
          ]
        };

  // Build status filter
  let statusFilter: Record<string, unknown> | undefined;
  if (statusParam) {
    if (source === 'external') {
      // For external campaigns filter by campaign.status
      statusFilter = { status: statusParam.toUpperCase() };
    } else if (source === 'accelerate') {
      // For accelerate campaigns filter by any platformCampaign.status
      statusFilter = { platformCampaigns: { some: { status: statusParam } } };
    } else {
      // Mixed: OR both
      statusFilter = {
        OR: [
          { source: 'external', status: statusParam.toUpperCase() },
          { source: 'accelerate', platformCampaigns: { some: { status: statusParam } } }
        ]
      };
    }
  }

  // Never show unpublished (DRAFT) Accelerate-created campaigns — they're media plans in progress
  const draftFilter =
    source === 'external'
      ? undefined
      : source === 'accelerate'
        ? { status: { not: 'draft' as const } }
        : {
            OR: [
              { source: 'external' as const },
              { source: 'accelerate' as const, status: { not: 'draft' as const } }
            ]
          };

  const where = {
    organizationId: orgId,
    archivedAt: null,
    ...(source ? { source } : {}),
    ...(objective ? { objective: { equals: objective, mode: 'insensitive' as const } } : {}),
    ...(updatedAtFilter ? { updatedAt: updatedAtFilter } : {}),
    ...(searchFilter ?? {}),
    ...(platformFilter ?? {}),
    ...(statusFilter ?? {}),
    ...(connectorFilter ?? {}),
    ...(draftFilter ?? {})
  };

  const [total, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        acceId: true,
        name: true,
        source: true,
        objective: true,
        status: true,
        totalBudget: true,
        currency: true,
        updatedAt: true,
        platformCampaigns: {
          select: {
            id: true,
            platform: true,
            status: true,
            budget: true,
            currency: true,
            platformCampaignId: true,
            adGroups: {
              select: {
                id: true,
                name: true,
                adType: true,
                status: true
              }
            }
          }
        }
      }
    })
  ]);

  // Collect platform campaign IDs to look up real performance metrics
  const platformCampaignIds = campaigns.flatMap((c) =>
    c.platformCampaigns
      .filter((pc) => pc.platformCampaignId)
      .map((pc) => ({ id: pc.platformCampaignId, platform: pc.platform.toLowerCase() }))
  );

  // Fetch performance metrics from synced reports for these campaigns
  const metricsMap = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; roas: number }>();

  if (platformCampaignIds.length > 0) {
    const [metaReports, googleReports] = await Promise.all([
      prisma.adPlatformReport.findMany({
        where: { organizationId: orgId, reportType: 'campaign_insights_daily', archivedAt: null },
        select: { data: true }
      }),
      prisma.adPlatformReport.findMany({
        where: { organizationId: orgId, reportType: 'campaign', platform: 'GOOGLE', archivedAt: null },
        select: { data: true }
      })
    ]);

    for (const report of metaReports) {
      for (const row of (report.data as Record<string, unknown>[]) ?? []) {
        const cid = String(row.campaign_id ?? '');
        if (!cid) continue;
        const spend = parseFloat(String(row.spend ?? 0));
        const purchases = ((row.actions as { action_type: string; value: string }[] | undefined) ?? [])
          .filter((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
          .reduce((s, a) => s + parseFloat(a.value || '0'), 0);
        const purchaseValue = ((row.action_values as { action_type: string; value: string }[] | undefined) ?? [])
          .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase')
          .reduce((s, a) => s + parseFloat(a.value || '0'), 0);
        const cur = metricsMap.get(cid) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
        const newSpend = cur.spend + spend;
        metricsMap.set(cid, {
          spend: newSpend,
          impressions: cur.impressions + parseInt(String(row.impressions ?? 0), 10),
          clicks: cur.clicks + parseInt(String(row.clicks ?? 0), 10),
          conversions: cur.conversions + purchases,
          roas: newSpend > 0 ? (cur.roas * cur.spend + purchaseValue) / newSpend : 0,
        });
      }
    }

    for (const report of googleReports) {
      for (const row of (report.data as Record<string, unknown>[]) ?? []) {
        const nested = row.metrics as Record<string, unknown> | undefined;
        const cid = (row.campaign as Record<string, string> | undefined)?.id ?? String(row.campaignId ?? '');
        if (!cid) continue;
        const costMicros = parseFloat(String(nested?.costMicros ?? nested?.cost_micros ?? row.costMicros ?? 0));
        const spend = costMicros / 1_000_000;
        const convValue = parseFloat(String(nested?.conversionsValue ?? row.conversionsValue ?? 0));
        const cur = metricsMap.get(cid) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
        const newSpend = cur.spend + spend;
        metricsMap.set(cid, {
          spend: newSpend,
          impressions: cur.impressions + parseInt(String(nested?.impressions ?? row.impressions ?? 0), 10),
          clicks: cur.clicks + parseInt(String(nested?.clicks ?? row.clicks ?? 0), 10),
          conversions: cur.conversions + parseFloat(String(nested?.conversions ?? row.conversions ?? 0)),
          roas: newSpend > 0 ? (cur.roas * cur.spend + convValue) / newSpend : 0,
        });
      }
    }
  }

  // Serialize — convert Decimal to number, status: null for accelerate campaigns
  const serialized = campaigns.map((c) => {
    // Aggregate metrics across all platform campaigns
    const metrics = c.platformCampaigns.reduce(
      (agg, pc) => {
        const m = pc.platformCampaignId ? (metricsMap.get(pc.platformCampaignId) ?? null) : null;
        if (!m) return agg;
        const newSpend = agg.spend + m.spend;
        return {
          spend: newSpend,
          impressions: agg.impressions + m.impressions,
          clicks: agg.clicks + m.clicks,
          conversions: agg.conversions + m.conversions,
          roas: newSpend > 0 ? (agg.roas * agg.spend + m.roas * m.spend) / newSpend : 0,
        };
      },
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 }
    );

    return {
      ...c,
      totalBudget: Number(c.totalBudget),
      status: c.source === 'accelerate' ? null : c.status?.toLowerCase() ?? null,
      platformCampaigns: c.platformCampaigns.map((pc) => ({ ...pc, budget: Number(pc.budget) })),
      // Performance fields used by health badge and metrics display
      totalSpend: metrics.spend,
      totalRevenue: metrics.spend * metrics.roas,
      metrics,
    };
  });

  const payload = { campaigns: serialized, total, page, perPage };

  // Populate Redis for default queries
  if (campaignsCacheKey) {
    try {
      await redis.setex(campaignsCacheKey, TTL.CAMPAIGNS, payload);
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json(payload);
}
