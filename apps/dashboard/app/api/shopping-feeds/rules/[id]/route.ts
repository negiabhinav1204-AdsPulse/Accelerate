import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, patchService, deleteService } from '~/lib/service-router';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/shopping-feeds/rules/[id]
 * Updates name, channels, conditions, actions, isActive, or priority.
 */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    orgId: string;
    name?: string;
    channels?: string[];
    conditions?: unknown[];
    actions?: unknown[];
    isActive?: boolean;
    priority?: number;
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, `/shopping-feeds/rules/${id}`, body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  // Verify the rule belongs to this org
  const existing = await prisma.feedTransformRule.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.feedTransformRule.update({
    where: { id },
    data: {
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.channels !== undefined && { channels: fields.channels }),
      ...(fields.conditions !== undefined && { conditions: fields.conditions as object[] }),
      ...(fields.actions !== undefined && { actions: fields.actions as object[] }),
      ...(fields.isActive !== undefined && { isActive: fields.isActive }),
      ...(fields.priority !== undefined && { priority: fields.priority })
    }
  });

  return NextResponse.json({ rule: updated });
}

/**
 * DELETE /api/shopping-feeds/rules/[id]
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
    const res = await deleteService(SERVICES.shoppingFeeds.url, `/shopping-feeds/rules/${id}?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.feedTransformRule.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.feedTransformRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
