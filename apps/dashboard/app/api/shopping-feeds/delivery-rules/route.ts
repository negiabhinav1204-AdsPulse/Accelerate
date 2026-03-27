import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, callService } from '~/lib/service-router';

/**
 * GET /api/shopping-feeds/delivery-rules?orgId=...
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
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/delivery-rules?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const rules = await prisma.deliverySpeedRule.findMany({
    where: { organizationId: orgId },
    orderBy: [{ countryCode: 'asc' }, { createdAt: 'asc' }]
  });

  return NextResponse.json({ rules });
}

/**
 * POST /api/shopping-feeds/delivery-rules
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    countryCode: string;
    carrier: string;
    service: string;
    minTransitDays: number;
    maxTransitDays: number;
    cutoffHour?: number;
    price?: number | null;
  };

  const { orgId, countryCode, carrier, service, minTransitDays, maxTransitDays, cutoffHour, price } = body;
  if (!orgId || !countryCode || !carrier || !service || minTransitDays == null || maxTransitDays == null) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await callService(SERVICES.shoppingFeeds.url, '/shopping-feeds/delivery-rules', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });

  const rule = await prisma.deliverySpeedRule.create({
    data: {
      organizationId: orgId,
      connectorId: store.id,
      countryCode,
      carrier,
      service,
      minTransitDays,
      maxTransitDays,
      cutoffHour: cutoffHour ?? 17,
      price: price != null ? price : null
    }
  });

  return NextResponse.json({ rule }, { status: 201 });
}
