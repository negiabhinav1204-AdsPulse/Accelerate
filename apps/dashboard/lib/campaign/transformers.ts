/**
 * Transformers — convert LLM free-form output into platform-valid values.
 * Every function is pure and deterministic given valid inputs.
 */

import type { PlatformKey, AdTypeKey } from './platform-config';

// ---------------------------------------------------------------------------
// Re-export key types
// ---------------------------------------------------------------------------

export type { PlatformKey, AdTypeKey };

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type NormalizedLocation = {
  country: string;
  state: string | null;
  city: string | null;
  raw: string;
};

export type TargetingSettings = {
  locations: NormalizedLocation[];
  ageRange: string;
  gender: string;
  languages: string[];
  interests?: string[];
  keywords?: string[];
  negativeKeywords?: string[];
  matchTypes?: string[];
  deviceTargeting?: string[];
  placements?: string;
  publisherPlatforms?: string[];
  optimizationGoal?: string;
  conversionEvent?: string;
  customAudiences?: string[];
  bidStrategy?: string;
};

export type AdCreative = {
  id?: string;
  headlines: string[];
  descriptions: string[];
  imageUrls: string[];
  imagePrompt?: string;
  ctaText: string;
  destinationUrl: string;
};

export type AdExtensions = {
  sitelinks?: { title: string; description: string; url: string }[];
  callouts?: string[];
  structuredSnippets?: { header: string; values: string[] };
};

export type AdTypePlan = {
  adType: string;
  adCount: number;
  budget: number;
  budgetPercent: number;
  targeting: TargetingSettings;
  bidStrategy: string;
  adExtensions?: AdExtensions;
  ads: AdCreative[];
};

export type PlatformPlan = {
  platform: 'google' | 'meta' | 'bing';
  budget: number;
  budgetPercent: number;
  adTypes: AdTypePlan[];
};

export type KpiForecastScenario = {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerResult: number;
  roas: number;
};

export type MediaPlan = {
  campaignName: string;
  objective: string;
  totalBudget: number;
  currency: string;
  dailyBudget: number;
  duration: number; // days
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  targetAudience: {
    locations: string[];
    ageRange: string;
    gender: string;
    languages: string[];
    interests?: string[];
  };
  platforms: PlatformPlan[];
  summary: {
    brandName: string;
    tagline: string;
    primaryObjective: string;
  };
  // Enhanced strategy fields
  executiveSummary?: string;
  kpiForecast?: {
    conservative: KpiForecastScenario;
    moderate: KpiForecastScenario;
    aggressive: KpiForecastScenario;
  };
  prerequisites?: {
    item: string;
    priority: 'blocker' | 'high' | 'medium' | 'low';
    description: string;
  }[];
  audienceStrategy?: {
    prospectingPercentage: number;
    retargetingPercentage: number;
    prospectingAudiences: string[];
    retargetingAudiences: string[];
  };
  riskFlags?: {
    risk: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  }[];
};

export type ConnectedAccount = {
  id: string;
  platform: string;
  accountId: string;
  accountName: string;
  isDefault: boolean;
  status: string;
  currency?: string | null;
  timezone?: string | null;
};

// ---------------------------------------------------------------------------
// Age range transformer
// ---------------------------------------------------------------------------

const GOOGLE_AGE_KEYS = [
  'AGE_RANGE_18_24',
  'AGE_RANGE_25_34',
  'AGE_RANGE_35_44',
  'AGE_RANGE_45_54',
  'AGE_RANGE_55_64',
  'AGE_RANGE_65_UP'
] as const;

const META_AGE_KEYS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

const BING_AGE_KEYS = [
  'EighteenToTwentyFour',
  'TwentyFiveToThirtyFour',
  'ThirtyFiveToFortyNine',
  'FiftyToSixtyFour',
  'SixtyFiveAndAbove'
] as const;

type AgeRangeBucket = {
  minAge: number;
  maxAge: number | null;
  google: string;
  meta: string;
  bing: string;
};

