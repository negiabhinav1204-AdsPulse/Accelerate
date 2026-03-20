import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

// DELETE /api/connectors/[platform]/accounts/[accountId]
// Admin only — marks one sub-account as archived
// Also archives its AdPlatformReport rows
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string; accountId: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { platform, accountId } = await params;

  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  const isAdmin = !!membership && (membership.isOwner || membership.role === 'ADMIN');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const platformLower = platform.toLowerCase();
  const orgId = ctx.organization.id;
  const now = new Date();

  // Find the account — accountId in the URL is the platform's account ID (not DB id)
  const account = await prisma.connectedAdAccount.findFirst({
    where: {
      organizationId: orgId,
      platform: platformLower,
      accountId,
      archivedAt: null
    },
    select: { id: true }
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.adPlatformReport.updateMany({
      where: { connectedAccountId: account.id },
      data: { archivedAt: now }
    }),
    prisma.connectedAdAccount.update({
      where: { id: account.id },
      data: {
        archivedAt: now,
        status: 'disconnected',
        isDefault: false
      }
    })
  ]);

  return NextResponse.json({ ok: true });
}
