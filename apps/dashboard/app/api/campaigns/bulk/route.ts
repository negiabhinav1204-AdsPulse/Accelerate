/**
 * POST /api/campaigns/bulk
 *
 * Bulk operations on campaigns.
 *
 * Body: { action: 'pause' | 'resume' | 'archive', ids: string[], orgId: string }
 * Auth: session required, user must be member of orgId.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type BulkBody = {
  action: 'pause' | 'resume' | 'archive';
  ids: string[];
  orgId: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, ids, orgId } = body;

  if (!action || !['pause', 'resume', 'archive'].includes(action)) {
    return NextResponse.json({ error: 'action must be pause, resume, or archive' }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate all campaigns belong to this org
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: ids }, organizationId: orgId },
    select: { id: true, source: true, status: true }
  });

  if (campaigns.length !== ids.length) {
    return NextResponse.json(
      { error: 'One or more campaigns not found or do not belong to this org' },
      { status: 404 }
    );
  }

  const updatedIds: string[] = campaigns.map((c) => c.id);

  if (action === 'archive') {
    await prisma.campaign.updateMany({
      where: { id: { in: updatedIds } },
      data: { archivedAt: new Date() }
    });
  } else if (action === 'pause') {
    const externalIds = campaigns.filter((c) => c.source === 'external').map((c) => c.id);
    const accelerateIds = campaigns.filter((c) => c.source === 'accelerate').map((c) => c.id);

    if (externalIds.length > 0) {
      await prisma.campaign.updateMany({
        where: { id: { in: externalIds } },
        data: { status: 'PAUSED' }
      });
    }
    if (accelerateIds.length > 0) {
      await prisma.platformCampaign.updateMany({
        where: { campaignId: { in: accelerateIds } },
        data: { status: 'paused' }
      });
    }
  } else if (action === 'resume') {
    const externalIds = campaigns.filter((c) => c.source === 'external').map((c) => c.id);
    const accelerateIds = campaigns.filter((c) => c.source === 'accelerate').map((c) => c.id);

    if (externalIds.length > 0) {
      await prisma.campaign.updateMany({
        where: { id: { in: externalIds } },
        data: { status: 'LIVE' }
      });
    }
    if (accelerateIds.length > 0) {
      await prisma.platformCampaign.updateMany({
        where: { campaignId: { in: accelerateIds }, status: 'paused' },
        data: { status: 'live' }
      });
    }
  }

  return NextResponse.json({ updated: updatedIds.length, ids: updatedIds });
}