const AGE_BUCKETS: AgeRangeBucket[] = [
  { minAge: 18, maxAge: 24, google: 'AGE_RANGE_18_24', meta: '18-24', bing: 'EighteenToTwentyFour' },
  { minAge: 25, maxAge: 34, google: 'AGE_RANGE_25_34', meta: '25-34', bing: 'TwentyFiveToThirtyFour' },
  { minAge: 35, maxAge: 44, google: 'AGE_RANGE_35_44', meta: '35-44', bing: 'ThirtyFiveToFortyNine' },
  { minAge: 45, maxAge: 54, google: 'AGE_RANGE_45_54', meta: '45-54', bing: 'FiftyToSixtyFour' },
  { minAge: 55, maxAge: 64, google: 'AGE_RANGE_55_64', meta: '55-64', bing: 'FiftyToSixtyFour' },
  { minAge: 65, maxAge: null, google: 'AGE_RANGE_65_UP', meta: '65+', bing: 'SixtyFiveAndAbove' }
];

/**
 * Transform a free-form age range string (e.g. "25-45", "millennial", "18-34")
 * into a platform-specific age bucket key.
 * Returns the most appropriate single bucket; for ranges, returns the first matching bucket.
 */
export function transformAgeRange(llmAge: string, platform: PlatformKey): string {
  const normalized = llmAge.toLowerCase().trim();

  // Handle known labels
  if (normalized.includes('millennial') || normalized === '25-40' || normalized === '25-44') {
    const bucket = AGE_BUCKETS.find((b) => b.minAge === 25)!;
    return bucket[platform] ?? bucket.google;
  }
  if (normalized.includes('gen z') || normalized.includes('genz') || normalized === '18-24') {
    const bucket = AGE_BUCKETS.find((b) => b.minAge === 18)!;
    return bucket[platform] ?? bucket.google;
  }
  if (normalized.includes('boomer') || normalized.includes('55+') || normalized.includes('65+')) {
    const bucket = AGE_BUCKETS.find((b) => b.minAge >= 55)!;
    return bucket[platform] ?? bucket.google;
  }
  if (normalized.includes('all') || normalized === 'any' || normalized === '') {
    // Return a sensible default: 18-54 → first bucket
    const bucket = AGE_BUCKETS[0]!;
    return bucket[platform] ?? bucket.google;
  }

  // Try to parse numeric ranges like "25-44", "30-50"
  const rangeMatch = /(\d+)\s*[-–]\s*(\d+)/.exec(normalized);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    const startAge = parseInt(rangeMatch[1], 10);
    const best = AGE_BUCKETS.find(
      (b) => b.minAge <= startAge && (b.maxAge === null || b.maxAge >= startAge)
    );
    if (best) return best[platform] ?? best.google;
  }

  // Try just a number like "35"
  const singleMatch = /^(\d+)/.exec(normalized);
  if (singleMatch?.[1]) {
    const age = parseInt(singleMatch[1], 10);
    const best = AGE_BUCKETS.find(
      (b) => b.minAge <= age && (b.maxAge === null || b.maxAge >= age)
    );
    if (best) return best[platform] ?? best.google;
  }

  // Default: 25-34
  return AGE_BUCKETS[1]![platform] ?? AGE_BUCKETS[1]!.google;
}

// ---------------------------------------------------------------------------
// Gender transformer
// ---------------------------------------------------------------------------

const GENDER_MAP: Record<PlatformKey, Record<string, string>> = {
  google: {
    all: 'GENDER_UNDETERMINED',
    any: 'GENDER_UNDETERMINED',
    both: 'GENDER_UNDETERMINED',
    male: 'GENDER_MALE',
    men: 'GENDER_MALE',
    man: 'GENDER_MALE',
    female: 'GENDER_FEMALE',
    women: 'GENDER_FEMALE',
    woman: 'GENDER_FEMALE'
  },
  meta: {
    all: 'All',
    any: 'All',
    both: 'All',
    male: 'Male',
    men: 'Male',
    man: 'Male',
    female: 'Female',
    women: 'Female',
    woman: 'Female'
  },
  bing: {
    all: 'Unknown',
    any: 'Unknown',
    both: 'Unknown',
    male: 'Male',
    men: 'Male',
    man: 'Male',
    female: 'Female',
    women: 'Female',
    woman: 'Female'
  }
};

