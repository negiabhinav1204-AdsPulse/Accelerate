import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, callService } from '~/lib/service-router';

function buildFeedUrl(orgId: string, marketId: string): string {
  const base = process.env['NEXT_PUBLIC_DASHBOARD_URL'] ?? 'https://accelerate-dashboard-sable.vercel.app';
  return `${base}/api/shopping-feeds/xml?orgId=${orgId}&marketId=${marketId}&channel=google`;
}

/**
 * GET /api/shopping-feeds/markets?orgId=...
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/markets?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const markets = await prisma.commerceMarket.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' }
  });

  const enriched = markets.map((m) => ({
    ...m,
    feedUrl: buildFeedUrl(orgId, m.id)
  }));

  return NextResponse.json({ markets: enriched });
}

/**
 * POST /api/shopping-feeds/markets
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    marketName: string;
    targetCountry: string;
    language: string;
    currency: string;
  };

  const { orgId, marketName, targetCountry, language, currency } = body;
  if (!orgId || !marketName || !targetCountry || !language || !currency) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await callService(SERVICES.shoppingFeeds.url, '/shopping-feeds/markets', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });

  const market = await prisma.commerceMarket.create({
    data: { organizationId: orgId, connectorId: store.id, marketName, targetCountry, language, currency }
  });

  return NextResponse.json({ market: { ...market, feedUrl: buildFeedUrl(orgId, market.id) } }, { status: 201 });
}
