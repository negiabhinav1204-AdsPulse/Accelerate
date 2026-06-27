/**
 * POST /campaigns/:id/apply
 *
 * Re-runs the reconciliation engine for an existing campaign after a desired-state edit.
 * Loads the campaign + platformCampaigns, builds graphs with existing externalIds and
 * lastAppliedState (so diff produces UPDATE/NOOP/DELETE rather than CREATE), then
 * calls runReconcile with trigger='edit'.
 *
 * Returns { success, campaign_id, run_id, platform_results }
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@workspace/database/client';
import { verifyInternalKey } from '../auth.js';
import { buildPlatformGraph } from '../reconcile/graph.js';
import { runReconcile } from '../reconcile/executor.js';
import { metaAdapter } from '../reconcile/adapters/meta.js';
import { googleAdapter } from '../reconcile/adapters/google.js';
import { bingAdapter } from '../reconcile/adapters/bing.js';
import type { ConnectedAccount, MediaPlan } from '../reconcile/adapters/types.js';

const adapters = { meta: metaAdapter, google: googleAdapter, bing: bingAdapter } as const;

export async function applyRoute(fastify: FastifyInstance) {
  fastify.post('/campaigns/:id/apply', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { connected_accounts, media_plan } = request.body as {
      connected_accounts: ConnectedAccount[];
      media_plan: MediaPlan;
    };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { platformCampaigns: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'campaign not found' });

    const platforms: Parameters<typeof runReconcile>[0]['platforms'] = [];

    for (const pc of campaign.platformCampaigns) {
      const account = connected_accounts.find((a) => a.platform === pc.platform);
      if (!account?.accessToken) continue;

      const adapter = adapters[pc.platform as keyof typeof adapters];
      if (!adapter) continue;

      const nodes = buildPlatformGraph({
        platform: pc.platform as 'meta' | 'google' | 'bing',
        campaignLocalId: pc.id,
        campaignExternalId: pc.platformCampaignId ?? undefined,
        campaignDesired: { name: campaign.name, objective: campaign.objective },
        campaignLastApplied: (pc.lastAppliedState as Record<string, unknown>) ?? null,
        budget: { localId: `${pc.id}-budget`, desired: { amount: Number(pc.budget) } },
        adGroups: [],
      });

      platforms.push({
        platform: pc.platform as 'meta' | 'google' | 'bing',
        nodes,
        adapter,
        ctx: { account, mediaPlan: media_plan },
      });
    }

    const summary = await runReconcile({
      campaignId: campaign.id,
      organizationId: campaign.organizationId,
      trigger: 'edit',
      platforms,
    });

    return reply.send({
      success: summary.status !== 'FAILED',
      campaign_id: campaign.id,
      run_id: summary.runId,
      platform_results: summary.platformResults,
    });
  });
}