/** Transform a free-form gender string into a platform-specific gender enum value. */
export function transformGender(llmGender: string, platform: PlatformKey): string {
  const key = llmGender.toLowerCase().trim();
  const map = GENDER_MAP[platform];
  return map[key] ?? map['all']!;
}

// ---------------------------------------------------------------------------
// Bid strategy transformer
// ---------------------------------------------------------------------------

type BidStrategyMap = Record<string, Record<PlatformKey, Partial<Record<AdTypeKey, string>>>>;

const BID_STRATEGY_NORMALIZER: Record<string, string> = {
  // CPA variants
  'target cpa': 'target_cpa',
  'tcpa': 'target_cpa',
  'cpa': 'target_cpa',
  // ROAS variants
  'target roas': 'target_roas',
  'troas': 'target_roas',
  'roas': 'target_roas',
  'maximize conversion value': 'target_roas',
  // Maximize conversions
  'maximize conversions': 'maximize_conversions',
  'max conversions': 'maximize_conversions',
  'maxconv': 'maximize_conversions',
  // Maximize clicks
  'maximize clicks': 'maximize_clicks',
  'max clicks': 'maximize_clicks',
  'maxclicks': 'maximize_clicks',
  // Manual CPC
  'manual cpc': 'manual_cpc',
  'manual': 'manual_cpc',
  'cpc': 'manual_cpc',
  // Enhanced CPC
  'enhanced cpc': 'enhanced_cpc',
  'ecpc': 'enhanced_cpc',
  // Meta-specific
  'lowest cost': 'lowest_cost',
  'bid cap': 'bid_cap',
  'cost cap': 'cost_cap',
  'min roas': 'min_roas',
  'minimum roas': 'min_roas'
};

const BID_STRATEGY_PLATFORM_MAP: Record<
  string,
  Record<PlatformKey, string>
> = {
  target_cpa: {
    google: 'TARGET_CPA',
    meta: 'COST_CAP',
    bing: 'TargetCpa'
  },
  target_roas: {
    google: 'TARGET_ROAS',
    meta: 'MINIMUM_ROAS',
    bing: 'TargetRoas'
  },
  maximize_conversions: {
    google: 'MAXIMIZE_CONVERSIONS',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'MaximizeConversions'
  },
  maximize_clicks: {
    google: 'MAXIMIZE_CLICKS',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'MaximizeClicks'
  },
  manual_cpc: {
    google: 'MANUAL_CPC',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'ManualCpc'
  },
  enhanced_cpc: {
    google: 'MANUAL_CPC',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'EnhancedCpc'
  },
  lowest_cost: {
    google: 'MAXIMIZE_CONVERSIONS',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'MaximizeConversions'
  },
  bid_cap: {
    google: 'MANUAL_CPC',
    meta: 'LOWEST_COST_WITH_BID_CAP',
    bing: 'ManualCpc'
  },
  cost_cap: {
    google: 'TARGET_CPA',
    meta: 'COST_CAP',
    bing: 'TargetCpa'
  },
  min_roas: {
    google: 'TARGET_ROAS',
    meta: 'MINIMUM_ROAS',
    bing: 'TargetRoas'
  }
};

/**
 * Transform a free-form bid strategy string into a platform+adType-specific enum value.
 * Falls back to the platform's default maximize-conversions strategy.
 */
