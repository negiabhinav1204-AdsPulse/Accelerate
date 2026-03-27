/**
 * Google Ads Tier 1 data sync
 *
 * Fetches the 10 Tier 1 resources defined in the SMB Priority Reports doc:
 *   customer, campaign, ad_group, ad_group_ad, keyword_view,
 *   search_term_view, geographic_view, age_range_view, gender_view,
 *   conversion_action
 *
 * Segments always included: segments.date, segments.device, segments.ad_network_type
 * Key metrics: impressions, clicks, cost_micros, conversions, conversions_value,
 *              ctr, average_cpc, search_impression_share
 *
 * Uses Google Ads API v17 via REST (GAQL / searchStream endpoint).
 * Falls back to structured mock data when API credentials are missing or return errors.
 */

import type { SyncResult } from './types';

const GOOGLE_ADS_API_VERSION = 'v17';
const DATE_RANGE_DAYS = 30;

type GaqlReport = {
  reportType: string;
  query: string;
};

function getDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DATE_RANGE_DAYS);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

const { start, end } = getDateRange();

const TIER1_QUERIES: GaqlReport[] = [
  {
    reportType: 'customer',
    query: `SELECT
      customer.id, customer.descriptive_name, customer.currency_code,
      customer.time_zone, customer.status,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc, metrics.search_impression_share,
      segments.date, segments.device, segments.ad_network_type
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'`
  },
  {
    reportType: 'campaign',
    query: `SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      campaign.bidding_strategy_type, campaign.start_date, campaign.end_date,
      campaign_budget.amount_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc, metrics.search_impression_share,
      segments.date, segments.device, segments.ad_network_type
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'`
  },
  {
    reportType: 'ad_group',
    query: `SELECT
      ad_group.id, ad_group.name, ad_group.status, ad_group.type,
      campaign.id, campaign.name,
      ad_group.cpc_bid_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.device, segments.ad_network_type
    FROM ad_group
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND ad_group.status != 'REMOVED'`
  },
  {
    reportType: 'ad_group_ad',
    query: `SELECT
      ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
      ad_group_ad.status, ad_group_ad.policy_summary.approval_status,
      ad_group.id, ad_group.name, campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.device, segments.ad_network_type
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND ad_group_ad.status != 'REMOVED'`
  },
  {
    reportType: 'keyword_view',
    query: `SELECT
      ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type, ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group_criterion.quality_info.ad_relevance,
      ad_group_criterion.quality_info.landing_page_experience,
      ad_group.id, ad_group.name, campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc, metrics.search_impression_share,
      segments.date, segments.device
    FROM keyword_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND ad_group_criterion.status != 'REMOVED'`
  },
  {
    reportType: 'search_term_view',
    query: `SELECT
      search_term_view.search_term, search_term_view.status,
      campaign.id, campaign.name, ad_group.id, ad_group.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.device
    FROM search_term_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'`
  },
  {
    reportType: 'geographic_view',
    query: `SELECT
      geographic_view.country_criterion_id, geographic_view.location_type,
      campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.device, segments.geo_target_city,
      segments.geo_target_country, segments.geo_target_region
    FROM geographic_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'`
  },
  {
    reportType: 'age_range_view',
    query: `SELECT
      ad_group_criterion.age_range.type, ad_group_criterion.status,
      ad_group.id, ad_group.name, campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.ad_network_type
    FROM age_range_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'`
  },
  {
    reportType: 'gender_view',
    query: `SELECT
      ad_group_criterion.gender.type, ad_group_criterion.status,
      ad_group.id, ad_group.name, campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr,
      metrics.average_cpc,
      segments.date, segments.ad_network_type
    FROM gender_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'`
  },
  {
    reportType: 'conversion_action',
    query: `SELECT
      conversion_action.id, conversion_action.name, conversion_action.status,
      conversion_action.type, conversion_action.category,
      conversion_action.counting_type,
      metrics.conversions, metrics.conversions_value,
      metrics.all_conversions, metrics.view_through_conversions,
      segments.date, segments.conversion_action_name
    FROM conversion_action
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND conversion_action.status = 'ENABLED'`
  }
];

