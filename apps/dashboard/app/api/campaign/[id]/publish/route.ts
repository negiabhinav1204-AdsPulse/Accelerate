/**
 * POST /api/campaign/[id]/publish
 *
 * Publishes a campaign by:
 * 1. Reading the stored media plan from the DB
 * 2. Getting the org's connected ad accounts
 * 3. Pushing the campaign to each connected platform (Meta, Google, Bing)
 * 4. Storing results in PlatformCampaign records
 * 5. Updating campaign status to PAUSED (ready — user activates from platform dashboard)
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { createMetaCampaign } from '~/lib/platforms/meta-campaign-api';
import { createGoogleCampaign } from '~/lib/platforms/google-ads-api';
import { createBingCampaign } from '~/lib/platforms/bing-ads-api';
import type { MediaPlan } from '~/lib/campaign/transformers';

type RouteParams = { params: Promise<{ id: string }> };

type PlatformPublishResult = {
  platform: string;
  success: boolean;
  platformCampaignId?: string;
  error?: string;
};

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership and fetch campaign
  const campaign = await prisma.campaign.findFirst({
    where: {
      id,
      organization: {
        memberships: { some: { userId } }
      }
    },
    select: {
      id: true,
      status: true,
      name: true,
      organizationId: true,
      mediaPlan: true
    }
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Only DRAFT and REVIEWING campaigns can be published
  if (!['DRAFT', 'REVIEWING'].includes(campaign.status as string)) {
    return NextResponse.json(
      { error: `Cannot publish a campaign with status ${campaign.status}` },
      { status: 422 }
    );
  }

  const mediaPlan = campaign.mediaPlan as MediaPlan | null;
  if (!mediaPlan || !mediaPlan.platforms || mediaPlan.platforms.length === 0) {
    return NextResponse.json({ error: 'No media plan found for this campaign' }, { status: 422 });
  }

  // Get connected ad accounts for this org
  const connectedAccounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: campaign.organizationId, status: 'connected', archivedAt: null },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      isDefault: true,
      accessToken: true,
      accountMetadata: true
    }
  });

  const platformResults: PlatformPublishResult[] = [];

  // Push to each platform in the media plan in parallel
  const platformPushPromises = mediaPlan.platforms.map(async (platformPlan) => {
    const platform = platformPlan.platform;
    const account = connectedAccounts.find(
      (a) => a.platform === platform && a.isDefault
    ) ?? connectedAccounts.find((a) => a.platform === platform);

    if (!account?.accessToken) {
      platformResults.push({
        platform,
        success: false,
        error: `No connected ${platform} account with access token`
      });
      return;
    }

    try {
      let platformCampaignId: string | undefined;

      if (platform === 'meta') {
        const result = await createMetaCampaign(
          account.accountId,
          account.accessToken,
          mediaPlan
        );
        platformCampaignId = result.campaignId;
      } else if (platform === 'google') {
        const devToken = process.env.GOOGLE_DEVELOPER_TOKEN;
        if (!devToken) {
          platformResults.push({
            platform,
            success: false,
            error: 'Google Ads developer token not configured (GOOGLE_DEVELOPER_TOKEN env var missing)'
          });
          return;
        }
        const result = await createGoogleCampaign(
          account.accountId,
          account.accessToken,
          devToken,
          mediaPlan
        );
        platformCampaignId = result.campaignResourceName;
      } else if (platform === 'bing') {
        const devToken = process.env.BING_DEVELOPER_TOKEN;
        if (!devToken) {
          platformResults.push({
            platform,
            success: false,
            error: 'Microsoft Ads developer token not configured (BING_DEVELOPER_TOKEN env var missing)'
          });
          return;
        }
        // customerId may be stored in accountMetadata
        const meta = account.accountMetadata as Record<string, unknown> | null;
        const customerId = (meta?.customerId as string) ?? account.accountId;
        const result = await createBingCampaign(
          account.accountId,
          customerId,
          account.accessToken,
          devToken,
          mediaPlan
        );
        platformCampaignId = result.campaignId;
      }

      // Save PlatformCampaign record
      if (platformCampaignId !== undefined) {
        const existing = await prisma.platformCampaign.findFirst({
          where: { campaignId: campaign.id, platform }
        });
        if (existing) {
          await prisma.platformCampaign.update({
            where: { id: existing.id },
            data: { platformCampaignId, status: 'paused', adTypes: platformPlan.adTypes.map((at) => at.adType) }
          });
        } else {
          await prisma.platformCampaign.create({
            data: {
              campaignId: campaign.id,
              platform,
              platformCampaignId,
              adTypes: platformPlan.adTypes.map((at) => at.adType),
              budget: platformPlan.budget,
              currency: mediaPlan.currency,
              status: 'paused'
            }
          });
        }
      }

      platformResults.push({ platform, success: true, platformCampaignId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `${platform} publish failed`;
      platformResults.push({ platform, success: false, error: errorMessage });
    }
  });

  await Promise.all(platformPushPromises);

  // Determine final status — if at least one platform succeeded, mark as PAUSED
  const anySuccess = platformResults.some((r) => r.success);
  const newStatus = anySuccess ? 'PAUSED' : 'DRAFT';

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: newStatus },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    campaign: updated,
    platforms: platformResults,
    message: anySuccess
      ? 'Campaign published (paused on platforms). Activate from your platform dashboard when ready.'
      : 'Campaign saved but platform push failed. Check your connected accounts.',
    success: anySuccess
  });
}
