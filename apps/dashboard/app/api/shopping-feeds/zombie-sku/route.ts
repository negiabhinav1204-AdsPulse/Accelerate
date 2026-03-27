import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, patchService } from '~/lib/service-router';

export type ZombieSkuConfig = {
  enabled: boolean;
  minDaysSinceLastImpression: number;
  maxImpressions: number;
  maxClicks: number;
  customLabel: 'custom_label_0' | 'custom_label_1' | 'custom_label_2' | 'custom_label_3' | 'custom_label_4';
  labelValue: string;
};

const DEFAULT_CONFIG: ZombieSkuConfig = {
  enabled: true,
  minDaysSinceLastImpression: 30,
  maxImpressions: 100,
  maxClicks: 10,
  customLabel: 'custom_label_0',
  labelValue: 'zombie_sku'
};

/**
 * GET /api/shopping-feeds/zombie-sku?orgId=...
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
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/zombie-sku?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const settings = await prisma.shoppingFeedSettings.findFirst({
    where: { organizationId: orgId },
    select: { zombieSkuConfig: true }
  });

  const config = (settings?.zombieSkuConfig as ZombieSkuConfig | null) ?? DEFAULT_CONFIG;
  return NextResponse.json({ config });
}

/**
 * PATCH /api/shopping-feeds/zombie-sku
 * Body: { orgId, config: ZombieSkuConfig }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { orgId: string; config: ZombieSkuConfig };
  const { orgId, config } = body;
  if (!orgId || !config) return NextResponse.json({ error: 'orgId and config required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, '/shopping-feeds/zombie-sku', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.shoppingFeedSettings.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });

  if (!existing) {
    // Need a connector to create settings
    const store = await prisma.commerceConnector.findFirst({
      where: { organizationId: orgId },
      select: { id: true }
    });
    if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });
    await prisma.shoppingFeedSettings.create({
      data: { organizationId: orgId, connectorId: store.id, zombieSkuConfig: config as object }
    });
  } else {
    await prisma.shoppingFeedSettings.update({
      where: { id: existing.id },
      data: { zombieSkuConfig: config as object }
    });
  }

  return NextResponse.json({ config });
}
