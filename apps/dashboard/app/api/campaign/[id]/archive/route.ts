/**
 * PATCH /api/campaign/[id]/archive
 *
 * Sets archivedAt = now() on the campaign.
 * Auth: session required, user must be member of org.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Find campaign — verify it belongs to an org this user is a member of
  const existing = await prisma.campaign.findFirst({
    where: {
      id,
      organization: {
        memberships: { some: { userId } }
      }
    },
    select: { id: true }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { archivedAt: new Date() },
    select: { id: true, archivedAt: true }
  });

  return NextResponse.json({ campaign: updated });
}
