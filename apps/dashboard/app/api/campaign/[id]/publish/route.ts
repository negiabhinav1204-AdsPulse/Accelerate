/**
 * POST /api/campaign/[id]/publish
 *
 * v1: "publish" means save as PAUSED status (ready to go live manually).
 * Future: will trigger actual platform campaign creation via connector APIs.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const campaign = await prisma.campaign.findFirst({
    where: {
      id,
      organization: {
        memberships: { some: { userId } }
      }
    },
    select: {
      id: true,
      status: true,
      name: true,
      organizationId: true,
      mediaPlan: true
    }
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Only DRAFT and REVIEWING campaigns can be published
  if (!['DRAFT', 'REVIEWING'].includes(campaign.status as string)) {
    return NextResponse.json(
      { error: `Cannot publish a campaign with status ${campaign.status}` },
      { status: 422 }
    );
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: 'PAUSED' },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    campaign: updated,
    message: 'Campaign saved and ready. Set it to Live when you are ready to start spending.'
  });
}
