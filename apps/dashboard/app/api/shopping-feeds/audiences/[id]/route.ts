import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, patchService, deleteService } from '~/lib/service-router';

type Params = { params: Promise<{ id: string }> };

type AudienceRule = {
  field: string;
  operator: string;
  value: string;
  logic: 'AND' | 'OR';
};

async function estimateSize(orgId: string, rules: AudienceRule[]): Promise<number> {
  if (rules.length === 0) {
    return await prisma.contact.count({ where: { organizationId: orgId } });
  }
  const totalContacts = await prisma.contact.count({ where: { organizationId: orgId } });
  const totalOrders = await prisma.order.count({ where: { organizationId: orgId } });
  let estimate = totalContacts;

  for (const rule of rules) {
    switch (rule.field) {
      case 'customer_tag': {
        const count = await prisma.contact.count({
          where: { organizationId: orgId, tags: { some: { text: { contains: rule.value, mode: 'insensitive' } } } }
        });
        estimate = Math.min(estimate, count);
        break;
      }
      case 'email_subscribed': {
        const count = await prisma.contact.count({ where: { organizationId: orgId, email: { not: null } } });
        estimate = Math.min(estimate, count);
        break;
      }
      case 'purchase_value': {
        const orders = await prisma.order.findMany({
          where: { organizationId: orgId },
          select: { totalAmount: true }
        });
        const threshold = parseFloat(rule.value);
        const qualifying = orders.filter((o) => {
          const amt = Number(o.totalAmount);
          if (rule.operator === 'greater_than') return amt > threshold;
          if (rule.operator === 'less_than') return amt < threshold;
          return amt === threshold;
        }).length;
        const ratio = totalOrders > 0 ? qualifying / totalOrders : 0;
        estimate = Math.min(estimate, Math.floor(totalContacts * ratio));
        break;
      }
      case 'last_purchase_date': {
        const days = parseFloat(rule.value);
        const fraction = rule.operator === 'in_last_n_days' ? Math.min(days / 90, 1) : Math.max(1 - days / 90, 0);
        estimate = Math.min(estimate, Math.floor(totalContacts * fraction));
        break;
      }
      default:
        estimate = Math.min(estimate, Math.floor(totalContacts * 0.5));
    }
  }
  return Math.max(estimate, 0);
}

/**
 * PATCH /api/shopping-feeds/audiences/[id]
 */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    orgId: string;
    name?: string;
    description?: string;
    type?: string;
    platforms?: string[];
    rules?: AudienceRule[];
    syncStatus?: string;
    historicalImportDone?: boolean;
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, `/shopping-feeds/audiences/${id}`, body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.audienceSegment.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, rules: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rules = (fields.rules ?? (existing.rules as AudienceRule[]));
  const estimatedSize = await estimateSize(orgId, rules);

  const updated = await prisma.audienceSegment.update({
    where: { id },
    data: {
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.description !== undefined && { description: fields.description }),
      ...(fields.type !== undefined && { type: fields.type }),
      ...(fields.platforms !== undefined && { platforms: fields.platforms }),
      ...(fields.rules !== undefined && { rules: fields.rules as object[] }),
      ...(fields.syncStatus !== undefined && { syncStatus: fields.syncStatus }),
      ...(fields.historicalImportDone !== undefined && { historicalImportDone: fields.historicalImportDone }),
      estimatedSize
    }
  });

  return NextResponse.json({ audience: updated });
}

/**
 * DELETE /api/shopping-feeds/audiences/[id]?orgId=...
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
    const res = await deleteService(SERVICES.shoppingFeeds.url, `/shopping-feeds/audiences/${id}?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const existing = await prisma.audienceSegment.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.audienceSegment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
