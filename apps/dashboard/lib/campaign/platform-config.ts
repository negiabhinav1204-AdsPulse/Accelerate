/**
 * Platform configuration — all valid field values for each platform and ad type.
 * This is the single source of truth for campaign creation validation.
 */

export type PlatformKey = 'google' | 'meta' | 'bing';

export type AdTypeKey =
  // Google
  | 'search'
  | 'display'
  | 'pmax'
  | 'shopping'
  | 'demand_gen'
  // Meta
  | 'feed'
  | 'stories'
  | 'reels'
  | 'carousel'
  | 'collection'
  // Bing
  | 'bing_search'
  | 'bing_display'
  | 'audience_network';

export type BidStrategy = {
  key: string;
  label: string;
  description: string;
};

export type AgeRange = {
  key: string;
  label: string;
  minAge: number;
  maxAge: number | null; // null = no upper bound
};

export type Gender = {
  key: string;
  label: string;
};

export type Objective = {
  key: string;
  label: string;
};

export type ImageSpec = {
  width: number;
  height: number;
  aspectRatio: string;
  label: string;
  required: boolean;
};

export type HeadlineSpec = {
  maxCount: number;
  maxChars: number;
};

export type DescriptionSpec = {
  maxCount: number;
  maxChars: number;
};

export type Prerequisite = {
  type: 'merchant_center' | 'catalog' | 'app' | 'pixel' | 'conversion_tracking';
  label: string;
  description: string;
  required: boolean;
};

export type PlatformAdTypeConfig = {
  platform: PlatformKey;
  adType: AdTypeKey;
  label: string;
  description: string;
  headlines: HeadlineSpec;
  descriptions: DescriptionSpec;
  imageSpecs: ImageSpec[];
  bidStrategies: BidStrategy[];
  ageRanges: AgeRange[];
  genders: Gender[];
  objectives: Objective[];
  prerequisites: Prerequisite[];
  supportsVideo: boolean;
  supportsCarousel: boolean;
};

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------

const GOOGLE_AGE_RANGES: AgeRange[] = [
  { key: 'AGE_RANGE_18_24', label: '18–24', minAge: 18, maxAge: 24 },
  { key: 'AGE_RANGE_25_34', label: '25–34', minAge: 25, maxAge: 34 },
  { key: 'AGE_RANGE_35_44', label: '35–44', minAge: 35, maxAge: 44 },
  { key: 'AGE_RANGE_45_54', label: '45–54', minAge: 45, maxAge: 54 },
  { key: 'AGE_RANGE_55_64', label: '55–64', minAge: 55, maxAge: 64 },
  { key: 'AGE_RANGE_65_UP', label: '65+', minAge: 65, maxAge: null }
];

const GOOGLE_GENDERS: Gender[] = [
  { key: 'GENDER_UNDETERMINED', label: 'All' },
  { key: 'GENDER_MALE', label: 'Male' },
  { key: 'GENDER_FEMALE', label: 'Female' }
];

const GOOGLE_SEARCH_BID_STRATEGIES: BidStrategy[] = [
  {
    key: 'TARGET_CPA',
    label: 'Target CPA',
    description: 'Set bids to get as many conversions as possible at your target cost-per-action.'
  },
  {
    key: 'TARGET_ROAS',
    label: 'Target ROAS',
    description: 'Set bids to maximize conversion value at your target return on ad spend.'
  },
  {
    key: 'MAXIMIZE_CONVERSIONS',
    label: 'Maximize Conversions',
    description: 'Automatically set bids to help get the most conversions within your budget.'
  },
  {
    key: 'MAXIMIZE_CLICKS',
    label: 'Maximize Clicks',
    description: 'Automatically set bids to help get the most clicks within your budget.'
  },
  {
    key: 'MANUAL_CPC',
    label: 'Manual CPC',
    description: 'Manually set your maximum cost-per-click bids.'
  }
];

