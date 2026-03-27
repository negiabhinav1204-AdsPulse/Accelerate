/**
 * GET  /shopping-feeds/delivery-rules?orgId=
 * POST /shopping-feeds/delivery-rules
 * PATCH /shopping-feeds/delivery-rules/:id
 * DELETE /shopping-feeds/delivery-rules/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function deliveryRulesRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/delivery-rules', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const rules = await prisma.deliverySpeedRule.findMany({ where: { organizationId: orgId }, orderBy: [{ countryCode: 'asc' }, { createdAt: 'asc' }] });
    return { rules };
  });

  fastify.post<{ Body: { orgId: string; countryCode: string; carrier: string; service: string; minTransitDays: number; maxTransitDays: number; cutoffHour?: number; price?: number | null } }>(
    '/shopping-feeds/delivery-rules',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, countryCode, carrier, service, minTransitDays, maxTransitDays, cutoffHour, price } = request.body ?? {};
      if (!orgId || !countryCode || !carrier || !service || minTransitDays == null || maxTransitDays == null) {
        return reply.status(400).send({ error: 'Required fields missing' });
      }
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store' });
      const rule = await prisma.deliverySpeedRule.create({ data: { organizationId: orgId, connectorId: store.id, countryCode, carrier, service, minTransitDays, maxTransitDays, cutoffHour: cutoffHour ?? 17, price: price != null ? price : null } });
      return reply.status(201).send({ rule });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { orgId: string; countryCode?: string; carrier?: string; service?: string; minTransitDays?: number; maxTransitDays?: number; cutoffHour?: number; price?: number | null; isActive?: boolean } }>(
    '/shopping-feeds/delivery-rules/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });
      const existing = await prisma.deliverySpeedRule.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const updated = await prisma.deliverySpeedRule.update({
        where: { id },
        data: {
          ...(fields.countryCode !== undefined && { countryCode: fields.countryCode }),
          ...(fields.carrier !== undefined && { carrier: fields.carrier }),
          ...(fields.service !== undefined && { service: fields.service }),
          ...(fields.minTransitDays !== undefined && { minTransitDays: fields.minTransitDays }),
          ...(fields.maxTransitDays !== undefined && { maxTransitDays: fields.maxTransitDays }),
          ...(fields.cutoffHour !== undefined && { cutoffHour: fields.cutoffHour }),
          ...('price' in fields && { price: fields.price ?? null }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive })
        }
      });
      return { rule: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/delivery-rules/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const existing = await prisma.deliverySpeedRule.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.deliverySpeedRule.delete({ where: { id } });
    return { success: true };
  });
}
