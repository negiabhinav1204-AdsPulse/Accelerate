/**
 * Meta Ad Library API integration
 * https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 *
 * Searches real live competitor ads from the Meta Ad Library using the
 * public /ads_archive endpoint. Requires a valid Meta user access token
 * (obtained via OAuth in the connectors flow).
 */

const META_API_VERSION = 'v23.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const AD_LIBRARY_FIELDS = [
  'id',
  'page_name',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'publisher_platforms',
  'impressions',
  'spend',
].join(',');

export type MetaAdLibraryAd = {
  id: string;
  page_name: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  impressions?: { lower_bound: string; upper_bound: string };
  spend?: { lower_bound: string; upper_bound: string; currency: string };
};

export type CompetitorAdResult = {
  competitorName: string;
  ads: MetaAdLibraryAd[];
  error?: string;
};

/**
 * Fetches live ads for a single competitor from Meta Ad Library.
 * Gracefully returns empty ads (not throws) on API errors so the
 * pipeline can continue with partial data.
 */
export async function fetchCompetitorAds(
  accessToken: string,
  competitorName: string,
  countries: string[] = ['US'],
  limit = 10
): Promise<CompetitorAdResult> {
  try {
    const params = new URLSearchParams({
      search_terms: competitorName,
      ad_reached_countries: JSON.stringify(countries),
      ad_type: 'ALL',
      fields: AD_LIBRARY_FIELDS,
      limit: String(limit),
      access_token: accessToken,
    });

    const res = await fetch(`${BASE_URL}/ads_archive?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    const data: { data?: MetaAdLibraryAd[]; error?: { message?: string } } = await res.json();

    if (!res.ok || data.error) {
      return {
        competitorName,
        ads: [],
        error: data.error?.message ?? `HTTP ${res.status}`,
      };
    }

    return { competitorName, ads: data.data ?? [] };
  } catch (err) {
    return {
      competitorName,
      ads: [],
      error: err instanceof Error ? err.message : 'Fetch failed',
    };
  }
}

/**
 * Fetches ads for multiple competitors in parallel, capped at 5 concurrent
 * requests to stay within rate limits.
 */
export async function fetchAllCompetitorAds(
  accessToken: string,
  competitorNames: string[],
  countries: string[] = ['US'],
  adsPerCompetitor = 8
): Promise<CompetitorAdResult[]> {
  // Fetch in parallel (all at once — usually ≤8 competitors)
  return Promise.all(
    competitorNames.map((name) =>
      fetchCompetitorAds(accessToken, name, countries, adsPerCompetitor)
    )
  );
}

/**
 * Formats Meta Ad Library results into a compact text block for LLM prompts.
 */
export function formatAdLibraryForPrompt(results: CompetitorAdResult[]): string {
  const lines: string[] = [];

  for (const result of results) {
    if (result.error || result.ads.length === 0) {
      lines.push(`${result.competitorName}: No ads found${result.error ? ` (${result.error})` : ''}`);
      continue;
    }

    lines.push(`\n### ${result.competitorName} — ${result.ads.length} active ads`);

    for (const ad of result.ads.slice(0, 5)) {
      const parts: string[] = [];
      if (ad.ad_creative_link_titles?.length) parts.push(`Title: "${ad.ad_creative_link_titles[0]}"`);
      if (ad.ad_creative_bodies?.length) parts.push(`Body: "${ad.ad_creative_bodies[0]?.slice(0, 120)}"`);
      if (ad.ad_creative_link_descriptions?.length) parts.push(`Desc: "${ad.ad_creative_link_descriptions[0]}"`);
      if (ad.publisher_platforms?.length) parts.push(`Platforms: ${ad.publisher_platforms.join(', ')}`);
      if (ad.spend) parts.push(`Spend: ${ad.spend.currency} ${ad.spend.lower_bound}–${ad.spend.upper_bound}`);
      if (ad.impressions) parts.push(`Impressions: ${ad.impressions.lower_bound}–${ad.impressions.upper_bound}`);
      if (ad.ad_delivery_start_time) parts.push(`Active since: ${ad.ad_delivery_start_time}`);
      lines.push(`  - ${parts.join(' | ')}`);
    }
  }

  return lines.join('\n');
}
