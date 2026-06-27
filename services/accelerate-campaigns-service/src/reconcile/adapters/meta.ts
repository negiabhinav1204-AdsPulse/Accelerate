/**
 * Meta Ads platform adapter.
 * Helpers extracted from routes/publish.ts.
 */

import type { PlatformAdapter, AdapterCtx, MediaPlan } from './types';

// ---------------------------------------------------------------------------
// Meta Ads helpers
// ---------------------------------------------------------------------------

const META_API_BASE = 'https://graph.facebook.com/v23.0';

export async function metaPost<T>(endpoint: string, params: Record<string, unknown>, token: string): Promise<T> {
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

export const OBJECTIVE_MAP: Record<string, string> = {
  SALES: 'OUTCOME_SALES',
  LEADS: 'OUTCOME_LEADS',
  WEBSITE_TRAFFIC: 'OUTCOME_TRAFFIC',
  BRAND_AWARENESS: 'OUTCOME_AWARENESS',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
};

export function metaObjective(o: string): string {
  return OBJECTIVE_MAP[o.toUpperCase()] ?? 'OUTCOME_SALES';
}

export function metaOptimizationGoal(adType: string, objective: string): string {
  if (adType.toLowerCase().includes('lead')) return 'LEAD_GENERATION';
  if (objective.includes('LEADS')) return 'LEAD_GENERATION';
  if (objective.includes('AWARENESS')) return 'REACH';
  if (objective.includes('TRAFFIC')) return 'LINK_CLICKS';
  return 'CONVERSIONS';
}

export function metaBillingEvent(goal: string): string {
  if (goal === 'REACH') return 'IMPRESSIONS';
  if (goal === 'LINK_CLICKS') return 'LINK_CLICKS';
  return 'IMPRESSIONS';
}

export function metaGeoSpec(locs: unknown[]): Record<string, unknown> {
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

export function parseAgeRange(range: string): { age_min: number; age_max: number } {
  const m = /(\d+)[^\d]+(\d+)?/.exec(range);
  if (m) {
    return { age_min: Math.max(13, parseInt(m[1] ?? '18')), age_max: Math.min(65, m[2] ? parseInt(m[2]) : 65) };
  }
  return { age_min: 18, age_max: 65 };
}

export async function createMetaCampaign(
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
// Meta adapter
// ---------------------------------------------------------------------------

export const metaAdapter: PlatformAdapter = {
  treeCreate: true,

  async create(node, ctx) {
    const externalId = await createMetaCampaign(
      ctx.account.accountId,
      ctx.account.accessToken,
      ctx.mediaPlan,
      ctx.account.facebookPageId
    );
    return { externalId };
  },

  async update(node, externalId, changedFields, ctx) {
    let applied = false;
    if (changedFields.includes('status')) {
      await metaPost(externalId, { status: (node.desired as any).status }, ctx.account.accessToken);
      applied = true;
    }
    if (changedFields.includes('budget')) {
      await metaPost(
        externalId,
        { daily_budget: Math.round(Number((node.desired as any).budget) * 100) },
        ctx.account.accessToken
      );
      applied = true;
    }
    return { applied };
  },

  async delete(externalId, ctx) {
    await metaPost(externalId, { status: 'DELETED' }, ctx.account.accessToken);
  },
};
