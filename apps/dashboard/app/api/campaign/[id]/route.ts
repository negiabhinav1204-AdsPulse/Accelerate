/**
 * Campaign CRUD endpoints
 *
 * PATCH /api/campaign/[id]  — update campaign (save edits to media plan or fields)
 * GET   /api/campaign/[id]  — get campaign details
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/campaign/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id,
      organization: {
        memberships: { some: { userId } }
      }
    },
    include: {
      platformCampaigns: {
        include: {
          adGroups: {
            include: { ads: true }
          }
        }
      }
    }
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

// ---------------------------------------------------------------------------
// PATCH /api/campaign/[id]
// Body: Partial<{ name, objective, totalBudget, currency, startDate, endDate,
//               targetAudience, mediaPlan, agentOutputs }>
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify the campaign belongs to an organization this user is a member of
  const existing = await prisma.campaign.findFirst({
    where: {
      id,
      organization: {
        memberships: { some: { userId } }
      }
    },
    select: { id: true, status: true }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Build update payload — only allow safe fields
  const updateData: Record<string, unknown> = {};

  if (typeof body.name === 'string') updateData.name = body.name;
  if (typeof body.objective === 'string') updateData.objective = body.objective;
  if (typeof body.totalBudget === 'number') updateData.totalBudget = body.totalBudget;
  if (typeof body.currency === 'string') updateData.currency = body.currency;
  if (body.startDate !== undefined)
    updateData.startDate = body.startDate ? new Date(body.startDate as string) : null;
  if (body.endDate !== undefined)
    updateData.endDate = body.endDate ? new Date(body.endDate as string) : null;
  if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience as object;
  if (body.mediaPlan !== undefined) updateData.mediaPlan = body.mediaPlan as object;
  if (body.agentOutputs !== undefined) updateData.agentOutputs = body.agentOutputs as object;

  const allowedStatusTransitions: Record<string, string[]> = {
    DRAFT: ['DRAFT', 'REVIEWING'],
    REVIEWING: ['REVIEWING', 'DRAFT', 'PAUSED'],
    PAUSED: ['PAUSED', 'LIVE', 'ENDED'],
    LIVE: ['LIVE', 'PAUSED', 'ENDED'],
    ENDED: ['ENDED']
  };

  if (typeof body.status === 'string') {
    const currentStatus = existing.status as string;
    const allowed = allowedStatusTransitions[currentStatus] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${currentStatus} to ${body.status}` },
        { status: 422 }
      );
    }
    updateData.status = body.status;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      status: true,
      objective: true,
      totalBudget: true,
      currency: true,
      startDate: true,
      endDate: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ campaign: updated });
}
