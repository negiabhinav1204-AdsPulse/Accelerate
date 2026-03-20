import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { runPlatformSync } from '~/lib/data-pipeline/sync';

// GET /api/connectors/[platform]/accounts
// Returns all non-archived accounts for the org+platform
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { platform } = await params;

  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      organizationId: ctx.organization.id,
      platform: platform.toLowerCase(),
      archivedAt: null
    },
    select: {
      id: true,
      accountId: true,
      accountName: true,
      isDefault: true,
      status: true,
      lastSyncAt: true
    },
    orderBy: { connectedAt: 'asc' }
  });

  return NextResponse.json(accounts);
}

// PATCH /api/connectors/[platform]/accounts
// Body: { accountId: string }
// Admin only — sets isDefault=true on accountId, false on all others for same org+platform
// Triggers runPlatformSync for the new default
// Returns { ok: true }
export async function PATCH(
  request: NextRequest,
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

  let body: { accountId?: string };
  try {
    body = (await request.json()) as { accountId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { accountId } = body;
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  const platformLower = platform.toLowerCase();
  const orgId = ctx.organization.id;

  // Verify the target account exists and belongs to this org+platform
  const targetAccount = await prisma.connectedAdAccount.findFirst({
    where: {
      organizationId: orgId,
      platform: platformLower,
      accountId,
      archivedAt: null
    },
    select: { id: true, organizationId: true, platform: true, accountId: true, accessToken: true }
  });

  if (!targetAccount) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.connectedAdAccount.updateMany({
      where: { organizationId: orgId, platform: platformLower, archivedAt: null },
      data: { isDefault: false }
    }),
    prisma.connectedAdAccount.update({
      where: { id: targetAccount.id },
      data: { isDefault: true }
    })
  ]);

  // Fire background sync for the new default
  void (async () => {
    try {
      const connected = await prisma.connectedAdAccount.findUnique({
        where: { id: targetAccount.id },
        select: { id: true, organizationId: true, platform: true, accountId: true, accessToken: true }
      });
      if (connected?.accessToken) {
        await runPlatformSync(connected);
      }
    } catch (e) {
      console.error('[set-default] Background sync failed:', e);
    }
  })();

  return NextResponse.json({ ok: true });
}
