/**
 * Google Ads API (REST) — campaign creation
 *
 * Uses the Google Ads REST API v18 to create campaigns.
 * Requires: OAuth2 access token + developer token + customer ID.
 */

import type { MediaPlan, AdTypePlan } from '../campaign/transformers';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';

export type GoogleCampaignResult = {
  campaignResourceName: string;
  adGroupResourceNames: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function googleAdsPost<T>(
  path: string,
  body: unknown,
  accessToken: string,
  developerToken: string,
  loginCustomerId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json'
  };

  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const res = await fetch(`${GOOGLE_ADS_API_BASE}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    let errMsg = `Google Ads API error: ${res.status}`;
    try {
      const json = await res.json() as { error?: { message?: string; details?: unknown[] } };
      errMsg = json.error?.message ?? errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Bid strategy mapping
// ---------------------------------------------------------------------------

function buildBiddingStrategy(bidStrategy: string, adType: string): Record<string, unknown> {
  const at = adType.toLowerCase();
  const bs = bidStrategy.toUpperCase();

  // PMax only supports maximize strategies
  if (at === 'pmax' || at === 'performance_max') {
    return {
      maximizeConversions: {}
    };
  }

  switch (bs) {
    case 'TARGET_CPA':
      return { targetCpa: { targetCpaMicros: '1000000' } }; // $1 default target
    case 'TARGET_ROAS':
      return { targetRoas: { targetRoas: 3.0 } }; // 300% default
    case 'MAXIMIZE_CONVERSIONS':
      return { maximizeConversions: {} };
    case 'MAXIMIZE_CLICKS':
      return { maximizeClicks: {} };
    case 'MANUAL_CPC':
      return { manualCpc: { enhancedCpcEnabled: false } };
    default:
      return { maximizeConversions: {} };
  }
}

// ---------------------------------------------------------------------------
// Ad type → campaign type mapping
// ---------------------------------------------------------------------------

function getCampaignType(adType: string): { advertisingChannelType: string; advertisingChannelSubType?: string } {
  const at = adType.toLowerCase();
  if (at === 'search') return { advertisingChannelType: 'SEARCH' };
  if (at === 'display') return { advertisingChannelType: 'DISPLAY' };
  if (at === 'pmax' || at === 'performance_max') return { advertisingChannelType: 'PERFORMANCE_MAX' };
  if (at === 'shopping') return { advertisingChannelType: 'SHOPPING' };
  if (at === 'demand_gen') return { advertisingChannelType: 'DEMAND_GEN' };
  return { advertisingChannelType: 'SEARCH' };
}

// ---------------------------------------------------------------------------
// Location targeting
// ---------------------------------------------------------------------------

// Common country location IDs for Google Ads
const COUNTRY_CRITERION_IDS: Record<string, string> = {
  US: '2840', IN: '2356', GB: '2826', AU: '2036', CA: '2124',
  DE: '2276', FR: '2250', JP: '2392', SG: '2702', AE: '2784',
  BR: '2076', MX: '2484', NL: '2528', NZ: '2554'
};

function getLocationCriteria(targeting: AdTypePlan['targeting']): string[] {
  const locs = targeting.locations as unknown[];
  const criteriaIds: string[] = [];

  for (const loc of locs) {
    let country = '';
    if (typeof loc === 'string') {
      country = loc.toUpperCase().slice(0, 2);
    } else if (loc && typeof loc === 'object') {
      const l = loc as { country?: string; raw?: string };
      country = (l.country || l.raw?.slice(0, 2) || '').toUpperCase();
    }
    const criterionId = COUNTRY_CRITERION_IDS[country];
    if (criterionId) criteriaIds.push(criterionId);
  }

  // Default to US if no valid locations found
  if (criteriaIds.length === 0) criteriaIds.push('2840');

  return [...new Set(criteriaIds)];
}

// ---------------------------------------------------------------------------
// Main campaign creation function
// ---------------------------------------------------------------------------

export async function createGoogleCampaign(
  customerId: string,
  accessToken: string,
  developerToken: string,
  mediaPlan: MediaPlan
): Promise<GoogleCampaignResult> {
  const googlePlatform = mediaPlan.platforms.find((p) => p.platform === 'google');
  if (!googlePlatform) throw new Error('No Google platform in media plan');

  const cleanCustomerId = customerId.replace(/-/g, '');
  const adGroupResourceNames: string[] = [];

  // Google Ads uses mutate operations — create multiple resources in one call
  // Create one campaign per ad type for clean separation
  const campaignOperations = googlePlatform.adTypes.map((adType, idx) => {
    const channelType = getCampaignType(adType.adType);
    const biddingStrategy = buildBiddingStrategy(adType.bidStrategy ?? 'MAXIMIZE_CONVERSIONS', adType.adType);
    const dailyBudgetMicros = Math.round(
      (adType.budget || googlePlatform.budget / Math.max(googlePlatform.adTypes.length, 1)) /
      (mediaPlan.duration || 30) * 1_000_000
    );

    return {
      create: {
        resourceName: `customers/${cleanCustomerId}/campaigns/-${idx + 1}`,
        name: `${mediaPlan.campaignName} - ${adType.adType}`,
        status: 'PAUSED',
        ...channelType,
        campaignBudget: `customers/${cleanCustomerId}/campaignBudgets/-${idx + 1}`,
        startDate: (mediaPlan.startDate ?? new Date().toISOString().split('T')[0]!).replace(/-/g, ''),
        ...(mediaPlan.endDate ? { endDate: mediaPlan.endDate.replace(/-/g, '') } : {}),
        ...biddingStrategy
      }
    };
  });

  const budgetOperations = googlePlatform.adTypes.map((adType, idx) => {
    const dailyBudgetMicros = Math.round(
      (adType.budget || googlePlatform.budget / Math.max(googlePlatform.adTypes.length, 1)) /
      (mediaPlan.duration || 30) * 1_000_000
    );
    return {
      create: {
        resourceName: `customers/${cleanCustomerId}/campaignBudgets/-${idx + 1}`,
        name: `Budget for ${adType.adType}`,
        amountMicros: String(Math.max(dailyBudgetMicros, 1_000_000)), // min $1/day
        deliveryMethod: 'STANDARD'
      }
    };
  });

  // Create budgets first
  await googleAdsPost(
    `customers/${cleanCustomerId}/campaignBudgets:mutate`,
    { operations: budgetOperations },
    accessToken,
    developerToken
  );

  // Create campaigns
  const campaignResult = await googleAdsPost<{ results: { resourceName: string }[] }>(
    `customers/${cleanCustomerId}/campaigns:mutate`,
    { operations: campaignOperations },
    accessToken,
    developerToken
  );

  const campaignResourceName = campaignResult.results[0]?.resourceName ?? '';

  // Create ad groups for search/display campaigns
  const adGroupOperations: unknown[] = [];
  for (let idx = 0; idx < googlePlatform.adTypes.length; idx++) {
    const adType = googlePlatform.adTypes[idx]!;
    const campaignResourceNameForAdType = campaignResult.results[idx]?.resourceName;
    if (!campaignResourceNameForAdType) continue;

    // Skip PMax — uses asset groups, not ad groups
    const at = adType.adType.toLowerCase();
    if (at === 'pmax' || at === 'performance_max') continue;

    adGroupOperations.push({
      create: {
        resourceName: `customers/${cleanCustomerId}/adGroups/-${idx + 1}`,
        name: `Ad Group - ${adType.adType}`,
        campaign: campaignResourceNameForAdType,
        status: 'ENABLED',
        type: at === 'search' ? 'SEARCH_STANDARD' : 'DISPLAY_STANDARD'
      }
    });
  }

  if (adGroupOperations.length > 0) {
    const adGroupResult = await googleAdsPost<{ results: { resourceName: string }[] }>(
      `customers/${cleanCustomerId}/adGroups:mutate`,
      { operations: adGroupOperations },
      accessToken,
      developerToken
    );
    adGroupResourceNames.push(...(adGroupResult.results.map((r) => r.resourceName)));
  }

  return { campaignResourceName, adGroupResourceNames };
}
