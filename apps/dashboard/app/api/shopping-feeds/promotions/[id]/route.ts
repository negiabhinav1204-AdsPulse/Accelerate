import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, patchService, deleteService } from '~/lib/service-router';

type Params = { params: Promise<{ id: string }> };

function deriveStatus(startDate: Date, endDate: Date): string {
  const now = new Date();
  if (now < startDate) return 'scheduled';
  if (now > endDate) return 'expired';
  return 'active';
}

/**
 * PATCH /api/shopping-feeds/promotions/[id]
 */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    orgId: string;
    title?: string;
    offerType?: string;
    couponCode?: string | null;
    discountType?: string;
    discountValue?: number | null;
    minimumPurchaseAmount?: number | null;
    startDate?: string;
    endDate?: string;
    applicableProducts?: string;
    productIds?: string[];
    channels?: string[];
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, `/shopping-feeds/promotions/${id}`, body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.merchantPromotion.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, startDate: true, endDate: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const start = fields.startDate ? new Date(fields.startDate) : existing.startDate;
  const end = fields.endDate ? new Date(fields.endDate) : existing.endDate;

  const updated = await prisma.merchantPromotion.update({
    where: { id },
    data: {
      ...(fields.title !== undefined && { title: fields.title }),
      ...(fields.offerType !== undefined && { offerType: fields.offerType }),
      ...('couponCode' in fields && { couponCode: fields.couponCode ?? null }),
      ...(fields.discountType !== undefined && { discountType: fields.discountType }),
      ...('discountValue' in fields && { discountValue: fields.discountValue ?? null }),
      ...('minimumPurchaseAmount' in fields && { minimumPurchaseAmount: fields.minimumPurchaseAmount ?? null }),
      ...(fields.startDate !== undefined && { startDate: start }),
      ...(fields.endDate !== undefined && { endDate: end }),
      ...(fields.applicableProducts !== undefined && { applicableProducts: fields.applicableProducts }),
      ...(fields.productIds !== undefined && { productIds: fields.productIds }),
      ...(fields.channels !== undefined && { channels: fields.channels }),
      status: deriveStatus(start, end)
    }
  });

  return NextResponse.json({ promotion: updated });
}

/**
 * DELETE /api/shopping-feeds/promotions/[id]?orgId=...
 */
export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await deleteService(SERVICES.shoppingFeeds.url, `/shopping-feeds/promotions/${id}?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.merchantPromotion.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.merchantPromotion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
