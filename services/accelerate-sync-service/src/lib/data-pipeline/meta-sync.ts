/**
 * Meta Ads Tier 1 data sync
 *
 * Object tables (4):  campaigns, adsets, ads, adcreatives
 * Insight tables (5): campaign_insights_daily, adset_insights_daily,
 *                     ad_insights_daily, insights_by_age_gender,
 *                     insights_by_platform_placement
 *
 * Key fields: impressions, reach, frequency, spend, clicks, cpc, ctr, cpm,
 *             actions, action_values, purchase_roas,
 *             video_p25/50/75/100_watched_actions,
 *             quality_ranking, engagement_rate_ranking, conversion_rate_ranking
 */

import type { SyncResult } from './types';

const META_API_VERSION = 'v23.0';

function getDatePreset(): string {
  return 'last_30d';
}

const INSIGHT_FIELDS = [
  'impressions', 'reach', 'frequency', 'spend', 'clicks', 'cpc', 'ctr', 'cpm',
  'actions', 'action_values', 'purchase_roas',
  'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
  'date_start', 'date_stop'
].join(',');

type MetaReport = {
  reportType: string;
  endpoint: string;
  params: Record<string, string>;
};

function buildReports(adAccountId: string): MetaReport[] {
  const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  return [
    // Object tables
    {
      reportType: 'campaigns',
      endpoint: `/${actId}/campaigns`,
      params: {
        fields: 'id,name,status,objective,budget_remaining,daily_budget,lifetime_budget,start_time,stop_time,created_time',
        limit: '500'
      }
    },
    {
      reportType: 'adsets',
      endpoint: `/${actId}/adsets`,
      params: {
        fields: 'id,name,status,campaign_id,targeting,optimization_goal,billing_event,bid_amount,daily_budget,start_time,end_time,placements',
        limit: '500'
      }
    },
    {
      reportType: 'ads',
      endpoint: `/${actId}/ads`,
      params: {
        fields: 'id,name,status,adset_id,campaign_id,creative{id,name},created_time',
        limit: '500'
      }
    },
    {
      reportType: 'adcreatives',
      endpoint: `/${actId}/adcreatives`,
      params: {
        fields: 'id,name,title,body,call_to_action_type,image_url,video_id,thumbnail_url,object_url',
        limit: '500'
      }
    },
    // Insight tables
    {
      reportType: 'campaign_insights_daily',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'campaign',
        time_increment: '1',
        date_preset: getDatePreset(),
        fields: INSIGHT_FIELDS,
        limit: '500'
      }
    },
    {
      reportType: 'adset_insights_daily',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'adset',
        time_increment: '1',
        date_preset: getDatePreset(),
        fields: INSIGHT_FIELDS,
        limit: '500'
      }
    },
    {
      reportType: 'ad_insights_daily',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'ad',
        time_increment: '1',
        date_preset: getDatePreset(),
        fields: INSIGHT_FIELDS,
        limit: '500'
      }
    },
    {
      reportType: 'insights_by_age_gender',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'campaign',
        date_preset: getDatePreset(),
        breakdowns: 'age,gender',
        fields: 'impressions,reach,spend,clicks,ctr,cpc,actions,action_values,purchase_roas,date_start,date_stop',
        limit: '500'
      }
    },
    {
      reportType: 'insights_by_platform_placement',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'campaign',
        date_preset: getDatePreset(),
        breakdowns: 'publisher_platform,platform_position',
        fields: 'impressions,reach,spend,clicks,ctr,cpc,actions,action_values,purchase_roas,date_start,date_stop',
        limit: '500'
      }
    },
    {
      reportType: 'insights_by_country',
      endpoint: `/${actId}/insights`,
      params: {
        level: 'campaign',
        date_preset: getDatePreset(),
        breakdowns: 'country',
        fields: 'impressions,reach,spend,clicks,ctr,cpc,actions,action_values,purchase_roas,date_start,date_stop',
        limit: '500'
      }
    }
  ];
}

async function fetchMetaReport(
  accessToken: string,
  report: MetaReport
): Promise<{ rows: unknown[]; source: 'api' | 'mock' }> {
  try {
    const params = new URLSearchParams({ ...report.params, access_token: accessToken });
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}${report.endpoint}?${params.toString()}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[meta-sync] ${report.reportType} API error:`, err.slice(0, 200));
      return { rows: [], source: 'api' };
    }

    const data = (await res.json()) as { data?: unknown[] };
    return { rows: data.data ?? [], source: 'api' };
  } catch (e) {
    console.warn(`[meta-sync] ${report.reportType} fetch failed:`, e);
    return { rows: [], source: 'api' };
  }
}

export async function syncMetaAccount(
  connectedAccountId: string,
  accessToken: string,
  adAccountId: string
): Promise<SyncResult[]> {
  const reports = buildReports(adAccountId);
  const results: SyncResult[] = [];

  for (const report of reports) {
    try {
      const { rows, source } = await fetchMetaReport(accessToken, report);
      results.push({ reportType: report.reportType, rowCount: rows.length, source, rows } as SyncResult & { rows: unknown[] });
    } catch (e) {
      results.push({
        reportType: report.reportType,
        rowCount: 0,
        source: 'mock',
        error: e instanceof Error ? e.message : 'unknown'
      });
    }
  }

  return results;
}
