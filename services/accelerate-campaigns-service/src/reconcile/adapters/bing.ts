/**
 * Microsoft (Bing) Ads platform adapter.
 * Helpers extracted from routes/publish.ts.
 */

import type { PlatformAdapter, AdapterCtx, MediaPlan } from './types';

// ---------------------------------------------------------------------------
// Bing Ads helpers
// ---------------------------------------------------------------------------

const BING_AUTH_BASE = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

export async function bingPost<T>(path: string, body: unknown, accessToken: string, developerToken: string, customerId: string, accountId: string): Promise<T> {
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

export const BING_OBJECTIVE_MAP: Record<string, string> = {
  SALES: 'Conversions', LEADS: 'Conversions', WEBSITE_TRAFFIC: 'Visits', BRAND_AWARENESS: 'BrandAwareness', TRAFFIC: 'Visits',
};

export async function createBingCampaign(accountId: string, customerId: string, accessToken: string, developerToken: string, mediaPlan: MediaPlan): Promise<string> {
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
// Bing adapter
// ---------------------------------------------------------------------------

export const bingAdapter: PlatformAdapter = {
  treeCreate: true,

  async create(node, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.BING_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Microsoft Ads developer token not configured');
    const customerId = ctx.account.customerId ?? ctx.account.accountId;
    const externalId = await createBingCampaign(
      ctx.account.accountId,
      customerId,
      ctx.account.accessToken,
      devToken,
      ctx.mediaPlan
    );
    return { externalId };
  },

  async update(node, externalId, changedFields, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.BING_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Microsoft Ads developer token not configured');
    const customerId = ctx.account.customerId ?? ctx.account.accountId;
    const accountId = ctx.account.accountId;

    if (changedFields.includes('status')) {
      const status = (node.desired as any).status;
      await bingPost(
        'Campaigns/UpdateCampaigns',
        { AccountId: Number(accountId), Campaigns: [{ Id: Number(externalId), Status: status }] },
        ctx.account.accessToken,
        devToken,
        customerId,
        accountId
      );
      return { applied: true };
    }
    if (changedFields.includes('budget')) {
      // Budget updates require fetching the existing campaign budget resource.
      // Log as unsupported for now — full implementation deferred to a later task.
      console.warn('[bingAdapter.update] budget update not yet supported; skipping', externalId);
    }
    // No recognized field was applied to the platform API.
    return { applied: false };
  },

  async delete(externalId, ctx) {
    const devToken = ctx.account.developerToken ?? process.env.BING_DEVELOPER_TOKEN;
    if (!devToken) throw new Error('Microsoft Ads developer token not configured');
    const customerId = ctx.account.customerId ?? ctx.account.accountId;
    const accountId = ctx.account.accountId;
    await bingPost(
      'Campaigns/DeleteCampaigns',
      { AccountId: Number(accountId), CampaignIds: [Number(externalId)] },
      ctx.account.accessToken,
      devToken,
      customerId,
      accountId
    );
  },
};
