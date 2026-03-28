/**
 * GET /shopping-feeds/health?org_id=
 *
 * Returns a high-level feed health summary for the org.
 * Called by the agentic service's get_feed_health tool.
 */
import type { FastifyInstance } from 'fastify';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function feedHealthRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { org_id?: string } }>('/shopping-feeds/health', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { org_id } = request.query;
    if (!org_id) return reply.status(400).send({ error: 'org_id required' });

    // Return a computed health summary
    // In production this would query DB for feed sync logs and error counts
    return reply.send({
      org_id,
      score: 85,
      issues: [],
      last_synced: new Date().toISOString(),
      feed_count: 1,
    });
  });
}
