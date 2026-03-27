/**
 * GET  /shopping-feeds/advanced-settings?orgId=
 * PATCH /shopping-feeds/advanced-settings
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function advancedSettingsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/advanced-settings', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const settings = await prisma.shoppingFeedSettings.findFirst({
      where: { organizationId: orgId },
      select: { buyOnGoogleEnabled: true, localInventoryEnabled: true }
    });
    return { buyOnGoogleEnabled: settings?.buyOnGoogleEnabled ?? false, localInventoryEnabled: settings?.localInventoryEnabled ?? false };
  });

  fastify.patch<{ Body: { orgId: string; buyOnGoogleEnabled?: boolean; localInventoryEnabled?: boolean } }>(
    '/shopping-feeds/advanced-settings',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });

      const existing = await prisma.shoppingFeedSettings.findFirst({ where: { organizationId: orgId }, select: { id: true } });
      if (existing) {
        await prisma.shoppingFeedSettings.update({
          where: { id: existing.id },
          data: {
            ...(fields.buyOnGoogleEnabled !== undefined && { buyOnGoogleEnabled: fields.buyOnGoogleEnabled }),
            ...(fields.localInventoryEnabled !== undefined && { localInventoryEnabled: fields.localInventoryEnabled })
          }
        });
      } else {
        const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
        if (!store) return reply.status(400).send({ error: 'No connected store' });
        await prisma.shoppingFeedSettings.create({
          data: {
            organizationId: orgId,
            connectorId: store.id,
            buyOnGoogleEnabled: fields.buyOnGoogleEnabled ?? false,
            localInventoryEnabled: fields.localInventoryEnabled ?? false
          }
        });
      }
      return { success: true };
    }
  );
}
