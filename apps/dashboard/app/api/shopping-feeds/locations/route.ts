import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

export type StoreHours = {
  monday:    { open: string; close: string; closed: boolean };
  tuesday:   { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday:  { open: string; close: string; closed: boolean };
  friday:    { open: string; close: string; closed: boolean };
  saturday:  { open: string; close: string; closed: boolean };
  sunday:    { open: string; close: string; closed: boolean };
};

export const DEFAULT_HOURS: StoreHours = {
  monday:    { open: '09:00', close: '18:00', closed: false },
  tuesday:   { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday:  { open: '09:00', close: '18:00', closed: false },
  friday:    { open: '09:00', close: '18:00', closed: false },
  saturday:  { open: '10:00', close: '16:00', closed: false },
  sunday:    { open: '10:00', close: '16:00', closed: true }
};

/**
 * GET /api/shopping-feeds/locations?orgId=...
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

  const locations = await prisma.storeLocation.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json({ locations });
}

/**
 * POST /api/shopping-feeds/locations
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    storeCode: string;
    name: string;
    address: string;
    city: string;
    state?: string;
    country: string;
    postalCode: string;
    phone?: string;
    hours?: StoreHours;
  };

  const { orgId, storeCode, name, address, city, state, country, postalCode, phone, hours } = body;
  if (!orgId || !storeCode || !name || !address || !city || !country || !postalCode) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const store = await prisma.connectedStore.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });

  const location = await prisma.storeLocation.create({
    data: {
      organizationId: orgId,
      connectedStoreId: store.id,
      storeCode,
      name,
      address,
      city,
      state: state ?? null,
      country,
      postalCode,
      phone: phone ?? null,
      hours: (hours ?? DEFAULT_HOURS) as object
    }
  });

  return NextResponse.json({ location }, { status: 201 });
}
