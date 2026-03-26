/**
 * GET  /api/campaigns/[id]/edit?orgId=  — fetch editable campaign data
 * PATCH /api/campaigns/[id]/edit?orgId= — apply EditOperation[] diff
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { setByPath } from '~/lib/campaign-edit-types';
import type { CampaignEditPayload, EditOperation } from '~/lib/campaign-edit-types';

// Campaign column names that can be set directly (dual-write: also patched in mediaPlan)
const DIRECT_FIELDS = new Set(['name', 'objective', 'totalBudget', 'currency', 'startDate', 'endDate']);

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true, name: true, objective: true, status: true,
      totalBudget: true, currency: true, startDate: true, endDate: true,
      source: true, mediaPlan: true
    }
  });

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.source !== 'accelerate') {
    return NextResponse.json({ error: 'Only Accelerate-created campaigns can be edited' }, { status: 400 });
  }
  if (!campaign.mediaPlan) {
    return NextResponse.json({ error: 'This campaign has no media plan and cannot be edited' }, { status: 400 });
  }

  const payload: CampaignEditPayload = {
    id: campaign.id,
    name: campaign.name ?? '',
    objective: campaign.objective ?? '',
    status: campaign.status ?? 'DRAFT',
    totalBudget: campaign.totalBudget ? parseFloat(campaign.totalBudget.toString()) : 0,
    currency: campaign.currency ?? 'USD',
    startDate: campaign.startDate ? campaign.startDate.toISOString().slice(0, 10) : '',
    endDate: campaign.endDate ? campaign.endDate.toISOString().slice(0, 10) : '',
    source: campaign.source ?? 'accelerate',
    mediaPlan: campaign.mediaPlan as CampaignEditPayload['mediaPlan']
  };

  return NextResponse.json(payload);
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

type PatchBody = {
  operations: EditOperation[];
  orgId: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { operations, orgId } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  if (!Array.isArray(operations) || operations.length === 0) {
    return NextResponse.json({ error: 'operations[] is required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, source: true, mediaPlan: true, currency: true }
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.source !== 'accelerate') {
    return NextResponse.json({ error: 'Only Accelerate-created campaigns can be edited' }, { status: 400 });
  }

  // Clone the existing mediaPlan for in-memory mutation
  const updatedMediaPlan = JSON.parse(
    JSON.stringify(campaign.mediaPlan ?? {})
  ) as Record<string, unknown>;

  // Build direct Campaign column updates
  const directUpdate: Record<string, unknown> = {};

  for (const op of operations) {
    if (op.op !== 'set') continue;
    const { path, value } = op;

    if (DIRECT_FIELDS.has(path)) {
      // Map to the correct Prisma column type
      if (path === 'name') {
        directUpdate.name = String(value);
        // Sync to mediaPlan.campaignName as well
        setByPath(updatedMediaPlan, 'campaignName', value);
      } else if (path === 'objective') {
        directUpdate.objective = String(value);
        setByPath(updatedMediaPlan, 'objective', value);
      } else if (path === 'totalBudget') {
        directUpdate.totalBudget = parseFloat(String(value));
        setByPath(updatedMediaPlan, 'totalBudget', value);
      } else if (path === 'currency') {
        directUpdate.currency = String(value);
        setByPath(updatedMediaPlan, 'currency', value);
      } else if (path === 'startDate') {
        directUpdate.startDate = value ? new Date(String(value)) : null;
        setByPath(updatedMediaPlan, 'startDate', value);
      } else if (path === 'endDate') {
        directUpdate.endDate = value ? new Date(String(value)) : null;
        setByPath(updatedMediaPlan, 'endDate', value);
      }
    } else {
      // Deep-patch into mediaPlan
      setByPath(updatedMediaPlan, path, value);
    }
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      ...directUpdate,
      mediaPlan: updatedMediaPlan,
      updatedAt: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
