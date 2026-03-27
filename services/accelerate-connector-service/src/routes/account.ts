/**
 * DELETE /connectors/:platform/accounts/:accountId — archive a single sub-account.
 * Admin check is performed by the dashboard before forwarding here.
 * All requests must include x-internal-api-key.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyInternalKey(headers: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || headers['x-internal-api-key'] === key;
}

type DeleteBody = { orgId: string };

export async function accountRoute(fastify: FastifyInstance) {
  fastify.delete<{ Params: { platform: string; accountId: string }; Body: DeleteBody }>(
    '/connectors/:platform/accounts/:accountId',
    async (request, reply) => {
      if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { platform, accountId } = request.params;
      const { orgId } = request.body ?? {};

      if (!orgId) return reply.status(400).send({ error: 'orgId required' });

      const platformLower = platform.toLowerCase();
      const now = new Date();

      const account = await prisma.connectedAdAccount.findFirst({
        where: { organizationId: orgId, platform: platformLower, accountId, archivedAt: null },
        select: { id: true }
      });

      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      await prisma.$transaction([
        prisma.adPlatformReport.updateMany({
          where: { connectedAccountId: account.id },
          data: { archivedAt: now }
        }),
        prisma.connectedAdAccount.update({
          where: { id: account.id },
          data: { archivedAt: now, status: 'disconnected', isDefault: false }
        })
      ]);

      return { ok: true };
    }
  );
}
