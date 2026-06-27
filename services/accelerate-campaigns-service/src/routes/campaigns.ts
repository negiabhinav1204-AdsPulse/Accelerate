/**
 * Campaign CRUD routes — read/update campaigns and compute health scores.
 *
 * Health scoring (ported from Next.js /api/chat/tools/campaigns.ts):
 *   ROAS >= 3.0 → winner
 *   ROAS 1.0-3.0 → underperformer
 *   ROAS < 1.0 → bleeder
 *   spend < $100 → learner
 *
 * NOTE: PlatformCampaign no longer carries spend/revenue in the shared schema.
 * Both fields are stubbed to 0 until an analytics ingestion layer is added.
 * dailyBudget is not in the shared Campaign model; budget endpoint now operates
 * on totalBudget. External API shape is preserved for dashboard compatibility.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@workspace/database/client';
import { CampaignStatus } from '@workspace/database';
import { verifyInternalKey } from '../auth.js';

function scoreHealth(roas: number, spend: number): string {
  if (spend < 100) return 'learner';
  if (roas >= 3.0) return 'winner';
  if (roas >= 1.0) return 'underperformer';
  return 'bleeder';
}

function healthRecommendation(category: string): string {
  switch (category) {
    case 'winner': return 'Scale budget — strong ROAS.';
    case 'learner': return 'Allow more spend to gather data before optimizing.';
    case 'underperformer': return 'Review targeting and creatives — ROAS below 3x.';
    case 'bleeder': return 'Pause or significantly reduce budget — negative ROAS.';
    default: return 'Review performance.';
  }
}

/** Map external status strings ('paused'|'active') to CampaignStatus enum values. */
function mapExternalStatus(status: string): CampaignStatus {
  if (status === 'paused') return CampaignStatus.PAUSED;
  if (status === 'active') return CampaignStatus.LIVE;
  throw new Error(`Unknown status: ${status}`);
}

export async function campaignsRoute(fastify: FastifyInstance) {
  // ── GET /campaigns ─────────────────────────────────────────────────
  fastify.get('/campaigns', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { org_id, status, limit = '20', page = '1' } = request.query as Record<string, string>;

    if (!org_id) return reply.status(400).send({ error: 'org_id required' });

    const where: Record<string, unknown> = { organizationId: org_id };
    if (status && status !== 'all') {
      // Accept both external values ('paused','active') and direct enum values
      try {
        where.status = mapExternalStatus(status);
      } catch {
        // Assume it's already a valid CampaignStatus string (e.g. 'DRAFT')
        where.status = status;
      }
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: { platformCampaigns: true },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    const enriched = campaigns.map((c) => {
      // spend/revenue not stored on PlatformCampaign in shared schema — stub to 0
      const totalSpend = 0;
      const totalRevenue = 0;
      const roas = 0;
      const health = scoreHealth(roas, totalSpend);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: null, // not in shared schema
        totalBudget: Number(c.totalBudget),
        startDate: c.startDate,
        endDate: c.endDate,
        objective: c.objective,
        createdAt: c.createdAt,
        spend: totalSpend,
        revenue: totalRevenue,
        roas,
        health,
        healthRecommendation: healthRecommendation(health),
        platformCampaigns: c.platformCampaigns.map((p) => ({
          ...p,
          budget: Number(p.budget),
        })),
      };
    });

    return reply.send({ campaigns: enriched, total: enriched.length });
  });

  // ── GET /campaigns/:id ─────────────────────────────────────────────
  fastify.get('/campaigns/:id', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { org_id } = request.query as { org_id?: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, ...(org_id ? { organizationId: org_id } : {}) },
      include: { platformCampaigns: true },
    });

    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    // spend/revenue not stored on PlatformCampaign in shared schema — stub to 0
    const totalSpend = 0;
    const totalRevenue = 0;
    const roas = 0;
    const health = scoreHealth(roas, totalSpend);

    return reply.send({
      ...campaign,
      totalBudget: Number(campaign.totalBudget),
      dailyBudget: null, // not in shared schema
      platformCampaigns: campaign.platformCampaigns.map((p) => ({
        ...p,
        budget: Number(p.budget),
      })),
      spend: totalSpend,
      revenue: totalRevenue,
      roas,
      health,
      healthRecommendation: healthRecommendation(health),
    });
  });

  // ── PATCH /campaigns/:id/status ────────────────────────────────────
  fastify.patch('/campaigns/:id/status', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { org_id, status } = request.body as { org_id: string; status: string };

    if (!['paused', 'active'].includes(status)) {
      return reply.status(400).send({ error: "status must be 'paused' or 'active'" });
    }

    const campaign = await prisma.campaign.findFirst({ where: { id, organizationId: org_id } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const mappedStatus = mapExternalStatus(status);

    await prisma.campaign.update({ where: { id }, data: { status: mappedStatus } });
    // PlatformCampaign.status is a plain string — keep lowercase values
    await prisma.platformCampaign.updateMany({
      where: { campaignId: id },
      data: { status: status === 'active' ? 'live' : 'paused' },
    });

    return reply.send({ success: true, campaign_id: id, status });
  });

  // ── PATCH /campaigns/:id/budget ────────────────────────────────────
  // NOTE: shared schema has no dailyBudget on Campaign. The field `daily_budget`
  // in the request is now applied to totalBudget. Response key `new_budget` is
  // preserved for dashboard compatibility.
  fastify.patch('/campaigns/:id/budget', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { org_id, daily_budget, type = 'absolute' } = request.body as {
      org_id: string;
      daily_budget: number;
      type?: string;
    };

    const campaign = await prisma.campaign.findFirst({ where: { id, organizationId: org_id } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const currentBudget = Number(campaign.totalBudget);
    const newBudget = type === 'percent'
      ? currentBudget * (1 + daily_budget / 100)
      : daily_budget;

    await prisma.campaign.update({
      where: { id },
      data: { totalBudget: newBudget },
    });

    return reply.send({ success: true, campaign_id: id, new_budget: newBudget });
  });

  // ── POST /campaigns/health-batch ───────────────────────────────────
  fastify.post('/campaigns/health-batch', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { org_id } = request.body as { org_id: string; days?: number };

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: org_id },
      include: { platformCampaigns: true },
    });

    const result = campaigns.map((c) => {
      // spend/revenue not stored on PlatformCampaign in shared schema — stub to 0
      const totalSpend = 0;
      const totalRevenue = 0;
      const roas = 0;
      const health = scoreHealth(roas, totalSpend);

      return {
        id: c.id,
        name: c.name,
        platform: c.platformCampaigns[0]?.platform ?? 'unknown',
        spend: totalSpend,
        revenue: totalRevenue,
        roas,
        health,
        recommendation: healthRecommendation(health),
      };
    });

    return reply.send({ campaigns: result });
  });
}
