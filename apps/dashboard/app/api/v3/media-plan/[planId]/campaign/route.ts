/**
 * POST /api/v3/media-plan/[planId]/campaign
 *
 * Internal endpoint — called by the agentic service's campaign_client.py.
 * Creates PlatformCampaign records under an existing Campaign and updates
 * the campaign's total budget and status.
 *
 * Auth: X-Internal-Api-Key header (service-to-service)
 * Headers: X-Org-Id (required)
 * Body: { campaigns: CampaignRequest[] }
 *
 * CampaignRequest shape (from agentic service):
 *   { name, platformType, campaignType, budget: { amount, currency }, startDate?, endDate?,
 *     adGroups?, assetGroups?, targeting? }
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@workspace/database/client';

import { orgKey, redis } from '~/lib/redis';

type BudgetRequest = {
  name?: string;
  amount: number;
  currency: string;
  budgetType?: string;
};

type CampaignRequest = {
  name: string;
  platformType: string;
  campaignType: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: BudgetRequest;
  adGroups?: unknown;
  assetGroups?: unknown;
  targeting?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  // ── Auth: internal API key ────────────────────────────────────────────────
  const internalKey = request.headers.get('x-internal-api-key');
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = await params;
  const orgId = request.headers.get('x-org-id') ?? '';

  if (!orgId) {
    return NextResponse.json({ error: 'X-Org-Id header required' }, { status: 400 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { campaigns?: CampaignRequest[] };
  try {
    body = (await request.json()) as { campaigns?: CampaignRequest[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const campaigns = body.campaigns ?? [];
  if (campaigns.length === 0) {
    return NextResponse.json({ error: 'campaigns array is required' }, { status: 400 });
  }

  // ── Verify the parent campaign exists and belongs to the org ─────────────
  const parentCampaign = await prisma.campaign.findFirst({
    where: { id: planId, organizationId: orgId }
  });
  if (!parentCampaign) {
    return NextResponse.json({ error: 'Media plan not found' }, { status: 404 });
  }

  // ── Create platform campaigns ─────────────────────────────────────────────
  try {
    const created = await Promise.all(
      campaigns.map((c) =>
        prisma.platformCampaign.create({
          data: {
            campaignId: planId,
            platform: (c.platformType ?? 'GOOGLE').toUpperCase(),
            adTypes: [c.campaignType ?? 'SEARCH'],
            budget: c.budget?.amount ?? 0,
            currency: c.budget?.currency ?? 'USD',
            status: 'reviewing',
            settings: {
              name: c.name,
              campaignType: c.campaignType,
              startDate: c.startDate ?? null,
              endDate: c.endDate ?? null,
              targeting: c.targeting ?? null,
              adGroups: c.adGroups ?? null,
              assetGroups: c.assetGroups ?? null,
              budget: c.budget ?? null
            }
          },
          select: { id: true, platform: true, adTypes: true, budget: true, currency: true, status: true }
        })
      )
    );

    // Update parent campaign: sum daily budgets, set status to REVIEWING if not already
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget?.amount ?? 0), 0);

    await prisma.campaign.update({
      where: { id: planId },
      data: {
        totalBudget,
        currency: campaigns[0]?.budget?.currency ?? parentCampaign.currency,
        startDate: campaigns[0]?.startDate ? new Date(campaigns[0].startDate) : parentCampaign.startDate,
        endDate: campaigns[0]?.endDate ? new Date(campaigns[0].endDate) : parentCampaign.endDate
      }
    });

    // Invalidate campaigns list cache
    void redis
      .del(
        orgKey(orgId, 'campaigns:all:p1'),
        orgKey(orgId, 'campaigns:accelerate:p1')
      )
      .catch(() => {});

    return NextResponse.json({
      plan_id: planId,
      count: created.length,
      campaigns: created
    });
  } catch (err) {
    console.error('[api/v3/media-plan/campaign] create failed:', err);
    return NextResponse.json({ error: 'Failed to create campaigns' }, { status: 500 });
  }
}