export function transformBidStrategy(
  llmBid: string,
  platform: PlatformKey,
  _adType: AdTypeKey
): string {
  const key = llmBid.toLowerCase().trim();
  const normalized = BID_STRATEGY_NORMALIZER[key] ?? key.replace(/\s+/g, '_');
  const mapped = BID_STRATEGY_PLATFORM_MAP[normalized];

  if (mapped) return mapped[platform];

  // Fallback defaults per platform
  const defaults: Record<PlatformKey, string> = {
    google: 'MAXIMIZE_CONVERSIONS',
    meta: 'LOWEST_COST_WITHOUT_CAP',
    bing: 'MaximizeConversions'
  };
  return defaults[platform];
}

// ---------------------------------------------------------------------------
// Location transformer
// ---------------------------------------------------------------------------

// Known country aliases (covers common LLM outputs)
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'US',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  england: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  au: 'AU',
  australia: 'AU',
  ca: 'CA',
  canada: 'CA',
  in: 'IN',
  india: 'IN',
  de: 'DE',
  germany: 'DE',
  fr: 'FR',
  france: 'FR',
  jp: 'JP',
  japan: 'JP',
  sg: 'SG',
  singapore: 'SG',
  ae: 'AE',
  uae: 'AE',
  'united arab emirates': 'AE',
  nz: 'NZ',
  'new zealand': 'NZ',
  br: 'BR',
  brazil: 'BR',
  mx: 'MX',
  mexico: 'MX',
  nl: 'NL',
  netherlands: 'NL'
};

/**
 * Transform a free-form location string into a normalized location object.
 * Handles city, state, country formats and plain country names.
 */
export function transformLocation(llmLocation: string): NormalizedLocation {
  const raw = llmLocation.trim();
  const parts = raw.split(',').map((p) => p.trim());

  if (parts.length === 1) {
    // Could be a country or a city
    const lower = parts[0]!.toLowerCase();
    const country = COUNTRY_ALIASES[lower];
    if (country) {
      return { country, state: null, city: null, raw };
    }
    // Unknown country — keep raw, do not default to US
    return { country: '', state: null, city: parts[0] ?? null, raw };
  }

  if (parts.length === 2) {
    // "City, Country" or "City, State"
    const possibleCountry = COUNTRY_ALIASES[parts[1]!.toLowerCase()];
    if (possibleCountry) {
      return { country: possibleCountry, state: null, city: parts[0] ?? null, raw };
    }
    // Unknown country — keep raw, do not default to US
    return { country: '', state: parts[1] ?? null, city: parts[0] ?? null, raw };
  }

  if (parts.length >= 3) {
    // "City, State, Country"
    const possibleCountry = COUNTRY_ALIASES[parts[parts.length - 1]!.toLowerCase()];
    return {
      country: possibleCountry ?? parts[parts.length - 1] ?? '',
      state: parts[1] ?? null,
      city: parts[0] ?? null,
      raw
    };
  }

  return { country: '', state: null, city: null, raw };
}

// ---------------------------------------------------------------------------
// Objective transformer
// ---------------------------------------------------------------------------

const OBJECTIVE_NORMALIZER: Record<string, string> = {
  // Google
  sales: 'SALES',
  conversions: 'SALES',
  purchases: 'SALES',
  revenue: 'SALES',
  ecommerce: 'SALES',
  leads: 'LEADS',
  'lead generation': 'LEADS',
  'lead gen': 'LEADS',
  traffic: 'WEBSITE_TRAFFIC',
  'website traffic': 'WEBSITE_TRAFFIC',
  clicks: 'WEBSITE_TRAFFIC',
  awareness: 'BRAND_AWARENESS',
  'brand awareness': 'BRAND_AWARENESS',
  reach: 'BRAND_AWARENESS',
  'app installs': 'APP_PROMOTION',
  'app promotion': 'APP_PROMOTION',
  installs: 'APP_PROMOTION',
  'app downloads': 'APP_PROMOTION'
};

