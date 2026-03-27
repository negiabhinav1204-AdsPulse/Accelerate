import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, patchService, deleteService } from '~/lib/service-router';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    orgId: string;
    countryCode?: string;
    carrier?: string;
    service?: string;
    minTransitDays?: number;
    maxTransitDays?: number;
    cutoffHour?: number;
    price?: number | null;
    isActive?: boolean;
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, `/shopping-feeds/delivery-rules/${id}`, body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.deliverySpeedRule.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.deliverySpeedRule.update({
    where: { id },
    data: {
      ...(fields.countryCode !== undefined && { countryCode: fields.countryCode }),
      ...(fields.carrier !== undefined && { carrier: fields.carrier }),
      ...(fields.service !== undefined && { service: fields.service }),
      ...(fields.minTransitDays !== undefined && { minTransitDays: fields.minTransitDays }),
      ...(fields.maxTransitDays !== undefined && { maxTransitDays: fields.maxTransitDays }),
      ...(fields.cutoffHour !== undefined && { cutoffHour: fields.cutoffHour }),
      ...('price' in fields && { price: fields.price ?? null }),
      ...(fields.isActive !== undefined && { isActive: fields.isActive })
    }
  });

  return NextResponse.json({ rule: updated });
}

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
    const res = await deleteService(SERVICES.shoppingFeeds.url, `/shopping-feeds/delivery-rules/${id}?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.deliverySpeedRule.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.deliverySpeedRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
