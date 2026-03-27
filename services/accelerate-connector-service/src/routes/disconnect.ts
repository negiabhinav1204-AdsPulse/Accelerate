/**
 * POST /connectors/:platform/disconnect — archive all accounts for org+platform.
 * Admin check is performed by the dashboard before forwarding here.
 * All requests must include x-internal-api-key.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyInternalKey(headers: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || headers['x-internal-api-key'] === key;
}

type DisconnectBody = { orgId: string };

export async function disconnectRoute(fastify: FastifyInstance) {
  fastify.post<{ Params: { platform: string }; Body: DisconnectBody }>(
    '/connectors/:platform/disconnect',
    async (request, reply) => {
      if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { platform } = request.params;
      const { orgId } = request.body ?? {};

      if (!orgId) return reply.status(400).send({ error: 'orgId required' });

      const platformLower = platform.toLowerCase();
      const now = new Date();

      const accounts = await prisma.connectedAdAccount.findMany({
        where: { organizationId: orgId, platform: platformLower, archivedAt: null },
        select: { id: true }
      });

      if (accounts.length === 0) {
        return { ok: true };
      }

      const accountIds = accounts.map((a) => a.id);

      await prisma.$transaction([
        prisma.adPlatformReport.updateMany({
          where: { connectedAccountId: { in: accountIds } },
          data: { archivedAt: now }
        }),
        prisma.connectedAdAccount.updateMany({
          where: { id: { in: accountIds } },
          data: {
            archivedAt: now,
            status: 'disconnected',
            isDefault: false,
            accessToken: null,
            refreshToken: null
          }
        })
      ]);

      return { ok: true };
    }
  );
}
