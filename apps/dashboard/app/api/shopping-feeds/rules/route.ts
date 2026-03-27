import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, callService } from '~/lib/service-router';

/**
 * GET /api/shopping-feeds/rules?orgId=...
 * Returns all feed rules for the org, ordered by priority.
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
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/rules?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId, isActive: true },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ rules: [] });

  const rules = await prisma.feedTransformRule.findMany({
    where: { organizationId: orgId, connectorId: store.id },
    orderBy: { priority: 'asc' }
  });

  return NextResponse.json({ rules });
}

/**
 * POST /api/shopping-feeds/rules
 * Creates a new feed rule.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    name: string;
    channels: string[];
    conditions: unknown[];
    actions: unknown[];
    isActive?: boolean;
  };

  const { orgId, name, channels, conditions, actions, isActive = true } = body;
  if (!orgId || !name) return NextResponse.json({ error: 'orgId and name required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await callService(SERVICES.shoppingFeeds.url, '/shopping-feeds/rules', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId, isActive: true },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 404 });

  // Priority = max existing + 1
  const maxRule = await prisma.feedTransformRule.findFirst({
    where: { organizationId: orgId, connectorId: store.id },
    orderBy: { priority: 'desc' },
    select: { priority: true }
  });
  const priority = (maxRule?.priority ?? 0) + 1;

  const rule = await prisma.feedTransformRule.create({
    data: {
      organizationId: orgId,
      connectorId: store.id,
      name,
      channels,
      conditions: conditions as object[],
      actions: actions as object[],
      priority,
      isActive
    }
  });

  return NextResponse.json({ rule }, { status: 201 });
}
