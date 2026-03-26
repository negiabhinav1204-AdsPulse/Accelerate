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

  const where = {
    organizationId: orgId,
    archivedAt: null,
    ...(source ? { source } : {}),
    ...(objective ? { objective: { equals: objective, mode: 'insensitive' as const } } : {}),
    ...(updatedAtFilter ? { updatedAt: updatedAtFilter } : {}),
    ...(searchFilter ?? {}),
    ...(platformFilter ?? {}),
    ...(statusFilter ?? {}),
    ...(connectorFilter ?? {})
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

  // Serialize — convert Decimal to number, status: null for accelerate campaigns
  const serialized = campaigns.map((c) => ({
    ...c,
    totalBudget: Number(c.totalBudget),
    // For accelerate campaigns, status lives at platformCampaign level
    status: c.source === 'accelerate' ? null : c.status?.toLowerCase() ?? null,
    platformCampaigns: c.platformCampaigns.map((pc) => ({
      ...pc,
      budget: Number(pc.budget)
    }))
  }));

  return NextResponse.json({ campaigns: serialized, total, page, perPage });
}
