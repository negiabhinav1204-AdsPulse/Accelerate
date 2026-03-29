/**
 * Campaign CRUD routes — read/update campaigns and compute health scores.
 *
 * Health scoring (ported from Next.js /api/chat/tools/campaigns.ts):
 *   ROAS >= 3.0 → winner
 *   ROAS 1.0-3.0 → underperformer
 *   ROAS < 1.0 → bleeder
 *   spend < $100 → learner
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyInternalKey } from '../auth';

const prisma = new PrismaClient();

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

export async function campaignsRoute(fastify: FastifyInstance) {
  // ── GET /campaigns ─────────────────────────────────────────────────
  fastify.get('/campaigns', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { org_id, status, limit = '20', page = '1' } = request.query as Record<string, string>;

    if (!org_id) return reply.status(400).send({ error: 'org_id required' });

    const where: Record<string, unknown> = { orgId: org_id };
    if (status && status !== 'all') where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      include: { platformCampaigns: true },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    const enriched = campaigns.map((c) => {
      const totalSpend = c.platformCampaigns.reduce((s, p) => s + (p.spend ?? 0), 0);
      const totalRevenue = c.platformCampaigns.reduce((s, p) => s + (p.revenue ?? 0), 0);
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const health = scoreHealth(roas, totalSpend);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: c.dailyBudget,
        totalBudget: c.totalBudget,
        startDate: c.startDate,
        endDate: c.endDate,
        objective: c.objective,
        createdAt: c.createdAt,
        spend: totalSpend,
        revenue: totalRevenue,
        roas,
        health,
        healthRecommendation: healthRecommendation(health),
        platformCampaigns: c.platformCampaigns,
      };
    });

    return reply.send({ campaigns: enriched, total: enriched.length });
  });

  // ── GET /campaigns/:id ─────────────────────────────────────────────
  fastify.get('/campaigns/:id', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { org_id } = request.query as { org_id?: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id, ...(org_id ? { orgId: org_id } : {}) },
      include: { platformCampaigns: true },
    });

    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const totalSpend = campaign.platformCampaigns.reduce((s, p) => s + (p.spend ?? 0), 0);
    const totalRevenue = campaign.platformCampaigns.reduce((s, p) => s + (p.revenue ?? 0), 0);
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const health = scoreHealth(roas, totalSpend);

    return reply.send({
      ...campaign,
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

    const campaign = await prisma.campaign.findFirst({ where: { id, orgId: org_id } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    await prisma.campaign.update({ where: { id }, data: { status } });
    await prisma.platformCampaign.updateMany({ where: { campaignId: id }, data: { status } });

    return reply.send({ success: true, campaign_id: id, status });
  });

  // ── PATCH /campaigns/:id/budget ────────────────────────────────────
  fastify.patch('/campaigns/:id/budget', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { org_id, daily_budget, type = 'absolute' } = request.body as {
      org_id: string;
      daily_budget: number;
      type?: string;
    };

    const campaign = await prisma.campaign.findFirst({ where: { id, orgId: org_id } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const newBudget = type === 'percent'
      ? (campaign.dailyBudget ?? 0) * (1 + daily_budget / 100)
      : daily_budget;

    await prisma.campaign.update({
      where: { id },
      data: { dailyBudget: newBudget },
    });

    return reply.send({ success: true, campaign_id: id, new_budget: newBudget });
  });

  // ── POST /campaigns/health-batch ───────────────────────────────────
  fastify.post('/campaigns/health-batch', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { org_id } = request.body as { org_id: string; days?: number };

    const campaigns = await prisma.campaign.findMany({
      where: { orgId: org_id },
      include: { platformCampaigns: true },
    });

    const result = campaigns.map((c) => {
      const totalSpend = c.platformCampaigns.reduce((s, p) => s + (p.spend ?? 0), 0);
      const totalRevenue = c.platformCampaigns.reduce((s, p) => s + (p.revenue ?? 0), 0);
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
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
