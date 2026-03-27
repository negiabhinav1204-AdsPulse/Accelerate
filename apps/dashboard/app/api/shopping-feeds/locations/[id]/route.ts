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
    storeCode?: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string | null;
    country?: string;
    postalCode?: string;
    phone?: string | null;
    hours?: object;
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
    const res = await patchService(SERVICES.shoppingFeeds.url, `/shopping-feeds/locations/${id}`, body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.storeLocation.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.storeLocation.update({
    where: { id },
    data: {
      ...(fields.storeCode !== undefined && { storeCode: fields.storeCode }),
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.address !== undefined && { address: fields.address }),
      ...(fields.city !== undefined && { city: fields.city }),
      ...('state' in fields && { state: fields.state ?? null }),
      ...(fields.country !== undefined && { country: fields.country }),
      ...(fields.postalCode !== undefined && { postalCode: fields.postalCode }),
      ...('phone' in fields && { phone: fields.phone ?? null }),
      ...(fields.hours !== undefined && { hours: fields.hours }),
      ...(fields.isActive !== undefined && { isActive: fields.isActive })
    }
  });

  return NextResponse.json({ location: updated });
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
    const res = await deleteService(SERVICES.shoppingFeeds.url, `/shopping-feeds/locations/${id}?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.storeLocation.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.storeLocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
