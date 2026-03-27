import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, callService } from '~/lib/service-router';

function deriveStatus(startDate: Date, endDate: Date): string {
  const now = new Date();
  if (now < startDate) return 'scheduled';
  if (now > endDate) return 'expired';
  return 'active';
}

/**
 * GET /api/shopping-feeds/promotions?orgId=...
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
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/promotions?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const promotions = await prisma.merchantPromotion.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' }
  });

  // Sync status from dates on read
  const enriched = promotions.map((p) => ({
    ...p,
    status: deriveStatus(p.startDate, p.endDate)
  }));

  return NextResponse.json({ promotions: enriched });
}

/**
 * POST /api/shopping-feeds/promotions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    title: string;
    offerType: string;
    couponCode?: string;
    discountType: string;
    discountValue?: number;
    minimumPurchaseAmount?: number;
    startDate: string;
    endDate: string;
    applicableProducts: string;
    productIds?: string[];
    channels: string[];
  };

  const { orgId, title, offerType, couponCode, discountType, discountValue,
    minimumPurchaseAmount, startDate, endDate, applicableProducts, productIds, channels } = body;

  if (!orgId || !title || !offerType || !startDate || !endDate) {
    return NextResponse.json({ error: 'orgId, title, offerType, startDate, endDate required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await callService(SERVICES.shoppingFeeds.url, '/shopping-feeds/promotions', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  // Find connected store
  const connector = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });
  if (!connector) return NextResponse.json({ error: 'No connected store found' }, { status: 400 });

  const start = new Date(startDate);
  const end = new Date(endDate);

  const promotion = await prisma.merchantPromotion.create({
    data: {
      organizationId: orgId,
      connectorId: connector.id,
      title,
      offerType,
      couponCode: couponCode || null,
      discountType,
      discountValue: discountValue != null ? discountValue : null,
      minimumPurchaseAmount: minimumPurchaseAmount != null ? minimumPurchaseAmount : null,
      startDate: start,
      endDate: end,
      applicableProducts: applicableProducts || 'all',
      productIds: productIds ?? [],
      channels,
      status: deriveStatus(start, end)
    }
  });

  return NextResponse.json({ promotion }, { status: 201 });
}
