/**
 * POST /api/campaign/[id]/duplicate
 *
 * Deep-copies a Campaign with all PlatformCampaigns and AdGroups.
 * New campaign gets a new UUID, acceId, and name "{original} (Copy)".
 * Status is reset to DRAFT. platformCampaignId and platformAdGroupId are cleared.
 *
 * Body: { orgId: string }
 * Auth: session required, user must be member of org.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: { orgId: string };
  try {
    body = (await request.json()) as { orgId: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { orgId } = body;
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

  // Load original campaign
  const original = await prisma.campaign.findFirst({
    where: { id, organizationId: orgId },
    include: {
      platformCampaigns: {
        include: {
          adGroups: true
        }
      }
    }
  });

  if (!original) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Count existing accelerate campaigns for acceId generation
  const acceCount = await prisma.campaign.count({
    where: { organizationId: orgId, source: 'accelerate' }
  });
  const acceId = `ACCE-${String(acceCount + 1).padStart(2, '0')}`;

  // Deep-copy in a transaction
  const newCampaign = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        organizationId: original.organizationId,
        createdBy: userId,
        name: `${original.name} (Copy)`,
        sourceUrl: original.sourceUrl,
        objective: original.objective,
        status: 'DRAFT',
        source: original.source,
        acceId: original.source === 'accelerate' ? acceId : null,
        externalCampaignId: original.externalCampaignId,
        totalBudget: original.totalBudget,
        currency: original.currency,
        startDate: original.startDate,
        endDate: original.endDate,
        targetAudience: original.targetAudience ?? undefined,
        agentOutputs: original.agentOutputs ?? undefined,
        mediaPlan: original.mediaPlan ?? undefined
      },
      select: { id: true, acceId: true, name: true }
    });

    for (const pc of original.platformCampaigns) {
      const newPc = await tx.platformCampaign.create({
        data: {
          campaignId: campaign.id,
          platform: pc.platform,
          adTypes: pc.adTypes,
          budget: pc.budget,
          currency: pc.currency,
          status: 'draft',
          platformCampaignId: null, // cleared — it's a new draft
          settings: pc.settings ?? undefined
        },
        select: { id: true }
      });

      for (const ag of pc.adGroups) {
        await tx.adGroup.create({
          data: {
            platformCampaignId: newPc.id,
            name: ag.name,
            adType: ag.adType,
            targeting: ag.targeting ?? undefined,
            bidStrategy: ag.bidStrategy,
            status: 'draft',
            platformAdGroupId: null // cleared — it's a new draft
          }
        });
      }
    }

    return campaign;
  });

  return NextResponse.json({ campaign: newCampaign });
}
