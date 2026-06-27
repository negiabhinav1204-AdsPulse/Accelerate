/**
 * Google Ads platform adapter.
 * Helpers extracted from routes/publish.ts.
 */

import type { PlatformAdapter, AdapterCtx, MediaPlan } from './types';

// ---------------------------------------------------------------------------
// Google Ads helpers
// ---------------------------------------------------------------------------

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';

export async function googlePost<T>(path: string, body: unknown, accessToken: string, developerToken: string): Promise<T> {
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

export const GOOGLE_CHANNEL_MAP: Record<string, string> = {
  search: 'SEARCH', display: 'DISPLAY', pmax: 'PERFORMANCE_MAX', performance_max: 'PERFORMANCE_MAX', shopping: 'SHOPPING', demand_gen: 'DEMAND_GEN',
};

// Reserved for future use (3-way reconciliation)
export const COUNTRY_CRITERION_IDS: Record<string, number> = {};

export async function createGoogleCampaign(customerId: string, accessToken: string, developerToken: string, mediaPlan: MediaPlan): Promise<string> {
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
// Google adapter
// ---------------------------------------------------------------------------

export const googleAdapter: PlatformAdapter = {
  treeCreate: true,

  async create(node, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Google Ads developer token not configured');
    const externalId = await createGoogleCampaign(
      ctx.account.customerId ?? ctx.account.accountId,
      ctx.account.accessToken,
      devToken,
      ctx.mediaPlan
    );
    return { externalId };
  },

  async update(node, externalId, changedFields, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Google Ads developer token not configured');
    const cleanCustomerId = (ctx.account.customerId ?? ctx.account.accountId).replace(/-/g, '');

    if (changedFields.includes('status')) {
      const status = (node.desired as any).status;
      await googlePost(
        `customers/${cleanCustomerId}/campaigns:mutate`,
        { operations: [{ update: { resourceName: externalId, status }, updateMask: 'status' }] },
        ctx.account.accessToken,
        devToken
      );
    }
    if (changedFields.includes('budget')) {
      // Budget updates via campaignBudgets:mutate require knowing the budget resource name.
      // Log as unsupported for now — full implementation deferred to a later task.
      console.warn('[googleAdapter.update] budget update not yet supported; skipping', externalId);
    }
  },

  async delete(externalId, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Google Ads developer token not configured');
    const cleanCustomerId = (ctx.account.customerId ?? ctx.account.accountId).replace(/-/g, '');
    await googlePost(
      `customers/${cleanCustomerId}/campaigns:mutate`,
      { operations: [{ update: { resourceName: externalId, status: 'REMOVED' }, updateMask: 'status' }] },
      ctx.account.accessToken,
      devToken
    );
  },
};
