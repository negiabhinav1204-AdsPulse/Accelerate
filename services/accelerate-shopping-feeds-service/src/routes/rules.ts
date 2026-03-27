/**
 * GET  /shopping-feeds/rules?orgId=
 * POST /shopping-feeds/rules
 * PATCH /shopping-feeds/rules/:id
 * DELETE /shopping-feeds/rules/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function rulesRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/rules', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
    if (!store) return { rules: [] };
    const rules = await prisma.feedTransformRule.findMany({ where: { organizationId: orgId, connectorId: store.id }, orderBy: { priority: 'asc' } });
    return { rules };
  });

  fastify.post<{ Body: { orgId: string; name: string; channels: string[]; conditions: unknown[]; actions: unknown[]; isActive?: boolean } }>(
    '/shopping-feeds/rules',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, name, channels, conditions, actions, isActive = true } = request.body ?? {};
      if (!orgId || !name) return reply.status(400).send({ error: 'orgId and name required' });
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(404).send({ error: 'No connected store' });
      const maxRule = await prisma.feedTransformRule.findFirst({
        where: { organizationId: orgId, connectorId: store.id },
        orderBy: { priority: 'desc' },
        select: { priority: true }
      });
      const priority = (maxRule?.priority ?? 0) + 1;
      const rule = await prisma.feedTransformRule.create({
        data: { organizationId: orgId, connectorId: store.id, name, channels, conditions: conditions as object[], actions: actions as object[], priority, isActive }
      });
      return reply.status(201).send({ rule });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { orgId: string; name?: string; channels?: string[]; conditions?: unknown[]; actions?: unknown[]; isActive?: boolean; priority?: number } }>(
    '/shopping-feeds/rules/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });
      const existing = await prisma.feedTransformRule.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const updated = await prisma.feedTransformRule.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.channels !== undefined && { channels: fields.channels }),
          ...(fields.conditions !== undefined && { conditions: fields.conditions as object[] }),
          ...(fields.actions !== undefined && { actions: fields.actions as object[] }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive }),
          ...(fields.priority !== undefined && { priority: fields.priority })
        }
      });
      return { rule: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/rules/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const existing = await prisma.feedTransformRule.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.feedTransformRule.delete({ where: { id } });
    return { success: true };
  });
}
