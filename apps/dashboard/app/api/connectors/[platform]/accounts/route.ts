import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { runPlatformSync } from '~/lib/data-pipeline/sync';
import { SERVICES, getService, patchService } from '~/lib/service-router';

// GET /api/connectors/[platform]/accounts?org=<orgSlug>
// Returns all non-archived accounts for the org+platform
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { platform } = await params;
  const orgSlug = request.nextUrl.searchParams.get('org');
  if (!orgSlug) {
    return NextResponse.json({ error: 'org query param required' }, { status: 400 });
  }

  const org = await prisma.organization.findFirst({
    where: {
      slug: orgSlug,
      memberships: { some: { userId: session.user.id } }
    },
    select: { id: true }
  });

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (SERVICES.connector.enabled) {
    const res = await getService(SERVICES.connector.url, `/connectors/${platform}/accounts?orgId=${org.id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      organizationId: org.id,
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
// Body: { accountId: string, org: string }
// Sets isDefault=true on accountId, false on all others for same org+platform
// Triggers runPlatformSync for the new default
// Returns { ok: true }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { platform } = await params;

  let body: { accountId?: string; org?: string };
  try {
    body = (await request.json()) as { accountId?: string; org?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { accountId, org: orgSlug } = body;
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }
  if (!orgSlug) {
    return NextResponse.json({ error: 'org is required' }, { status: 400 });
  }

  const org = await prisma.organization.findFirst({
    where: {
      slug: orgSlug,
      memberships: { some: { userId: session.user.id } }
    },
    select: { id: true }
  });
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (SERVICES.connector.enabled) {
    const res = await patchService(SERVICES.connector.url, `/connectors/${platform}/accounts`, { orgId: org.id, accountId });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const platformLower = platform.toLowerCase();
  const orgId = org.id;

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
