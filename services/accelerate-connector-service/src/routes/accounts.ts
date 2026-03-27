/**
 * GET  /connectors/:platform/accounts?orgId=  — list active accounts
 * PATCH /connectors/:platform/accounts         — set default account + trigger sync
 *
 * Auth is verified by the dashboard before forwarding here.
 * All requests must include x-internal-api-key.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyInternalKey(headers: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || headers['x-internal-api-key'] === key;
}

async function triggerSync(orgId: string): Promise<void> {
  const syncUrl = process.env.SYNC_SERVICE_URL;
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!syncUrl || !internalKey) return;

  void fetch(`${syncUrl}/sync/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-api-key': internalKey },
    body: JSON.stringify({ orgId })
  }).catch((e: unknown) => console.error('[connector] sync trigger failed:', e));
}

type PatchBody = { orgId: string; accountId: string };

export async function accountsRoute(fastify: FastifyInstance) {
  // GET /connectors/:platform/accounts?orgId=...
  fastify.get<{ Params: { platform: string } }>('/connectors/:platform/accounts', async (request, reply) => {
    if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { platform } = request.params;
    const { orgId } = request.query as Record<string, string>;

    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const accounts = await prisma.connectedAdAccount.findMany({
      where: {
        organizationId: orgId,
        platform: platform.toLowerCase(),
        archivedAt: null
      },
      select: {
        id: true,
        accountId: true,
        accountName: true,
        isDefault: true,
        status: true,
        lastSyncAt: true
      },
      orderBy: { connectedAt: 'asc' }
    });

    return accounts;
  });

  // PATCH /connectors/:platform/accounts — set default account
  fastify.patch<{ Params: { platform: string }; Body: PatchBody }>('/connectors/:platform/accounts', async (request, reply) => {
    if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { platform } = request.params;
    const { orgId, accountId } = request.body ?? {};

    if (!orgId || !accountId) {
      return reply.status(400).send({ error: 'orgId and accountId required' });
    }

    const platformLower = platform.toLowerCase();

    const targetAccount = await prisma.connectedAdAccount.findFirst({
      where: { organizationId: orgId, platform: platformLower, accountId, archivedAt: null },
      select: { id: true }
    });

    if (!targetAccount) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    await prisma.$transaction([
      prisma.connectedAdAccount.updateMany({
        where: { organizationId: orgId, platform: platformLower, archivedAt: null },
        data: { isDefault: false }
      }),
      prisma.connectedAdAccount.update({
        where: { id: targetAccount.id },
        data: { isDefault: true }
      })
    ]);

    // Fire sync for new default (best-effort, uses sync service if available)
    void triggerSync(orgId);

    return { ok: true };
  });
}
