/**
 * POST /campaigns/publish
 *
 * Receives a media plan from the agentic service and:
 * 1. Creates a Campaign record in DB
 * 2. Creates PlatformCampaign rows (status=draft)
 * 3. Runs the reconciliation engine to publish on each platform
 * 4. Updates PlatformCampaign rows with external ids + lastAppliedState
 * 5. Sends admin notifications for the outcome
 * 6. Returns { success, campaign_id, run_id, platform_results }
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@workspace/database/client';
import { verifyInternalKey } from '../auth.js';
import type { MediaPlan, ConnectedAccount } from '../reconcile/adapters/types.js';
import { buildPlatformGraph } from '../reconcile/graph.js';
import { runReconcile } from '../reconcile/executor.js';
import { metaAdapter } from '../reconcile/adapters/meta.js';
import { googleAdapter } from '../reconcile/adapters/google.js';
import { bingAdapter } from '../reconcile/adapters/bing.js';

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function publishRoute(fastify: FastifyInstance) {
  fastify.post('/campaigns/publish', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { org_id, media_plan, connected_accounts, user_id } = request.body as {
      org_id: string;
      media_plan: MediaPlan;
      connected_accounts: ConnectedAccount[];
      user_id: string;
    };

    if (!org_id || !media_plan || !connected_accounts || !user_id) {
      return reply.status(400).send({ error: 'org_id, media_plan, connected_accounts, and user_id are required' });
    }

    // Create Campaign record in DB using the shared schema fields
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org_id,
        createdBy: user_id,
        name: media_plan.campaignName,
        status: 'DRAFT',
        objective: media_plan.objective,
        totalBudget: media_plan.totalBudget ?? 0,
        currency: media_plan.currency ?? 'USD',
        startDate: media_plan.startDate ? new Date(media_plan.startDate) : null,
        endDate: media_plan.endDate ? new Date(media_plan.endDate) : null,
      },
    });

    const adapters = { meta: metaAdapter, google: googleAdapter, bing: bingAdapter } as const;
    const platforms: Parameters<typeof runReconcile>[0]['platforms'] = [];

    for (const pp of media_plan.platforms) {
      const account = connected_accounts.find((a) => a.platform === pp.platform);
      if (!account?.accessToken) continue;

      const pc = await prisma.platformCampaign.create({
        data: {
          campaignId: campaign.id,
          platform: pp.platform,
          adTypes: pp.adTypes.map((t) => t.adType),
          budget: pp.budget,
          status: 'draft',
        },
      });

      const nodes = buildPlatformGraph({
        platform: pp.platform as 'meta' | 'google' | 'bing',
        campaignLocalId: pc.id,
        campaignDesired: { name: media_plan.campaignName, objective: media_plan.objective },
        budget: { localId: `${pc.id}-budget`, desired: { amount: pp.budget } },
        adGroups: pp.adTypes.map((t, i) => ({ localId: `${pc.id}-ag${i}`, desired: { name: t.adType }, ads: [] })),
      });

      const adapter = adapters[pp.platform as keyof typeof adapters];
      if (!adapter) continue;

      platforms.push({ platform: pp.platform as 'meta' | 'google' | 'bing', nodes, adapter, ctx: { account, mediaPlan: media_plan } });
    }

    const summary = await runReconcile({ campaignId: campaign.id, organizationId: org_id, trigger: 'publish', platforms });

    // Update PlatformCampaign rows with external ids + lastAppliedState
    for (const r of summary.platformResults) {
      if (r.success && r.externalId) {
        await prisma.platformCampaign.updateMany({
          where: { campaignId: campaign.id, platform: r.platform },
          data: {
            platformCampaignId: r.externalId,
            status: 'paused',
            lastAppliedState: { name: media_plan.campaignName, budget: media_plan.totalBudget },
          },
        });
      }
    }

    if (summary.status !== 'FAILED') {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
    }

    // Notify org admins of publish outcome
    try {
      const org = await prisma.organization.findUnique({
        where: { id: org_id },
        select: { slug: true },
      });
      const orgSlug = org?.slug ?? '';

      const adminMemberships = await prisma.membership.findMany({
        where: { organizationId: org_id, OR: [{ isOwner: true }, { role: 'ADMIN' }] },
        select: { userId: true },
      });
      const userIds = adminMemberships.map((m: { userId: string }) => m.userId);

      if (userIds.length > 0) {
        const successPlatforms = summary.platformResults.filter((r) => r.success).map((r) => r.platform).join(', ');
        const failedPlatforms = summary.platformResults.filter((r) => !r.success).map((r) => r.platform).join(', ');
        const anySuccess = summary.platformResults.some((r) => r.success);
        const anyFailure = summary.platformResults.some((r) => !r.success);

        if (anySuccess && !anyFailure) {
          // Full success
          await prisma.notification.createMany({
            data: userIds.map((userId: string) => ({
              userId,
              organizationId: org_id,
              type: 'campaign_published',
              subject: `"${media_plan.campaignName}" is live`,
              content: `Campaign published successfully on ${successPlatforms}. Review performance in your dashboard.`,
              link: `/organizations/${orgSlug}/campaigns`,
            })),
          });
        } else if (anySuccess && anyFailure) {
          // Partial success
          await prisma.notification.createMany({
            data: userIds.map((userId: string) => ({
              userId,
              organizationId: org_id,
              type: 'campaign_failed',
              subject: `"${media_plan.campaignName}" partially published`,
              content: `Published on ${successPlatforms}. Failed on ${failedPlatforms}. Tap to review and retry.`,
              link: `/organizations/${orgSlug}/campaigns?filter=failed`,
            })),
          });
        } else {
          // Full failure (or no platforms attempted)
          await prisma.notification.createMany({
            data: userIds.map((userId: string) => ({
              userId,
              organizationId: org_id,
              type: 'campaign_failed',
              subject: `"${media_plan.campaignName}" failed to publish`,
              content: `Failed on ${failedPlatforms}. ${summary.platformResults.find((r) => !r.success)?.error ?? 'Check your account connections and retry.'}`,
              link: `/organizations/${orgSlug}/campaigns?filter=failed`,
            })),
          });
        }
      }
    } catch (notifErr) {
      // Non-critical — log but don't fail the publish response
      console.error('[publish] notification error:', notifErr);
    }

    return reply.send({
      success: summary.status !== 'FAILED',
      campaign_id: campaign.id,
      run_id: summary.runId,
      platform_results: summary.platformResults,
    });
  });
}