const OBJECTIVE_PLATFORM_MAP: Record<string, Record<PlatformKey, string>> = {
  SALES: { google: 'SALES', meta: 'SALES', bing: 'Conversions' },
  LEADS: { google: 'LEADS', meta: 'LEADS', bing: 'Conversions' },
  WEBSITE_TRAFFIC: { google: 'WEBSITE_TRAFFIC', meta: 'TRAFFIC', bing: 'Visits' },
  BRAND_AWARENESS: { google: 'BRAND_AWARENESS', meta: 'AWARENESS', bing: 'BrandAwareness' },
  APP_PROMOTION: { google: 'APP_PROMOTION', meta: 'APP_PROMOTION', bing: 'AppInstalls' }
};

/**
 * Transform a free-form objective string into a platform-specific objective key.
 */
export function transformObjective(llmObjective: string, platform: PlatformKey): string {
  const key = llmObjective.toLowerCase().trim();
  const normalized = OBJECTIVE_NORMALIZER[key] ?? 'SALES';
  const mapped = OBJECTIVE_PLATFORM_MAP[normalized];
  if (!mapped) return platform === 'bing' ? 'Conversions' : 'SALES';
  return mapped[platform];
}

// ---------------------------------------------------------------------------
// MediaPlan transformer / validator
// ---------------------------------------------------------------------------

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function safeString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

/**
 * Transform and validate a raw (potentially LLM-generated) media plan object
 * into a fully-typed MediaPlan, enriched with connected account context.
 */