const GOOGLE_DISPLAY_BID_STRATEGIES: BidStrategy[] = [
  {
    key: 'TARGET_CPA',
    label: 'Target CPA',
    description: 'Set bids to get as many conversions as possible at your target cost-per-action.'
  },
  {
    key: 'MAXIMIZE_CONVERSIONS',
    label: 'Maximize Conversions',
    description: 'Automatically set bids to help get the most conversions within your budget.'
  },
  {
    key: 'TARGET_ROAS',
    label: 'Target ROAS',
    description: 'Set bids to maximize conversion value at your target return on ad spend.'
  },
  {
    key: 'MANUAL_CPC',
    label: 'Manual CPC',
    description: 'Manually set your maximum cost-per-click bids.'
  }
];

const GOOGLE_OBJECTIVES: Objective[] = [
  { key: 'SALES', label: 'Sales' },
  { key: 'LEADS', label: 'Leads' },
  { key: 'WEBSITE_TRAFFIC', label: 'Website Traffic' },
  { key: 'BRAND_AWARENESS', label: 'Brand Awareness & Reach' },
  { key: 'APP_PROMOTION', label: 'App Promotion' },
  { key: 'LOCAL_STORE_VISITS', label: 'Local Store Visits & Promotions' }
];

const GOOGLE_DISPLAY_IMAGE_SPECS: ImageSpec[] = [
  {
    width: 1200,
    height: 628,
    aspectRatio: '1.91:1',
    label: 'Landscape (recommended)',
    required: true
  },
  { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square', required: false },
  { width: 628, height: 628, aspectRatio: '1:1', label: 'Small square', required: false },
  { width: 160, height: 600, aspectRatio: '9:37.5', label: 'Wide skyscraper', required: false },
  { width: 300, height: 250, aspectRatio: '6:5', label: 'Medium rectangle', required: false },
  { width: 728, height: 90, aspectRatio: '728:90', label: 'Leaderboard', required: false }
];

export const GOOGLE_SEARCH_CONFIG: PlatformAdTypeConfig = {
  platform: 'google',
  adType: 'search',
  label: 'Google Search',
  description: 'Text ads that appear in Google search results when users search for your keywords.',
  headlines: { maxCount: 15, maxChars: 30 },
  descriptions: { maxCount: 4, maxChars: 90 },
  imageSpecs: [],
  bidStrategies: GOOGLE_SEARCH_BID_STRATEGIES,
  ageRanges: GOOGLE_AGE_RANGES,
  genders: GOOGLE_GENDERS,
  objectives: GOOGLE_OBJECTIVES,
  prerequisites: [
    {
      type: 'conversion_tracking',
      label: 'Conversion Tracking',
      description: 'Google Ads conversion tracking must be set up for smart bidding strategies.',
      required: false
    }
  ],
  supportsVideo: false,
  supportsCarousel: false
};

export const GOOGLE_DISPLAY_CONFIG: PlatformAdTypeConfig = {
  platform: 'google',
  adType: 'display',
  label: 'Google Display',
  description:
    'Responsive display ads shown across the Google Display Network of websites and apps.',
  headlines: { maxCount: 5, maxChars: 30 },
  descriptions: { maxCount: 5, maxChars: 90 },
  imageSpecs: GOOGLE_DISPLAY_IMAGE_SPECS,
  bidStrategies: GOOGLE_DISPLAY_BID_STRATEGIES,
  ageRanges: GOOGLE_AGE_RANGES,
  genders: GOOGLE_GENDERS,
  objectives: GOOGLE_OBJECTIVES,
  prerequisites: [],
  supportsVideo: false,
  supportsCarousel: false
};

export const GOOGLE_PMAX_CONFIG: PlatformAdTypeConfig = {
  platform: 'google',
  adType: 'pmax',
  label: 'Performance Max',
  description:
    'Goal-based campaigns that use asset groups to access all Google channels from one campaign.',
  headlines: { maxCount: 15, maxChars: 30 },
  descriptions: { maxCount: 4, maxChars: 90 },
  imageSpecs: GOOGLE_DISPLAY_IMAGE_SPECS,
  bidStrategies: [
    {
      key: 'MAXIMIZE_CONVERSIONS',
      label: 'Maximize Conversions',
      description: 'Get the most conversions within your budget.'
    },
    {
      key: 'MAXIMIZE_CONVERSION_VALUE',
      label: 'Maximize Conversion Value',
      description: 'Get the highest conversion value within your budget.'
    },
    {
      key: 'TARGET_CPA',
      label: 'Target CPA',
      description: 'Set bids to get as many conversions as possible at your target CPA.'
    },
    {
      key: 'TARGET_ROAS',
      label: 'Target ROAS',
      description: 'Optimize bids to achieve your target return on ad spend.'
    }
  ],
  ageRanges: GOOGLE_AGE_RANGES,
  genders: GOOGLE_GENDERS,
  objectives: GOOGLE_OBJECTIVES,
  prerequisites: [
    {
      type: 'conversion_tracking',
      label: 'Conversion Tracking',
      description: 'Conversion tracking is required for Performance Max campaigns.',
      required: true
    }
  ],
  supportsVideo: true,
  supportsCarousel: false
};

export const GOOGLE_SHOPPING_CONFIG: PlatformAdTypeConfig = {
  platform: 'google',
  adType: 'shopping',
  label: 'Google Shopping',
  description: 'Product listing ads that show product images, prices, and store name in search.',
  headlines: { maxCount: 1, maxChars: 150 },
  descriptions: { maxCount: 1, maxChars: 5000 },
  imageSpecs: [
    { width: 800, height: 800, aspectRatio: '1:1', label: 'Product image (minimum)', required: true }
  ],
  bidStrategies: [
    {
      key: 'TARGET_ROAS',
      label: 'Target ROAS',
      description: 'Maximize conversion value at your target return on ad spend.'
    },
    {
      key: 'MAXIMIZE_CLICKS',
      label: 'Maximize Clicks',
      description: 'Get the most clicks within your budget.'
    },
    {
      key: 'MANUAL_CPC',
      label: 'Manual CPC',
      description: 'Set individual bids for each product group.'
    }
  ],
  ageRanges: GOOGLE_AGE_RANGES,
  genders: GOOGLE_GENDERS,
  objectives: [
    { key: 'SALES', label: 'Sales' },
    { key: 'WEBSITE_TRAFFIC', label: 'Website Traffic' }
  ],
  prerequisites: [
    {
      type: 'merchant_center',
      label: 'Google Merchant Center',
      description:
        'A linked and approved Google Merchant Center account with a product feed is required.',
      required: true
    }
  ],
  supportsVideo: false,
  supportsCarousel: false
};

export const GOOGLE_DEMAND_GEN_CONFIG: PlatformAdTypeConfig = {
  platform: 'google',
  adType: 'demand_gen',
  label: 'Demand Gen',
  description:
    'Visual ads on YouTube, Discover, and Gmail to reach users early in their purchase journey.',
  headlines: { maxCount: 5, maxChars: 40 },
  descriptions: { maxCount: 5, maxChars: 90 },
  imageSpecs: [
    { width: 1200, height: 628, aspectRatio: '1.91:1', label: 'Landscape', required: true },
    { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square', required: true },
    { width: 960, height: 1200, aspectRatio: '4:5', label: 'Portrait', required: false }
  ],
  bidStrategies: [
    {
      key: 'MAXIMIZE_CONVERSIONS',
      label: 'Maximize Conversions',
      description: 'Automatically optimize for the most conversions.'
    },
    {
      key: 'TARGET_CPA',
      label: 'Target CPA',
      description: 'Optimize for conversions at a specific cost.'
    },
    {
      key: 'MAXIMIZE_CLICKS',
      label: 'Maximize Clicks',
      description: 'Drive the most traffic within budget.'
    }
  ],
  ageRanges: GOOGLE_AGE_RANGES,
  genders: GOOGLE_GENDERS,
  objectives: [
    { key: 'AWARENESS', label: 'Brand Awareness' },
    { key: 'CONSIDERATION', label: 'Product Consideration' },
    { key: 'CONVERSIONS', label: 'Conversions' }
  ],
  prerequisites: [],
  supportsVideo: true,
  supportsCarousel: true
};

// ---------------------------------------------------------------------------
// Meta Ads
// ---------------------------------------------------------------------------

const META_AGE_RANGES: AgeRange[] = [
  { key: '18-24', label: '18–24', minAge: 18, maxAge: 24 },
  { key: '25-34', label: '25–34', minAge: 25, maxAge: 34 },
  { key: '35-44', label: '35–44', minAge: 35, maxAge: 44 },
  { key: '45-54', label: '45–54', minAge: 45, maxAge: 54 },
  { key: '55-64', label: '55–64', minAge: 55, maxAge: 64 },
  { key: '65+', label: '65+', minAge: 65, maxAge: null }
];

const META_GENDERS: Gender[] = [
  { key: 'All', label: 'All' },
  { key: 'Male', label: 'Male' },
  { key: 'Female', label: 'Female' }
];

const META_OBJECTIVES: Objective[] = [
  { key: 'AWARENESS', label: 'Awareness' },
  { key: 'TRAFFIC', label: 'Traffic' },
  { key: 'ENGAGEMENT', label: 'Engagement' },
  { key: 'LEADS', label: 'Leads' },
  { key: 'APP_PROMOTION', label: 'App Promotion' },
  { key: 'SALES', label: 'Sales' }
];

const META_BID_STRATEGIES: BidStrategy[] = [
  {
    key: 'LOWEST_COST_WITHOUT_CAP',
    label: 'Lowest Cost',
    description: 'Get the most results for your budget automatically.'
  },
  {
    key: 'LOWEST_COST_WITH_BID_CAP',
    label: 'Bid Cap',
    description: 'Set a maximum bid in auctions.'
  },
  {
    key: 'COST_CAP',
    label: 'Cost Cap',
    description: 'Control cost per result while maximizing volume.'
  },
  {
    key: 'MINIMUM_ROAS',
    label: 'Minimum ROAS',
    description: 'Set a minimum return on ad spend.'
  }
];

export const META_FEED_CONFIG: PlatformAdTypeConfig = {
  platform: 'meta',
  adType: 'feed',
  label: 'Meta Feed',
  description: 'Single image or video ads appearing in the Facebook and Instagram feed.',
  headlines: { maxCount: 1, maxChars: 40 },
  descriptions: { maxCount: 1, maxChars: 125 },
  imageSpecs: [
    { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Square (recommended)', required: true },
    { width: 1080, height: 1350, aspectRatio: '4:5', label: 'Portrait', required: false },
    { width: 1080, height: 566, aspectRatio: '1.91:1', label: 'Landscape', required: false }
  ],
  bidStrategies: META_BID_STRATEGIES,
  ageRanges: META_AGE_RANGES,
  genders: META_GENDERS,
  objectives: META_OBJECTIVES,
  prerequisites: [],
  supportsVideo: true,
  supportsCarousel: false
};

export const META_STORIES_CONFIG: PlatformAdTypeConfig = {
  platform: 'meta',
  adType: 'stories',
  label: 'Meta Stories',
  description: 'Full-screen vertical ads in Facebook and Instagram Stories.',
  headlines: { maxCount: 1, maxChars: 40 },
  descriptions: { maxCount: 1, maxChars: 125 },
  imageSpecs: [
    { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Vertical (required)', required: true }
  ],
  bidStrategies: META_BID_STRATEGIES,
  ageRanges: META_AGE_RANGES,
  genders: META_GENDERS,
  objectives: META_OBJECTIVES,
  prerequisites: [],
  supportsVideo: true,
  supportsCarousel: false
};

export const META_REELS_CONFIG: PlatformAdTypeConfig = {
  platform: 'meta',
  adType: 'reels',
  label: 'Meta Reels',
  description: 'Short-form video ads running in Facebook and Instagram Reels.',
  headlines: { maxCount: 1, maxChars: 40 },
  descriptions: { maxCount: 1, maxChars: 72 },
  imageSpecs: [
    { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Vertical video', required: true }
  ],
  bidStrategies: META_BID_STRATEGIES,
  ageRanges: META_AGE_RANGES,
  genders: META_GENDERS,
  objectives: META_OBJECTIVES,
  prerequisites: [],
  supportsVideo: true,
  supportsCarousel: false
};

export const META_CAROUSEL_CONFIG: PlatformAdTypeConfig = {
  platform: 'meta',
  adType: 'carousel',
  label: 'Meta Carousel',
  description: 'Multi-card ads where each card can have its own image, headline, and link.',
  headlines: { maxCount: 10, maxChars: 40 },
  descriptions: { maxCount: 10, maxChars: 20 },
  imageSpecs: [
    {
      width: 1080,
      height: 1080,
      aspectRatio: '1:1',
      label: 'Square per card (required)',
      required: true
    }
  ],
  bidStrategies: META_BID_STRATEGIES,
  ageRanges: META_AGE_RANGES,
  genders: META_GENDERS,
  objectives: META_OBJECTIVES,
  prerequisites: [],
  supportsVideo: true,
  supportsCarousel: true
};

export const META_COLLECTION_CONFIG: PlatformAdTypeConfig = {
  platform: 'meta',
  adType: 'collection',
  label: 'Meta Collection',
  description:
    'Instant shopping experience with a hero image/video and product grid from your catalog.',
  headlines: { maxCount: 1, maxChars: 40 },
  descriptions: { maxCount: 1, maxChars: 125 },
  imageSpecs: [
    {
      width: 1200,
      height: 628,
      aspectRatio: '1.91:1',
      label: 'Hero image (required)',
      required: true
    }
  ],
  bidStrategies: META_BID_STRATEGIES,
  ageRanges: META_AGE_RANGES,
  genders: META_GENDERS,
  objectives: [{ key: 'SALES', label: 'Sales' }],
  prerequisites: [
    {
      type: 'catalog',
      label: 'Product Catalog',
      description: 'A Meta product catalog with active products is required for Collection ads.',
      required: true
    },
    {
      type: 'pixel',
      label: 'Meta Pixel',
      description: 'Meta Pixel must be installed on your website for catalog retargeting.',
      required: true
    }
  ],
  supportsVideo: true,
  supportsCarousel: false
};

// ---------------------------------------------------------------------------
// Microsoft Advertising (Bing)
// ---------------------------------------------------------------------------

const BING_AGE_RANGES: AgeRange[] = [
  { key: 'EighteenToTwentyFour', label: '18–24', minAge: 18, maxAge: 24 },
  { key: 'TwentyFiveToThirtyFour', label: '25–34', minAge: 25, maxAge: 34 },
  { key: 'ThirtyFiveToFortyNine', label: '35–49', minAge: 35, maxAge: 49 },
  { key: 'FiftyToSixtyFour', label: '50–64', minAge: 50, maxAge: 64 },
  { key: 'SixtyFiveAndAbove', label: '65+', minAge: 65, maxAge: null }
];

const BING_GENDERS: Gender[] = [
  { key: 'Unknown', label: 'All' },
  { key: 'Male', label: 'Male' },
  { key: 'Female', label: 'Female' }
];

const BING_BID_STRATEGIES: BidStrategy[] = [
  {
    key: 'TargetCpa',
    label: 'Target CPA',
    description: 'Automatically set bids to get as many conversions as possible at your target CPA.'
  },
  {
    key: 'TargetRoas',
    label: 'Target ROAS',
    description: 'Automatically optimize bids to achieve your target return on ad spend.'
  },
  {
    key: 'MaximizeConversions',
    label: 'Maximize Conversions',
    description: 'Automatically set bids to get the most conversions within your budget.'
  },
  {
    key: 'MaximizeClicks',
    label: 'Maximize Clicks',
    description: 'Automatically set bids to get the most clicks within your budget.'
  },
  {
    key: 'ManualCpc',
    label: 'Manual CPC',
    description: 'Manually set your maximum cost-per-click bids.'
  },
  {
    key: 'EnhancedCpc',
    label: 'Enhanced CPC',
    description: 'Automatically adjusts manual bids to maximize conversions.'
  }
];

const BING_OBJECTIVES: Objective[] = [
  { key: 'Conversions', label: 'Conversions' },
  { key: 'Visits', label: 'Website Visits' },
  { key: 'BrandAwareness', label: 'Brand Awareness' },
  { key: 'AppInstalls', label: 'App Installs' }
];

export const BING_SEARCH_CONFIG: PlatformAdTypeConfig = {
  platform: 'bing',
  adType: 'bing_search',
  label: 'Microsoft Search',
  description:
    'Text ads appearing on Bing, Yahoo, and Microsoft search results pages.',
  headlines: { maxCount: 15, maxChars: 30 },
  descriptions: { maxCount: 4, maxChars: 90 },
  imageSpecs: [],
  bidStrategies: BING_BID_STRATEGIES,
  ageRanges: BING_AGE_RANGES,
  genders: BING_GENDERS,
  objectives: BING_OBJECTIVES,
  prerequisites: [],
  supportsVideo: false,
  supportsCarousel: false
};

export const BING_DISPLAY_CONFIG: PlatformAdTypeConfig = {
  platform: 'bing',
  adType: 'bing_display',
  label: 'Microsoft Display',
  description: 'Image and rich media ads across the Microsoft Display Network.',
  headlines: { maxCount: 5, maxChars: 30 },
  descriptions: { maxCount: 5, maxChars: 90 },
  imageSpecs: [
    {
      width: 1200,
      height: 628,
      aspectRatio: '1.91:1',
      label: 'Landscape (recommended)',
      required: true
    },
    { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square', required: false }
  ],
  bidStrategies: BING_BID_STRATEGIES,
  ageRanges: BING_AGE_RANGES,
  genders: BING_GENDERS,
  objectives: BING_OBJECTIVES,
  prerequisites: [],
  supportsVideo: false,
  supportsCarousel: false
};

export const BING_AUDIENCE_NETWORK_CONFIG: PlatformAdTypeConfig = {
  platform: 'bing',
  adType: 'audience_network',
  label: 'Microsoft Audience Network',
  description:
    'Native ads served across MSN, Microsoft Edge, and partner sites using audience intelligence.',
  headlines: { maxCount: 15, maxChars: 30 },
  descriptions: { maxCount: 4, maxChars: 90 },
  imageSpecs: [
    {
      width: 1200,
      height: 628,
      aspectRatio: '1.91:1',
      label: 'Landscape',
      required: true
    },
    { width: 1200, height: 1200, aspectRatio: '1:1', label: 'Square', required: false }
  ],
  bidStrategies: BING_BID_STRATEGIES,
  ageRanges: BING_AGE_RANGES,
  genders: BING_GENDERS,
  objectives: BING_OBJECTIVES,
  prerequisites: [],
  supportsVideo: false,
  supportsCarousel: false
};

// ---------------------------------------------------------------------------
// Master config registry
// ---------------------------------------------------------------------------

export const PLATFORM_AD_TYPE_CONFIGS: Record<string, PlatformAdTypeConfig> = {
  'google:search': GOOGLE_SEARCH_CONFIG,
  'google:display': GOOGLE_DISPLAY_CONFIG,
  'google:pmax': GOOGLE_PMAX_CONFIG,
  'google:shopping': GOOGLE_SHOPPING_CONFIG,
  'google:demand_gen': GOOGLE_DEMAND_GEN_CONFIG,
  'meta:feed': META_FEED_CONFIG,
  'meta:stories': META_STORIES_CONFIG,
  'meta:reels': META_REELS_CONFIG,
  'meta:carousel': META_CAROUSEL_CONFIG,
  'meta:collection': META_COLLECTION_CONFIG,
  'bing:bing_search': BING_SEARCH_CONFIG,
  'bing:bing_display': BING_DISPLAY_CONFIG,
  'bing:audience_network': BING_AUDIENCE_NETWORK_CONFIG
};

export function getPlatformAdTypeConfig(
  platform: PlatformKey,
  adType: AdTypeKey
): PlatformAdTypeConfig | undefined {
  return PLATFORM_AD_TYPE_CONFIGS[`${platform}:${adType}`];
}

export function getConfigsForPlatform(platform: PlatformKey): PlatformAdTypeConfig[] {
  return Object.values(PLATFORM_AD_TYPE_CONFIGS).filter((c) => c.platform === platform);
}

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  bing: 'Microsoft Advertising'
};

export const PREREQUISITES: Record<string, Prerequisite[]> = {
  'google:shopping': GOOGLE_SHOPPING_CONFIG.prerequisites,
  'meta:collection': META_COLLECTION_CONFIG.prerequisites,
  'google:pmax': GOOGLE_PMAX_CONFIG.prerequisites
};
