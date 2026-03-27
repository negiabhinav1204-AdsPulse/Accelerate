import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import { SERVICES, callService } from '~/lib/service-router';

// POST /api/connectors/[platform]/disconnect
// Admin only — archives ALL ConnectedAdAccount for org+platform
// Archives ALL AdPlatformReport for those accounts
// Clears accessToken + refreshToken from those accounts
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { platform } = await params;

  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const isAdmin = !!membership && (membership.isOwner || membership.role === 'ADMIN');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (SERVICES.connector.enabled) {
    const res = await callService(SERVICES.connector.url, `/connectors/${platform}/disconnect`, { orgId: ctx.organization.id });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const platformLower = platform.toLowerCase();
  const orgId = ctx.organization.id;
  const now = new Date();

  // Find all active accounts for this org+platform
  const accounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: orgId, platform: platformLower, archivedAt: null },
    select: { id: true }
  });

  if (accounts.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const accountIds = accounts.map((a) => a.id);

  await prisma.$transaction([
    prisma.adPlatformReport.updateMany({
      where: { connectedAccountId: { in: accountIds } },
      data: { archivedAt: now }
    }),
    prisma.connectedAdAccount.updateMany({
      where: { id: { in: accountIds } },
      data: {
        archivedAt: now,
        status: 'disconnected',
        isDefault: false,
        accessToken: null,
        refreshToken: null
      }
    })
  ]);

  return NextResponse.json({ ok: true });
}
