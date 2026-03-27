/**
 * Internal routes consumed by the agent service.
 * All require x-internal-api-key.
 *
 * POST /memory/upsert   — upsert a memory node
 * POST /memory/load     — load org memory nodes by type
 * POST /memory/get      — get single node by type+key
 * POST /memory/prune    — prune low-confidence nodes for an org
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  upsertMemoryNode,
  loadOrgMemory,
  getMemoryNode,
  pruneMemory,
} from '../lib/memory-service';
import type { MemoryNodeType } from '../lib/memory-service';

function verifyInternalKey(request: { headers: Record<string, unknown> }): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || request.headers['x-internal-api-key'] === key;
}

const upsertSchema = z.object({
  orgId: z.string(),
  userId: z.string().optional(),
  type: z.string(),
  key: z.string(),
  summary: z.string(),
  content: z.record(z.unknown()),
  sourceUrl: z.string().optional(),
  confidenceDelta: z.number().optional(),
});

const loadSchema = z.object({
  orgId: z.string(),
  userId: z.string().optional(),
  types: z.array(z.string()).optional(),
});

const getSchema = z.object({
  orgId: z.string(),
  userId: z.string().optional(),
  type: z.string(),
  key: z.string(),
});

const pruneSchema = z.object({ orgId: z.string() });

export async function internalRoute(fastify: FastifyInstance) {
  fastify.post('/memory/upsert', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    await upsertMemoryNode(parsed.data as Parameters<typeof upsertMemoryNode>[0]);
    return { ok: true };
  });

  fastify.post('/memory/load', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = loadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const { orgId, userId, types } = parsed.data;
    const nodes = await loadOrgMemory(orgId, userId, types as MemoryNodeType[] | undefined);
    return { nodes };
  });

  fastify.post('/memory/get', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = getSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const { orgId, userId, type, key } = parsed.data;
    const node = await getMemoryNode(orgId, userId, type as MemoryNodeType, key);
    return { node };
  });

  fastify.post('/memory/prune', async (request, reply) => {
    if (!verifyInternalKey(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = pruneSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    await pruneMemory(parsed.data.orgId);
    return { ok: true };
  });
}
