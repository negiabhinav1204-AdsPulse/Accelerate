/**
 * POST /campaigns/publish
 *
 * Receives a media plan from the agentic service and:
 * 1. Creates campaigns on Meta, Google, and Bing (status=PAUSED)
 * 2. Saves PlatformCampaign records to DB
 * 3. Creates a Campaign record tied to the org
 * 4. Returns { campaign_id, platform_results }
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@workspace/database/client';
import { verifyInternalKey } from '../auth.js';
import type { MediaPlan, ConnectedAccount } from '../reconcile/adapters/types';
import { createMetaCampaign } from '../reconcile/adapters/meta';
import { createGoogleCampaign } from '../reconcile/adapters/google';
import { createBingCampaign } from '../reconcile/adapters/bing';

// ---------------------------------------------------------------------------
// Local types (not shared with adapters)
// ---------------------------------------------------------------------------

type PlatformPublishResult = {
  platform: string;
  success: boolean;
  platformCampaignId?: string;
  error?: string;
};

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

    const platformResults: PlatformPublishResult[] = [];

    const platformPushPromises = media_plan.platforms.map(async (platformPlan) => {
      const { platform } = platformPlan;
      const account = connected_accounts.find((a) => a.platform === platform);

      if (!account?.accessToken) {
        platformResults.push({ platform, success: false, error: `No connected ${platform} account with access token` });
        return;
      }

      try {
        let platformCampaignId: string | undefined;

        if (platform === 'meta') {
          platformCampaignId = await createMetaCampaign(account.accountId, account.accessToken, media_plan, account.facebookPageId);
        } else if (platform === 'google') {
          const devToken = account.developerToken ?? process.env.GOOGLE_DEVELOPER_TOKEN;
          if (!devToken) {
            platformResults.push({ platform, success: false, error: 'Google Ads developer token not configured' });
            return;
          }
          platformCampaignId = await createGoogleCampaign(account.accountId, account.accessToken, devToken, media_plan);
        } else if (platform === 'bing') {
          const devToken = account.developerToken ?? process.env.BING_DEVELOPER_TOKEN;
          if (!devToken) {
            platformResults.push({ platform, success: false, error: 'Microsoft Ads developer token not configured' });
            return;
          }
          const customerId = account.customerId ?? account.accountId;
          platformCampaignId = await createBingCampaign(account.accountId, customerId, account.accessToken, devToken, media_plan);
        }

        if (platformCampaignId !== undefined) {
          await prisma.platformCampaign.create({
            data: {
              campaignId: campaign.id,
              platform,
              platformCampaignId,
              adTypes: platformPlan.adTypes.map((at) => at.adType),
              budget: platformPlan.budget,
              status: 'paused',
            },
          });
        }

        platformResults.push({ platform, success: true, platformCampaignId });
      } catch (err) {
        platformResults.push({ platform, success: false, error: err instanceof Error ? err.message : `${platform} publish failed` });
      }
    });

    await Promise.all(platformPushPromises);

    const anySuccess = platformResults.some((r) => r.success);
    const anyFailure = platformResults.some((r) => !r.success);

    if (anySuccess) {
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
        const successPlatforms = platformResults.filter((r) => r.success).map((r) => r.platform).join(', ');
        const failedPlatforms = platformResults.filter((r) => !r.success).map((r) => r.platform).join(', ');

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
          // Full failure
          await prisma.notification.createMany({
            data: userIds.map((userId: string) => ({
              userId,
              organizationId: org_id,
              type: 'campaign_failed',
              subject: `"${media_plan.campaignName}" failed to publish`,
              content: `Failed on ${failedPlatforms}. ${platformResults.find((r) => !r.success)?.error ?? 'Check your account connections and retry.'}`,
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
      success: anySuccess,
      campaign_id: campaign.id,
      platform_results: platformResults,
    });
  });
}
