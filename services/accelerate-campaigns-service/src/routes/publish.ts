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
import { PrismaClient } from '@prisma/client';
import { verifyInternalKey } from '../auth';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types (mirror of dashboard's MediaPlan / AdTypePlan)
// ---------------------------------------------------------------------------

type AdCreative = {
  headlines: string[];
  descriptions: string[];
  imageUrls: string[];
  ctaText: string;
  destinationUrl: string;
};

type AdTypePlan = {
  adType: string;
  budget: number;
  bidStrategy: string;
  targeting: {
    locations: unknown[];
    ageRange: string;
    gender: string;
    languages: string[];
  };
  ads: AdCreative[];
};

type PlatformPlan = {
  platform: 'google' | 'meta' | 'bing';
  budget: number;
  adTypes: AdTypePlan[];
};

type MediaPlan = {
  campaignName: string;
  objective: string;
  totalBudget: number;
  currency: string;
  dailyBudget: number;
  duration: number;
  startDate: string;
  endDate: string;
  platforms: PlatformPlan[];
};

type ConnectedAccount = {
  platform: string;
  accountId: string;
  accessToken: string;
  customerId?: string; // Bing / Google MCC
  developerToken?: string; // Google / Bing
  facebookPageId?: string; // Meta page ID
};

type PlatformPublishResult = {
  platform: string;
  success: boolean;
  platformCampaignId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Meta Ads helpers
// ---------------------------------------------------------------------------

const META_API_BASE = 'https://graph.facebook.com/v23.0';

async function metaPost<T>(endpoint: string, params: Record<string, unknown>, token: string): Promise<T> {
  const body = new URLSearchParams({ access_token: token });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      body.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }
  const res = await fetch(`${META_API_BASE}/${endpoint}`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(30000),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta API error: ${res.status}`);
  }
  return json;
}

const OBJECTIVE_MAP: Record<string, string> = {
  SALES: 'OUTCOME_SALES',
  LEADS: 'OUTCOME_LEADS',
  WEBSITE_TRAFFIC: 'OUTCOME_TRAFFIC',
  BRAND_AWARENESS: 'OUTCOME_AWARENESS',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
};

function metaObjective(o: string): string {
  return OBJECTIVE_MAP[o.toUpperCase()] ?? 'OUTCOME_SALES';
}

function metaOptimizationGoal(adType: string, objective: string): string {
  if (adType.toLowerCase().includes('lead')) return 'LEAD_GENERATION';
  if (objective.includes('LEADS')) return 'LEAD_GENERATION';
  if (objective.includes('AWARENESS')) return 'REACH';
  if (objective.includes('TRAFFIC')) return 'LINK_CLICKS';
  return 'CONVERSIONS';
}

function metaBillingEvent(goal: string): string {
  if (goal === 'REACH') return 'IMPRESSIONS';
  if (goal === 'LINK_CLICKS') return 'LINK_CLICKS';
  return 'IMPRESSIONS';
}

function metaGeoSpec(locs: unknown[]): Record<string, unknown> {
  const countries: string[] = [];
  for (const loc of locs) {
    if (typeof loc === 'string') countries.push(loc.toUpperCase().slice(0, 2));
    else if (loc && typeof loc === 'object') {
      const l = loc as { country?: string; raw?: string };
      const c = l.country || l.raw?.slice(0, 2) || '';
      if (c) countries.push(c.toUpperCase());
    }
  }
  if (countries.length === 0) countries.push('US');
  return { countries: [...new Set(countries)] };
}

function parseAgeRange(range: string): { age_min: number; age_max: number } {
  const m = /(\d+)[^\d]+(\d+)?/.exec(range);
  if (m) {
    return { age_min: Math.max(13, parseInt(m[1] ?? '18')), age_max: Math.min(65, m[2] ? parseInt(m[2]) : 65) };
  }
  return { age_min: 18, age_max: 65 };
}

async function createMetaCampaign(
  adAccountId: string,
  accessToken: string,
  mediaPlan: MediaPlan,
  facebookPageId?: string
): Promise<string> {
  const platform = mediaPlan.platforms.find((p) => p.platform === 'meta');
  if (!platform) throw new Error('No Meta platform in media plan');

  const objective = metaObjective(mediaPlan.objective);

  const campaignRes = await metaPost<{ id: string }>(
    `act_${adAccountId}/campaigns`,
    {
      name: mediaPlan.campaignName,
      objective,
      status: 'PAUSED',
      special_ad_categories: JSON.stringify([]),
      daily_budget: Math.round((mediaPlan.dailyBudget || mediaPlan.totalBudget / (mediaPlan.duration || 30)) * 100),
    },
    accessToken
  );

  const metaCampaignId = campaignRes.id;

  for (const adType of platform.adTypes) {
    const optimizationGoal = metaOptimizationGoal(adType.adType, objective);
    const billingEvent = metaBillingEvent(optimizationGoal);
    const geoSpec = metaGeoSpec(adType.targeting.locations);
    const { age_min, age_max } = parseAgeRange(adType.targeting.ageRange);
    const genderMap: Record<string, number[]> = { Male: [1], Female: [2], All: [], GENDER_MALE: [1], GENDER_FEMALE: [2] };
    const genders = genderMap[adType.targeting.gender] ?? [];

    const adSetBudget = Math.max(
      Math.round(((adType.budget || platform.budget / Math.max(platform.adTypes.length, 1)) / (mediaPlan.duration || 30)) * 100),
      100
    );

    const adSetRes = await metaPost<{ id: string }>(
      `act_${adAccountId}/adsets`,
      {
        name: `${adType.adType} - ${mediaPlan.campaignName}`,
        campaign_id: metaCampaignId,
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        daily_budget: adSetBudget,
        targeting: JSON.stringify({
          geo_locations: geoSpec,
          age_min,
          age_max,
          ...(genders.length > 0 ? { genders } : {}),
          publisher_platforms: ['facebook', 'instagram', 'audience_network'],
          facebook_positions: ['feed'],
          instagram_positions: ['stream'],
        }),
        status: 'PAUSED',
        start_time: Math.floor(new Date(mediaPlan.startDate).getTime() / 1000),
        ...(mediaPlan.endDate ? { end_time: Math.floor(new Date(mediaPlan.endDate).getTime() / 1000) } : {}),
      },
      accessToken
    );

    if (facebookPageId) {
      for (const ad of adType.ads.slice(0, 3)) {
        try {
          const headline = ad.headlines[0] ?? mediaPlan.campaignName;
          const body = ad.descriptions[0] ?? headline;
          const imageUrl = ad.imageUrls[0];
          const linkData: Record<string, unknown> = {
            link: ad.destinationUrl || 'https://example.com',
            message: body,
            name: headline,
            call_to_action: { type: 'LEARN_MORE', value: { link: ad.destinationUrl || 'https://example.com' } },
          };
          if (imageUrl?.startsWith('https://')) linkData.picture = imageUrl;

          const creativeRes = await metaPost<{ id: string }>(
            `act_${adAccountId}/adcreatives`,
            { name: `Creative - ${headline.slice(0, 40)}`, object_story_spec: JSON.stringify({ page_id: facebookPageId, link_data: linkData }) },
            accessToken
          );
          await metaPost<{ id: string }>(
            `act_${adAccountId}/ads`,
            { name: `Ad - ${adType.adType} - ${headline.slice(0, 30)}`, adset_id: adSetRes.id, creative: JSON.stringify({ creative_id: creativeRes.id }), status: 'PAUSED' },
            accessToken
          );
        } catch { /* non-fatal */ }
      }
    }
  }

  return metaCampaignId;
}

// ---------------------------------------------------------------------------
// Google Ads helpers
// ---------------------------------------------------------------------------

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';

async function googlePost<T>(path: string, body: unknown, accessToken: string, developerToken: string): Promise<T> {
  const res = await fetch(`${GOOGLE_ADS_API_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': developerToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    let msg = `Google Ads API error: ${res.status}`;
    try { const j = await res.json() as { error?: { message?: string } }; msg = j.error?.message ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const GOOGLE_CHANNEL_MAP: Record<string, string> = {
  search: 'SEARCH', display: 'DISPLAY', pmax: 'PERFORMANCE_MAX', performance_max: 'PERFORMANCE_MAX', shopping: 'SHOPPING', demand_gen: 'DEMAND_GEN',
};
const COUNTRY_CRITERION_IDS: Record<string, string> = {
  US: '2840', IN: '2356', GB: '2826', AU: '2036', CA: '2124', DE: '2276', FR: '2250', JP: '2392', SG: '2702', AE: '2784',
};

async function createGoogleCampaign(customerId: string, accessToken: string, developerToken: string, mediaPlan: MediaPlan): Promise<string> {
  const platform = mediaPlan.platforms.find((p) => p.platform === 'google');
  if (!platform) throw new Error('No Google platform in media plan');

  const cleanCustomerId = customerId.replace(/-/g, '');

  const budgetOps = platform.adTypes.map((adType, idx) => {
    const dailyMicros = Math.round(((adType.budget || platform.budget / Math.max(platform.adTypes.length, 1)) / (mediaPlan.duration || 30)) * 1_000_000);
    return {
      create: {
        resourceName: `customers/${cleanCustomerId}/campaignBudgets/-${idx + 1}`,
        name: `Budget for ${adType.adType}`,
        amountMicros: String(Math.max(dailyMicros, 1_000_000)),
        deliveryMethod: 'STANDARD',
      },
    };
  });

  await googlePost(`customers/${cleanCustomerId}/campaignBudgets:mutate`, { operations: budgetOps }, accessToken, developerToken);

  const campaignOps = platform.adTypes.map((adType, idx) => {
    const channelType = GOOGLE_CHANNEL_MAP[adType.adType.toLowerCase()] ?? 'SEARCH';
    return {
      create: {
        resourceName: `customers/${cleanCustomerId}/campaigns/-${idx + 1}`,
        name: `${mediaPlan.campaignName} - ${adType.adType}`,
        status: 'PAUSED',
        advertisingChannelType: channelType,
        campaignBudget: `customers/${cleanCustomerId}/campaignBudgets/-${idx + 1}`,
        startDate: (mediaPlan.startDate ?? new Date().toISOString().split('T')[0]!).replace(/-/g, ''),
        ...(mediaPlan.endDate ? { endDate: mediaPlan.endDate.replace(/-/g, '') } : {}),
        maximizeConversions: {},
      },
    };
  });

  const campaignResult = await googlePost<{ results: { resourceName: string }[] }>(
    `customers/${cleanCustomerId}/campaigns:mutate`,
    { operations: campaignOps },
    accessToken,
    developerToken
  );

  return campaignResult.results[0]?.resourceName ?? '';
}

// ---------------------------------------------------------------------------
// Bing Ads helpers
// ---------------------------------------------------------------------------

const BING_AUTH_BASE = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

async function bingPost<T>(path: string, body: unknown, accessToken: string, developerToken: string, customerId: string, accountId: string): Promise<T> {
  const res = await fetch(`${BING_AUTH_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, DeveloperToken: developerToken, CustomerId: customerId, CustomerAccountId: accountId, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    let msg = `Microsoft Ads API error: ${res.status}`;
    try { const j = await res.json() as { Message?: string }; msg = j.Message ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const BING_OBJECTIVE_MAP: Record<string, string> = {
  SALES: 'Conversions', LEADS: 'Conversions', WEBSITE_TRAFFIC: 'Visits', BRAND_AWARENESS: 'BrandAwareness', TRAFFIC: 'Visits',
};

async function createBingCampaign(accountId: string, customerId: string, accessToken: string, developerToken: string, mediaPlan: MediaPlan): Promise<string> {
  const platform = mediaPlan.platforms.find((p) => p.platform === 'bing');
  if (!platform) throw new Error('No Bing platform in media plan');

  const primaryAdType = platform.adTypes[0];
  if (!primaryAdType) throw new Error('No ad types for Bing');

  const at = primaryAdType.adType.toLowerCase();
  const campaignType = at.includes('display') || at.includes('audience') ? 'Audience' : at === 'pmax' ? 'PerformanceMax' : 'Search';
  const dailyBudget = Math.max(platform.budget / (mediaPlan.duration || 30), 1);
  const objective = BING_OBJECTIVE_MAP[mediaPlan.objective.toUpperCase()] ?? 'Conversions';

  const campaignRes = await bingPost<{ CampaignIds: string[] }>(
    'Campaigns/AddCampaigns',
    {
      AccountId: parseInt(accountId, 10),
      Campaigns: [{ Name: mediaPlan.campaignName, Status: 'Paused', BudgetType: 'DailyBudgetStandard', DailyBudget: dailyBudget, TimeZone: 'PacificTimeUSCanadaTijuana', CampaignType: campaignType, CampaignObjective: objective }],
    },
    accessToken, developerToken, customerId, accountId
  );

  return campaignRes.CampaignIds[0] ?? '';
}

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

    if (!org_id || !media_plan || !connected_accounts) {
      return reply.status(400).send({ error: 'org_id, media_plan, and connected_accounts are required' });
    }

    // Create Campaign record in DB
    const campaign = await prisma.campaign.create({
      data: {
        orgId: org_id,
        name: media_plan.campaignName,
        status: 'DRAFT',
        objective: media_plan.objective,
        dailyBudget: media_plan.dailyBudget || null,
        totalBudget: media_plan.totalBudget || null,
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
    if (anySuccess) {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
    }

    return reply.send({
      success: anySuccess,
      campaign_id: campaign.id,
      platform_results: platformResults,
    });
  });
}
