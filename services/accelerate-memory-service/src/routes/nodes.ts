/**
 * Dashboard-facing CRUD routes for memory nodes.
 * Auth is verified by the dashboard before forwarding here.
 * All requests must include x-internal-api-key.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { updateMemoryNodeContent, deleteMemoryNode } from '../lib/memory-service';

function verifyInternalKey(request: { headers: Record<string, unknown> }): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || request.headers['x-internal-api-key'] === key;
}

const patchSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  content: z.record(z.unknown()),
  summary: z.string(),
});

export async function nodesRoute(fastify: FastifyInstance) {
  // GET /memory/nodes?orgId=...
  fastify.get('/memory/nodes', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const nodes = await prisma.orgMemoryNode.findMany({
      where: { orgId, archivedAt: null },
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true, orgId: true, userId: true, type: true, key: true,
        summary: true, content: true, confidence: true, accessCount: true,
        sourceUrl: true, createdAt: true, updatedAt: true,
      },
    });

    return { nodes };
  });

  // PATCH /memory/nodes
  fastify.patch('/memory/nodes', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.issues });

    const { id, orgId, content, summary } = parsed.data;
    await updateMemoryNodeContent(id, orgId, content, summary);
    return { ok: true };
  });

  // DELETE /memory/nodes?id=...&orgId=...
  fastify.delete('/memory/nodes', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const { id, orgId } = request.query as Record<string, string>;
    if (!id || !orgId) return reply.status(400).send({ error: 'id and orgId required' });

    await deleteMemoryNode(id, orgId);
    return { ok: true };
  });
}
