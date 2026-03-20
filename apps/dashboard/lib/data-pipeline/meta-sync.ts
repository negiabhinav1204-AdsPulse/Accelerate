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
const DATE_RANGE_DAYS = 30;

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
      return { rows: getMockRows(report.reportType), source: 'mock' };
    }

    const data = (await res.json()) as { data?: unknown[] };
    return { rows: data.data ?? [], source: 'api' };
  } catch {
    return { rows: getMockRows(report.reportType), source: 'mock' };
  }
}

function getMockRows(reportType: string): unknown[] {
  const today = new Date().toISOString().split('T')[0];
  switch (reportType) {
    case 'campaigns':
      return [
        { id: 'mock-camp-1', name: 'Summer Sale 2026', status: 'ACTIVE', objective: 'CONVERSIONS', daily_budget: '5000', created_time: today },
        { id: 'mock-camp-2', name: 'Brand Awareness Q1', status: 'ACTIVE', objective: 'REACH', daily_budget: '3000', created_time: today }
      ];
    case 'adsets':
      return [
        { id: 'mock-as-1', name: 'Lookalike 1% India', status: 'ACTIVE', campaign_id: 'mock-camp-1', optimization_goal: 'PURCHASE', daily_budget: '2500' },
        { id: 'mock-as-2', name: 'Retargeting - 30d visitors', status: 'ACTIVE', campaign_id: 'mock-camp-1', optimization_goal: 'PURCHASE', daily_budget: '2500' }
      ];
    case 'ads':
      return [
        { id: 'mock-ad-1', name: 'Carousel - Product A', status: 'ACTIVE', adset_id: 'mock-as-1', campaign_id: 'mock-camp-1' },
        { id: 'mock-ad-2', name: 'Single Image - Hero', status: 'ACTIVE', adset_id: 'mock-as-1', campaign_id: 'mock-camp-1' }
      ];
    case 'adcreatives':
      return [
        { id: 'mock-cr-1', name: 'Carousel Creative', title: 'Shop Now', body: 'Up to 50% off', call_to_action_type: 'SHOP_NOW' },
        { id: 'mock-cr-2', name: 'Hero Image Creative', title: 'New Arrivals', body: 'Explore our latest collection', call_to_action_type: 'LEARN_MORE' }
      ];
    case 'campaign_insights_daily':
      return [
        { date_start: today, date_stop: today, campaign_id: 'mock-camp-1', campaign_name: 'Summer Sale 2026', impressions: '8420', reach: '6200', spend: '1840.50', clicks: '312', ctr: '3.71', cpc: '5.90', purchase_roas: [{ action_type: 'omni_purchase', value: '4.2' }] },
        { date_start: today, date_stop: today, campaign_id: 'mock-camp-2', campaign_name: 'Brand Awareness Q1', impressions: '24800', reach: '21000', spend: '980.00', clicks: '148', ctr: '0.60', cpc: '6.62' }
      ];
    case 'adset_insights_daily':
      return [
        { date_start: today, date_stop: today, adset_id: 'mock-as-1', adset_name: 'Lookalike 1% India', impressions: '4800', spend: '1020.00', clicks: '192', ctr: '4.00', cpc: '5.31', actions: [{ action_type: 'purchase', value: '14' }] },
        { date_start: today, date_stop: today, adset_id: 'mock-as-2', adset_name: 'Retargeting - 30d visitors', impressions: '3620', spend: '820.50', clicks: '120', ctr: '3.31', cpc: '6.84', actions: [{ action_type: 'purchase', value: '9' }] }
      ];
    case 'ad_insights_daily':
      return [
        { date_start: today, date_stop: today, ad_id: 'mock-ad-1', ad_name: 'Carousel - Product A', impressions: '2800', spend: '610.00', clicks: '124', ctr: '4.43', quality_ranking: 'ABOVE_AVERAGE', engagement_rate_ranking: 'AVERAGE', conversion_rate_ranking: 'ABOVE_AVERAGE' }
      ];
    case 'insights_by_age_gender':
      return [
        { date_start: today, date_stop: today, age: '25-34', gender: 'female', impressions: '3200', spend: '740.00', clicks: '128', actions: [{ action_type: 'purchase', value: '8' }] },
        { date_start: today, date_stop: today, age: '18-24', gender: 'male', impressions: '2400', spend: '520.00', clicks: '84', actions: [{ action_type: 'purchase', value: '4' }] }
      ];
    case 'insights_by_platform_placement':
      return [
        { date_start: today, date_stop: today, publisher_platform: 'facebook', platform_position: 'feed', impressions: '5200', spend: '1100.00', clicks: '188', actions: [{ action_type: 'purchase', value: '11' }] },
        { date_start: today, date_stop: today, publisher_platform: 'instagram', platform_position: 'stream', impressions: '3800', spend: '740.50', clicks: '124', actions: [{ action_type: 'purchase', value: '7' }] },
        { date_start: today, date_stop: today, publisher_platform: 'instagram', platform_position: 'story', impressions: '2800', spend: '480.00', clicks: '82', actions: [{ action_type: 'purchase', value: '4' }] }
      ];
    default:
      return [];
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
