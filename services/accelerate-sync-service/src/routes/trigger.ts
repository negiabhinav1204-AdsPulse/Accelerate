import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/db';
import { symmetricDecrypt } from '../lib/encryption';
import { runPlatformSync } from '../lib/data-pipeline/sync';
import type { PlatformSyncSummary } from '../lib/data-pipeline/types';

const bodySchema = z.object({ orgId: z.string() });

export async function triggerRoute(fastify: FastifyInstance) {
  fastify.post('/sync/trigger', async (request, reply) => {
    // Auth: INTERNAL_API_KEY (called from dashboard) or CRON_SECRET
    const internalKey = process.env.INTERNAL_API_KEY;
    if (internalKey && request.headers['x-internal-api-key'] !== internalKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'orgId is required' });
    }

    const { orgId } = parsed.data;

    const accounts = await prisma.connectedAdAccount.findMany({
      where: { organizationId: orgId, archivedAt: null, status: 'connected' },
      select: { id: true, organizationId: true, platform: true, accountId: true, accessToken: true },
    });

    const results: PlatformSyncSummary[] = [];

    for (const account of accounts) {
      if (!account.accessToken) continue;
      const decryptedToken = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!);
      const summary = await runPlatformSync({
        id: account.id,
        organizationId: account.organizationId,
        platform: account.platform,
        accountId: account.accountId,
        accessToken: decryptedToken,
      });
      results.push(summary);
    }

    return { synced: results.length, results };
  });
}
