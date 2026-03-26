import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

/**
 * GET /api/shopping-feeds/advanced-settings?orgId=...
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

  const settings = await prisma.shoppingFeedSettings.findFirst({
    where: { organizationId: orgId },
    select: { buyOnGoogleEnabled: true, localInventoryEnabled: true }
  });

  return NextResponse.json({
    buyOnGoogleEnabled: settings?.buyOnGoogleEnabled ?? false,
    localInventoryEnabled: settings?.localInventoryEnabled ?? false
  });
}

/**
 * PATCH /api/shopping-feeds/advanced-settings
 * Body: { orgId, buyOnGoogleEnabled?, localInventoryEnabled? }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    buyOnGoogleEnabled?: boolean;
    localInventoryEnabled?: boolean;
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existing = await prisma.shoppingFeedSettings.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });

  if (existing) {
    await prisma.shoppingFeedSettings.update({
      where: { id: existing.id },
      data: {
        ...(fields.buyOnGoogleEnabled !== undefined && { buyOnGoogleEnabled: fields.buyOnGoogleEnabled }),
        ...(fields.localInventoryEnabled !== undefined && { localInventoryEnabled: fields.localInventoryEnabled })
      }
    });
  } else {
    const store = await prisma.connectedStore.findFirst({
      where: { organizationId: orgId },
      select: { id: true }
    });
    if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });
    await prisma.shoppingFeedSettings.create({
      data: {
        organizationId: orgId,
        connectedStoreId: store.id,
        buyOnGoogleEnabled: fields.buyOnGoogleEnabled ?? false,
        localInventoryEnabled: fields.localInventoryEnabled ?? false
      }
    });
  }

  return NextResponse.json({ success: true });
}
