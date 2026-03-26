/**
 * Microsoft Advertising (Bing Ads) API — campaign creation
 *
 * Uses the Microsoft Advertising REST API to create campaigns.
 * Requires: OAuth2 access token + developer token + customer ID + account ID.
 */

import type { MediaPlan, AdTypePlan } from '../campaign/transformers';

const BING_API_BASE = 'https://campaign.api.bingads.microsoft.com/api/advertiser/v13/bulk';
const BING_AUTH_BASE = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

export type BingCampaignResult = {
  campaignId: string;
  adGroupIds: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function bingPost<T>(
  path: string,
  body: unknown,
  accessToken: string,
  developerToken: string,
  customerId: string,
  accountId: string
): Promise<T> {
  const res = await fetch(`${BING_AUTH_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'DeveloperToken': developerToken,
      'CustomerId': customerId,
      'CustomerAccountId': accountId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    let errMsg = `Microsoft Ads API error: ${res.status}`;
    try {
      const json = await res.json() as { Message?: string };
      errMsg = json.Message ?? errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Bid strategy mapping
// ---------------------------------------------------------------------------

function mapBidStrategy(bidStrategy: string): Record<string, unknown> {
  const bs = bidStrategy.toUpperCase();
  switch (bs) {
    case 'TARGETCPA':
    case 'TARGET_CPA':
      return { Type: 'TargetCpa', TargetCpa: { TargetCostPerAcquisitionInMicros: 1000000 } };
    case 'TARGETROAS':
    case 'TARGET_ROAS':
      return { Type: 'TargetRoas', TargetRoas: { TargetRevenuePerSpendInPercentage: 300 } };
    case 'MAXIMIZECONVERSIONS':
    case 'MAXIMIZE_CONVERSIONS':
      return { Type: 'MaximizeConversions' };
    case 'MAXIMIZECLICKS':
    case 'MAXIMIZE_CLICKS':
      return { Type: 'MaximizeClicks' };
    default:
      return { Type: 'ManualCpc' };
  }
}

// ---------------------------------------------------------------------------
// Objective mapping
// ---------------------------------------------------------------------------

const BING_OBJECTIVE_MAP: Record<string, string> = {
  SALES: 'Conversions',
  LEADS: 'Conversions',
  WEBSITE_TRAFFIC: 'Visits',
  BRAND_AWARENESS: 'BrandAwareness',
  AWARENESS: 'BrandAwareness',
  TRAFFIC: 'Visits'
};

function mapObjective(objective: string): string {
  return BING_OBJECTIVE_MAP[objective.toUpperCase()] ?? 'Conversions';
}

// ---------------------------------------------------------------------------
// Ad type → campaign type mapping
// ---------------------------------------------------------------------------

function getCampaignType(adType: string): string {
  const at = adType.toLowerCase();
  if (at.includes('search')) return 'Search';
  if (at.includes('display') || at.includes('audience') || at.includes('bing_display')) return 'Audience';
  if (at === 'pmax' || at === 'performance_max') return 'PerformanceMax';
  return 'Search';
}

// ---------------------------------------------------------------------------
// Main campaign creation function
// ---------------------------------------------------------------------------

export async function createBingCampaign(
  accountId: string,
  customerId: string,
  accessToken: string,
  developerToken: string,
  mediaPlan: MediaPlan
): Promise<BingCampaignResult> {
  const bingPlatform = mediaPlan.platforms.find((p) => p.platform === 'bing');
  if (!bingPlatform) throw new Error('No Bing platform in media plan');

  const primaryAdType = bingPlatform.adTypes[0];
  if (!primaryAdType) throw new Error('No ad types for Bing platform');

  const campaignType = getCampaignType(primaryAdType.adType);
  const bidStrategy = mapBidStrategy(primaryAdType.bidStrategy ?? 'MAXIMIZE_CONVERSIONS');
  const objective = mapObjective(mediaPlan.objective);

  const dailyBudget = Math.max(
    (bingPlatform.budget / (mediaPlan.duration || 30)),
    1
  );

  // Create campaign
  const campaignRes = await bingPost<{ CampaignIds: string[] }>(
    'Campaigns/AddCampaigns',
    {
      AccountId: parseInt(accountId, 10),
      Campaigns: [
        {
          Name: mediaPlan.campaignName,
          Status: 'Paused',
          BudgetType: 'DailyBudgetStandard',
          DailyBudget: dailyBudget,
          TimeZone: 'PacificTimeUSCanadaTijuana',
          CampaignType: campaignType,
          BiddingScheme: bidStrategy,
          CampaignObjective: objective
        }
      ]
    },
    accessToken,
    developerToken,
    customerId,
    accountId
  );

  const campaignId = campaignRes.CampaignIds[0] ?? '';
  const adGroupIds: string[] = [];

  // Create ad groups
  for (const adType of bingPlatform.adTypes) {
    try {
      const adGroupRes = await bingPost<{ AdGroupIds: string[] }>(
        'AdGroups/AddAdGroups',
        {
          CampaignId: parseInt(campaignId, 10),
          AdGroups: [
            {
              Name: `${adType.adType} - ${mediaPlan.campaignName}`,
              Status: 'Paused',
              CpcBid: { Amount: 1.0 }
            }
          ]
        },
        accessToken,
        developerToken,
        customerId,
        accountId
      );
      if (adGroupRes.AdGroupIds[0]) adGroupIds.push(adGroupRes.AdGroupIds[0]);
    } catch {
      // Non-fatal
    }
  }

  return { campaignId, adGroupIds };
}