export function transformMediaPlan(
  rawPlan: unknown,
  connectedAccounts: ConnectedAccount[]
): MediaPlan {
  const raw = isRecord(rawPlan) ? rawPlan : {};

  const totalBudget = safeNumber(raw.totalBudget, 1000);
  const duration = safeNumber(raw.duration, 30);
  const startDate =
    typeof raw.startDate === 'string'
      ? raw.startDate
      : new Date().toISOString().split('T')[0]!;
  const endDate =
    typeof raw.endDate === 'string'
      ? raw.endDate
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + duration);
          return d.toISOString().split('T')[0]!;
        })();

  // Determine currency: trust the LLM's output first (it's informed by userPreferences),
  // fall back to connected account currency, then USD.
  const defaultCurrency =
    safeString(raw.currency, '') ||
    connectedAccounts.find((a) => a.currency)?.currency ||
    'USD';

  // Build platforms — filter to only platforms with connected accounts when possible
  const connectedPlatformNames = [
    ...new Set(connectedAccounts.filter((a) => a.status === 'connected').map((a) => a.platform))
  ] as PlatformKey[];

  let rawPlatforms = Array.isArray(raw.platforms) ? (raw.platforms as unknown[]) : [];

  // If no platforms in raw plan, construct minimal platform plans
  if (rawPlatforms.length === 0 && connectedPlatformNames.length > 0) {
    rawPlatforms = connectedPlatformNames.map((p, i) => ({
      platform: p,
      budget: totalBudget / connectedPlatformNames.length,
      budgetPercent: 100 / connectedPlatformNames.length,
      adTypes: []
    }));
  }

  const platforms: PlatformPlan[] = rawPlatforms
    .filter((p): p is Record<string, unknown> => isRecord(p))
    .filter((p) => {
      const pName = safeString(p.platform) as PlatformKey;
      // Only include platforms that are connected (if we have any), OR include all if none connected
      if (connectedPlatformNames.length === 0) return true;
      return connectedPlatformNames.includes(pName);
    })
    .map((p) => {
      const platform = safeString(p.platform, 'google') as 'google' | 'meta' | 'bing';
      const budget = safeNumber(p.budget, totalBudget / (rawPlatforms.length || 1));
      const budgetPercent = safeNumber(p.budgetPercent, 100 / (rawPlatforms.length || 1));

      const rawAdTypes = Array.isArray(p.adTypes) ? (p.adTypes as unknown[]) : [];
      const adTypes: AdTypePlan[] = rawAdTypes
        .filter((at): at is Record<string, unknown> => isRecord(at))
        .map((at) => {
          const adType = safeString(at.adType, 'search');
          const rawTargeting = isRecord(at.targeting) ? at.targeting : {};

          const rawLocations = safeStringArray(rawTargeting.locations);
          const locations: NormalizedLocation[] = rawLocations.map(transformLocation);

          const ageRaw = safeString(rawTargeting.ageRange, '25-44');
          const genderRaw = safeString(rawTargeting.gender, 'all');

          const targeting: TargetingSettings = {
            locations,
            ageRange: transformAgeRange(ageRaw, platform),
            gender: transformGender(genderRaw, platform),
            languages: safeStringArray(rawTargeting.languages).length > 0
              ? safeStringArray(rawTargeting.languages)
              : ['en'],
            interests: safeStringArray(rawTargeting.interests),
            keywords: safeStringArray(rawTargeting.keywords),
            negativeKeywords: safeStringArray(rawTargeting.negativeKeywords),
            matchTypes: safeStringArray(rawTargeting.matchTypes),
            deviceTargeting: safeStringArray(rawTargeting.deviceTargeting),
            placements: typeof rawTargeting.placements === 'string' ? rawTargeting.placements : undefined,
            publisherPlatforms: safeStringArray(rawTargeting.publisherPlatforms),
            optimizationGoal: typeof rawTargeting.optimizationGoal === 'string' ? rawTargeting.optimizationGoal : undefined,
            conversionEvent: typeof rawTargeting.conversionEvent === 'string' ? rawTargeting.conversionEvent : undefined,
            customAudiences: safeStringArray(rawTargeting.customAudiences),
            bidStrategy: typeof rawTargeting.bidStrategy === 'string' ? rawTargeting.bidStrategy : undefined
          };

          const bidStrategyRaw = safeString(at.bidStrategy, 'maximize conversions');
          const bidStrategy = transformBidStrategy(
            bidStrategyRaw,
            platform,
            adType as AdTypeKey
          );

          const rawAds = Array.isArray(at.ads) ? (at.ads as unknown[]) : [];
          const ads: AdCreative[] = rawAds
            .filter((ad): ad is Record<string, unknown> => isRecord(ad))
            .map((ad) => ({
              ...(typeof ad.id === 'string' ? { id: ad.id } : {}),
              headlines: safeStringArray(ad.headlines),
              descriptions: safeStringArray(ad.descriptions),
              imageUrls: safeStringArray(ad.imageUrls),
              ...(typeof ad.imagePrompt === 'string' ? { imagePrompt: ad.imagePrompt } : {}),
              ctaText: safeString(ad.ctaText, 'Learn More'),
              destinationUrl: safeString(ad.destinationUrl, '')
            }));

          // Parse adExtensions if present
          let adExtensions: AdExtensions | undefined;
          if (isRecord(at.adExtensions)) {
            const ext = at.adExtensions;
            adExtensions = {
              sitelinks: Array.isArray(ext.sitelinks)
                ? (ext.sitelinks as unknown[]).filter(isRecord).map((s) => ({
                    title: safeString(s.title, ''),
                    description: safeString(s.description, ''),
                    url: safeString(s.url, '')
                  }))
                : undefined,
              callouts: Array.isArray(ext.callouts)
                ? (ext.callouts as unknown[]).filter((c): c is string => typeof c === 'string')
                : undefined,
              structuredSnippets: isRecord(ext.structuredSnippets)
                ? {
                    header: safeString((ext.structuredSnippets as Record<string, unknown>).header, ''),
                    values: safeStringArray((ext.structuredSnippets as Record<string, unknown>).values)
                  }
                : undefined
            };
          }

          return {
            adType,
            adCount: safeNumber(at.adCount, Math.max(ads.length, 1)),
            budget: safeNumber(at.budget, 0),
            budgetPercent: safeNumber(at.budgetPercent, 0),
            targeting,
            bidStrategy,
            ...(adExtensions ? { adExtensions } : {}),
            ads
          };
        });

      return { platform, budget, budgetPercent, adTypes };
    });

  const rawAudience = isRecord(raw.targetAudience) ? raw.targetAudience : {};

  // Parse kpiForecast if present
  let kpiForecast: MediaPlan['kpiForecast'] | undefined;
  if (isRecord(raw.kpiForecast)) {
    const parseScenario = (s: unknown): KpiForecastScenario => {
      const sc = isRecord(s) ? s : {};
      return {
        impressions: safeNumber(sc.impressions, 0),
        clicks: safeNumber(sc.clicks, 0),
        ctr: safeNumber(sc.ctr, 0),
        conversions: safeNumber(sc.conversions, 0),
        costPerResult: safeNumber(sc.costPerResult, 0),
        roas: safeNumber(sc.roas, 0)
      };
    };
    kpiForecast = {
      conservative: parseScenario(raw.kpiForecast.conservative),
      moderate: parseScenario(raw.kpiForecast.moderate),
      aggressive: parseScenario(raw.kpiForecast.aggressive)
    };
  }

  // Parse prerequisites if present
  let prerequisites: MediaPlan['prerequisites'] | undefined;
  if (Array.isArray(raw.prerequisites)) {
    prerequisites = (raw.prerequisites as unknown[])
      .filter(isRecord)
      .map((p) => ({
        item: safeString(p.item, ''),
        priority: (['blocker', 'high', 'medium', 'low'].includes(safeString(p.priority))
          ? safeString(p.priority)
          : 'medium') as 'blocker' | 'high' | 'medium' | 'low',
        description: safeString(p.description, '')
      }))
      .filter((p) => p.item.length > 0);
  }

  // Parse audienceStrategy if present
  let audienceStrategy: MediaPlan['audienceStrategy'] | undefined;
  if (isRecord(raw.audienceStrategy)) {
    const as = raw.audienceStrategy;
    audienceStrategy = {
      prospectingPercentage: safeNumber(as.prospectingPercentage, 70),
      retargetingPercentage: safeNumber(as.retargetingPercentage, 30),
      prospectingAudiences: safeStringArray(as.prospectingAudiences),
      retargetingAudiences: safeStringArray(as.retargetingAudiences)
    };
  }

  // Parse riskFlags if present
  let riskFlags: MediaPlan['riskFlags'] | undefined;
  if (Array.isArray(raw.riskFlags)) {
    riskFlags = (raw.riskFlags as unknown[])
      .filter(isRecord)
      .map((r) => ({
        risk: safeString(r.risk, ''),
        severity: (['high', 'medium', 'low'].includes(safeString(r.severity))
          ? safeString(r.severity)
          : 'medium') as 'high' | 'medium' | 'low',
        mitigation: safeString(r.mitigation, '')
      }))
      .filter((r) => r.risk.length > 0);
  }

  return {
    campaignName: safeString(raw.campaignName, 'New Campaign'),
    objective: safeString(raw.objective, 'SALES'),
    totalBudget,
    currency: defaultCurrency,
    dailyBudget: safeNumber(raw.dailyBudget, Math.round(totalBudget / duration)),
    duration,
    startDate,
    endDate,
    targetAudience: {
      locations: safeStringArray(rawAudience.locations),
      ageRange: safeString(rawAudience.ageRange, '25-44'),
      gender: safeString(rawAudience.gender, 'All'),
      languages:
        safeStringArray(rawAudience.languages).length > 0
          ? safeStringArray(rawAudience.languages)
          : ['English'],
      interests: safeStringArray(rawAudience.interests)
    },
    platforms,
    summary: {
      brandName: safeString(
        isRecord(raw.summary) ? raw.summary.brandName : undefined,
        'Your Brand'
      ),
      tagline: safeString(isRecord(raw.summary) ? raw.summary.tagline : undefined, ''),
      primaryObjective: safeString(
        isRecord(raw.summary) ? raw.summary.primaryObjective : undefined,
        'Drive conversions'
      )
    },
    ...(safeString(raw.executiveSummary) && { executiveSummary: safeString(raw.executiveSummary) }),
    ...(kpiForecast && { kpiForecast }),
    ...(prerequisites && { prerequisites }),
    ...(audienceStrategy && { audienceStrategy }),
    ...(riskFlags && { riskFlags })
  };
}
