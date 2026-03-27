/**
 * GET  /shopping-feeds/zombie-sku?orgId=
 * PATCH /shopping-feeds/zombie-sku
 * POST /shopping-feeds/zombie-sku/label
 * POST /shopping-feeds/zombie-sku/create-campaign
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

type ZombieSkuConfig = {
  enabled: boolean;
  minDaysSinceLastImpression: number;
  maxImpressions: number;
  maxClicks: number;
  customLabel: 'custom_label_0' | 'custom_label_1' | 'custom_label_2' | 'custom_label_3' | 'custom_label_4';
  labelValue: string;
};

const DEFAULT_CONFIG: ZombieSkuConfig = {
  enabled: true,
  minDaysSinceLastImpression: 30,
  maxImpressions: 100,
  maxClicks: 10,
  customLabel: 'custom_label_0',
  labelValue: 'zombie_sku'
};

export async function zombieRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/zombie-sku', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const settings = await prisma.shoppingFeedSettings.findFirst({ where: { organizationId: orgId }, select: { zombieSkuConfig: true } });
    const config = (settings?.zombieSkuConfig as ZombieSkuConfig | null) ?? DEFAULT_CONFIG;
    return { config };
  });

  fastify.patch<{ Body: { orgId: string; config: ZombieSkuConfig } }>('/shopping-feeds/zombie-sku', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId, config } = request.body ?? {};
    if (!orgId || !config) return reply.status(400).send({ error: 'orgId and config required' });
    const existing = await prisma.shoppingFeedSettings.findFirst({ where: { organizationId: orgId }, select: { id: true } });
    if (!existing) {
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store' });
      await prisma.shoppingFeedSettings.create({ data: { organizationId: orgId, connectorId: store.id, zombieSkuConfig: config as object } });
    } else {
      await prisma.shoppingFeedSettings.update({ where: { id: existing.id }, data: { zombieSkuConfig: config as object } });
    }
    return { config };
  });

  fastify.post<{ Body: { orgId: string; productIds: string[]; customLabel: string; labelValue: string } }>(
    '/shopping-feeds/zombie-sku/label',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, productIds, customLabel, labelValue } = request.body ?? {};
      if (!orgId || !productIds?.length || !customLabel || !labelValue) {
        return reply.status(400).send({ error: 'orgId, productIds, customLabel, labelValue required' });
      }
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store' });

      let labeled = 0;
      for (const externalProductId of productIds) {
        const existing = await prisma.feedProduct.findFirst({
          where: { connectorId: store.id, externalProductId },
          select: { id: true, customLabels: true }
        });
        const updatedLabels = { ...((existing?.customLabels as Record<string, string> | null) ?? {}), [customLabel]: labelValue };
        if (existing) {
          await prisma.feedProduct.update({ where: { id: existing.id }, data: { customLabels: updatedLabels } });
        } else {
          await prisma.feedProduct.create({ data: { organizationId: orgId, connectorId: store.id, externalProductId, title: externalProductId, price: 0, customLabels: updatedLabels } });
        }
        labeled++;
      }
      return { labeled };
    }
  );

  fastify.post<{ Body: { orgId: string; campaignName: string; dailyBudget: number; labelValue: string; productCount: number; userId: string } }>(
    '/shopping-feeds/zombie-sku/create-campaign',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, campaignName, dailyBudget, labelValue, productCount, userId } = request.body ?? {};
      if (!orgId || !campaignName || !dailyBudget) return reply.status(400).send({ error: 'orgId, campaignName, dailyBudget required' });

      const mediaPlan = {
        campaignName,
        objective: 'Shopping — Zombie SKU Recovery',
        channels: ['Google Shopping'],
        budget: { daily: dailyBudget, currency: 'USD' },
        targeting: { customLabel: labelValue, productCount, strategy: 'Standard Shopping — custom_label filter' },
        adFormats: ['Product Listing Ad'],
        notes: `Auto-created Zombie SKU recovery campaign. Targets ${productCount} low-visibility product(s) labeled "${labelValue}". Increase bids to resurface these products in Google Shopping.`
      };

      const campaign = await prisma.campaign.create({
        data: { organizationId: orgId, createdBy: userId, name: campaignName, status: 'DRAFT', objective: 'Shopping', source: 'shopping_feeds', mediaPlan: mediaPlan as object }
      });
      return reply.status(201).send({ campaign });
    }
  );
}
