/**
 * GET /api/campaigns/[id]/agents
 *
 * Returns stored agent outputs for a campaign created by the Accelerate pipeline.
 * Used for workflow history re-hydration — shows what each agent analysed and decided.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  // Verify user is a member of the org
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      sourceUrl: true,
      objective: true,
      status: true,
      source: true,
      acceId: true,
      totalBudget: true,
      currency: true,
      startDate: true,
      endDate: true,
      agentOutputs: true,
      mediaPlan: true,
      createdAt: true
    }
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.source !== 'accelerate' || !campaign.agentOutputs) {
    return NextResponse.json({ error: 'No agent analysis available for this campaign' }, { status: 404 });
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      sourceUrl: campaign.sourceUrl,
      objective: campaign.objective,
      status: campaign.status,
      acceId: campaign.acceId,
      totalBudget: campaign.totalBudget,
      currency: campaign.currency,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      createdAt: campaign.createdAt
    },
    agentOutputs: campaign.agentOutputs,
    mediaPlan: campaign.mediaPlan
  });
}