async function fetchGaqlReport(
  accessToken: string,
  customerId: string,
  developerToken: string,
  report: GaqlReport
): Promise<{ rows: unknown[]; source: 'api' | 'mock' }> {
  try {
    const res = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: report.query, pageSize: 10000 }),
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[google-sync] ${report.reportType} API error:`, err.slice(0, 200));
      return { rows: getMockRows(report.reportType), source: 'mock' };
    }

    const data = (await res.json()) as { results?: unknown[] };
    return { rows: data.results ?? [], source: 'api' };
  } catch {
    return { rows: getMockRows(report.reportType), source: 'mock' };
  }
}

function getMockRows(reportType: string): unknown[] {
  const base = { date: new Date().toISOString().split('T')[0], device: 'DESKTOP', adNetworkType: 'SEARCH' };
  switch (reportType) {
    case 'customer':
      return [{ ...base, impressions: 12400, clicks: 380, costMicros: 4200000, conversions: 18, ctr: 0.031 }];
    case 'campaign':
      return [
        { ...base, campaignId: 'mock-1', campaignName: 'Brand Campaign', status: 'ENABLED', impressions: 7200, clicks: 220, costMicros: 2500000, conversions: 12, ctr: 0.031 },
        { ...base, campaignId: 'mock-2', campaignName: 'Competitor Campaign', status: 'ENABLED', impressions: 5200, clicks: 160, costMicros: 1700000, conversions: 6, ctr: 0.031 }
      ];
    case 'ad_group':
      return [
        { ...base, adGroupId: 'mock-ag-1', adGroupName: 'Core Keywords', campaignId: 'mock-1', impressions: 4100, clicks: 130 },
        { ...base, adGroupId: 'mock-ag-2', adGroupName: 'Long Tail', campaignId: 'mock-1', impressions: 3100, clicks: 90 }
      ];
    case 'keyword_view':
      return [
        { ...base, keyword: 'buy running shoes', matchType: 'EXACT', qualityScore: 8, impressions: 1200, clicks: 60, ctr: 0.05, costMicros: 720000 },
        { ...base, keyword: 'running shoes online', matchType: 'PHRASE', qualityScore: 7, impressions: 980, clicks: 38, ctr: 0.039, costMicros: 456000 }
      ];
    case 'search_term_view':
      return [
        { ...base, searchTerm: 'best running shoes 2026', impressions: 320, clicks: 22, costMicros: 264000, conversions: 2 },
        { ...base, searchTerm: 'cheap running shoes free shipping', impressions: 180, clicks: 4, costMicros: 48000, conversions: 0 }
      ];
    case 'geographic_view':
      return [
        { ...base, country: 'IN', region: 'Karnataka', city: 'Bangalore', impressions: 4200, clicks: 140, conversions: 8 },
        { ...base, country: 'IN', region: 'Maharashtra', city: 'Mumbai', impressions: 3100, clicks: 98, conversions: 5 }
      ];
    case 'age_range_view':
      return [
        { ...base, ageRange: 'AGE_RANGE_25_34', impressions: 3800, clicks: 120, conversions: 7 },
        { ...base, ageRange: 'AGE_RANGE_18_24', impressions: 2900, clicks: 88, conversions: 4 },
        { ...base, ageRange: 'AGE_RANGE_35_44', impressions: 2200, clicks: 72, conversions: 5 }
      ];
    case 'gender_view':
      return [
        { ...base, gender: 'MALE', impressions: 6800, clicks: 210, conversions: 10 },
        { ...base, gender: 'FEMALE', impressions: 5100, clicks: 158, conversions: 7 }
      ];
    case 'conversion_action':
      return [
        { ...base, conversionActionName: 'Purchase', conversions: 14, conversionsValue: 8400 },
        { ...base, conversionActionName: 'Add to Cart', conversions: 62, conversionsValue: 0 },
        { ...base, conversionActionName: 'Sign Up', conversions: 8, conversionsValue: 0 }
      ];
    default:
      return [{ ...base, note: 'mock data' }];
  }
}

export async function syncGoogleAccount(
  connectedAccountId: string,
  accessToken: string,
  customerId: string
): Promise<SyncResult[]> {
  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN ?? '';
  const results: SyncResult[] = [];

  for (const report of TIER1_QUERIES) {
    try {
      const { rows, source } = await fetchGaqlReport(
        accessToken,
        customerId,
        developerToken,
        report
      );
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
