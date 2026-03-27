import type { FastifyInstance } from 'fastify';

import { prisma } from '../lib/db';
import { symmetricDecrypt } from '../lib/encryption';
import { runPlatformSync } from '../lib/data-pipeline/sync';
import type { PlatformSyncSummary } from '../lib/data-pipeline/types';

export async function cronRoute(fastify: FastifyInstance) {
  fastify.get('/sync/cron', async (request, reply) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.authorization;
      if (auth !== `Bearer ${cronSecret}`) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }

    const accounts = await prisma.connectedAdAccount.findMany({
      where: { archivedAt: null, status: 'connected' },
      select: { id: true, organizationId: true, platform: true, accountId: true, accessToken: true },
    });

    const results: PlatformSyncSummary[] = [];
    const errors: { accountId: string; error: string }[] = [];

    for (const account of accounts) {
      if (!account.accessToken) continue;
      try {
        const decryptedToken = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!);
        const summary = await runPlatformSync({
          id: account.id,
          organizationId: account.organizationId,
          platform: account.platform,
          accountId: account.accountId,
          accessToken: decryptedToken,
        });
        results.push(summary);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ accountId: account.accountId, error: message });
        fastify.log.error({ accountId: account.accountId, err }, '[cron] sync failed');
      }
    }

    return { synced: results.length, failed: errors.length, results, errors, ranAt: new Date().toISOString() };
  });
}
