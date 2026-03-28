import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { SERVICES, getService } from '~/lib/service-router';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const orgId = ctx.organization.id;

  const connectors = await prisma.commerceConnector.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true,
      platform: true,
      name: true,
      syncStatus: true,
      lastSyncAt: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Normalize platform enum to lowercase for display
  const normalized = connectors.map((c) => ({
    ...c,
    platform: c.platform.toLowerCase(),
    status: c.syncStatus.toLowerCase(),
  }));

  return NextResponse.json({ connectors: normalized });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { id } = await req.json();

  const connector = await prisma.commerceConnector.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!connector) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.commerceConnector.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
