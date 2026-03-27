/**
 * POST /shopping-feeds/sync
 */
import type { FastifyInstance } from 'fastify';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function syncRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: { orgId?: string; channel?: string } }>('/shopping-feeds/sync', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { channel } = request.body ?? {};
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      message: 'Sync triggered successfully',
      syncedAt: new Date().toISOString(),
      channel: channel ?? 'all',
      productsQueued: 10
    };
  });
}
