/**
 * GET  /shopping-feeds/markets?orgId=
 * POST /shopping-feeds/markets
 * PATCH /shopping-feeds/markets/:id
 * DELETE /shopping-feeds/markets/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

function buildFeedUrl(orgId: string, marketId: string): string {
  const base = process.env.DASHBOARD_URL ?? 'https://accelerate-dashboard-sable.vercel.app';
  return `${base}/api/shopping-feeds/xml?orgId=${orgId}&marketId=${marketId}&channel=google`;
}

export async function marketsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/markets', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const markets = await prisma.commerceMarket.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
    const enriched = markets.map((m) => ({ ...m, feedUrl: buildFeedUrl(orgId, m.id) }));
    return { markets: enriched };
  });

  fastify.post<{ Body: { orgId: string; marketName: string; targetCountry: string; language: string; currency: string } }>(
    '/shopping-feeds/markets',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, marketName, targetCountry, language, currency } = request.body ?? {};
      if (!orgId || !marketName || !targetCountry || !language || !currency) return reply.status(400).send({ error: 'All fields required' });
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store' });
      const market = await prisma.commerceMarket.create({ data: { organizationId: orgId, connectorId: store.id, marketName, targetCountry, language, currency } });
      return reply.status(201).send({ market: { ...market, feedUrl: buildFeedUrl(orgId, market.id) } });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { orgId: string; marketName?: string; targetCountry?: string; language?: string; currency?: string; isEnabled?: boolean } }>(
    '/shopping-feeds/markets/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });
      const existing = await prisma.commerceMarket.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const updated = await prisma.commerceMarket.update({
        where: { id },
        data: {
          ...(fields.marketName !== undefined && { marketName: fields.marketName }),
          ...(fields.targetCountry !== undefined && { targetCountry: fields.targetCountry }),
          ...(fields.language !== undefined && { language: fields.language }),
          ...(fields.currency !== undefined && { currency: fields.currency }),
          ...(fields.isEnabled !== undefined && { isEnabled: fields.isEnabled })
        }
      });
      return { market: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/markets/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const existing = await prisma.commerceMarket.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.commerceMarket.delete({ where: { id } });
    return { success: true };
  });
}
