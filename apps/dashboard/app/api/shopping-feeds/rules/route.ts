import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

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

  const store = await prisma.connectedStore.findFirst({
    where: { organizationId: orgId, archivedAt: null },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ rules: [] });

  const rules = await prisma.feedRule.findMany({
    where: { organizationId: orgId, connectedStoreId: store.id },
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

  const store = await prisma.connectedStore.findFirst({
    where: { organizationId: orgId, archivedAt: null },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 404 });

  // Priority = max existing + 1
  const maxRule = await prisma.feedRule.findFirst({
    where: { organizationId: orgId, connectedStoreId: store.id },
    orderBy: { priority: 'desc' },
    select: { priority: true }
  });
  const priority = (maxRule?.priority ?? 0) + 1;

  const rule = await prisma.feedRule.create({
    data: {
      organizationId: orgId,
      connectedStoreId: store.id,
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
