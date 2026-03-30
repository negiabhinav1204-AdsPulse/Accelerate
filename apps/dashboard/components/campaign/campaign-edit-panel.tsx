'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
  ImageIcon,
  LayersIcon,
  LockIcon,
  Minimize2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  SearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import type { AdCreative, AdTypePlan, MediaPlan, PlatformPlan } from './types';

// ── Platform icons ─────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-3.5', className)}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MetaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-3.5', className)}>
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-3.5', className)}>
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function platformLabel(platform: string): string {
  switch (platform) {
    case 'google': return 'Google';
    case 'meta': return 'Meta';
    case 'bing': return 'Microsoft';
    default: return platform;
  }
}

function adTypeLabel(adType: string): string {
  const map: Record<string, string> = {
    search: 'Search', display: 'Display', pmax: 'P Max',
    performance_max: 'P Max', shopping: 'Shopping', demand_gen: 'Demand Gen',
    feed: 'Feed', stories: 'Stories', reels: 'Reels', video: 'Video',
    awareness: 'Awareness', traffic: 'Traffic', engagement: 'Engagement',
    leads: 'Leads', app_promotion: 'App Promo', sales: 'Sales',
    audience: 'Audience',
  };
  return map[adType.toLowerCase()] ?? adType;
}

function AdTypeIconSmall({ type }: { type: string }): React.JSX.Element {
  switch (type.toLowerCase().replace(/[_ ]/g, '')) {
    case 'search': return <SearchIcon className="size-3" />;
    case 'display': return <ImageIcon className="size-3" />;
    case 'pmax': case 'performancemax': return <ZapIcon className="size-3" />;
    case 'shopping': return <ShoppingBagIcon className="size-3" />;
    case 'demandgen': case 'demand_gen': return <SparklesIcon className="size-3" />;
    case 'video': return <RocketIcon className="size-3" />;
    default: return <LayersIcon className="size-3" />;
  }
}

// ── Field definitions per platform + campaign type ─────────────────────────────

type FieldDef = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multi-select' | 'toggle' | 'textarea' | 'keywords' | 'date';
  options?: string[];
  required?: boolean;
  helperText?: string;
  conditionalOn?: { field: string; values: string[] };
};

type FieldGroup = { title: string; fields: FieldDef[] };

const GOOGLE_BID_STRATEGIES_SEARCH: string[] = [
  'Manual CPC', 'Enhanced CPC', 'Target CPA', 'Target ROAS',
  'Maximize Clicks', 'Maximize Conversions', 'Maximize Conversion Value', 'Target Impression Share'
];

const GOOGLE_BID_STRATEGIES_DISPLAY: string[] = [
  'Manual CPC', 'CPM', 'Viewable CPM', 'Target CPA', 'Target ROAS', 'Maximize Clicks'
];

const META_OBJECTIVES: string[] = ['Awareness', 'Traffic', 'Engagement', 'Leads', 'App Promotion', 'Sales'];
const META_BID_STRATEGIES: string[] = ['Lowest Cost', 'Cost Cap', 'Bid Cap', 'Minimum ROAS'];
const META_ATTRIBUTION_WINDOWS: string[] = ['1-day click', '7-day click', '1-day click + 1-day view', '7-day click + 1-day view'];
const AD_SCHEDULES: string[] = ['All day (24/7)', 'Weekdays only', 'Weekends only', 'Custom schedule'];
const DELIVERY_METHODS: string[] = ['Standard', 'Accelerated'];
const KEYWORD_MATCH_TYPES: string[] = ['Broad Match', 'Phrase Match', 'Exact Match'];
const FREQUENCY_CAP_UNITS: string[] = ['Per Day', 'Per Week', 'Per Month'];
const AUDIENCE_TYPES: string[] = ['Saved Audience', 'Custom Audience', 'Lookalike Audience', 'Advantage+ Audience'];
const META_PLACEMENTS: string[] = ['Advantage+ Placements', 'Manual Placements'];
const IMPRESSION_SHARE_LOCATION: string[] = ['Anywhere on results page', 'Top of results page', 'Absolute top of results page'];

const CAMPAIGN_TYPE_FIELDS: Record<string, Record<string, FieldGroup[]>> = {
  search: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true, helperText: 'Average daily spend across the campaign' },
          { id: 'deliveryMethod', label: 'Delivery Method', type: 'select', options: DELIVERY_METHODS },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
          { id: 'adSchedule', label: 'Ad Schedule', type: 'select', options: AD_SCHEDULES },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: GOOGLE_BID_STRATEGIES_SEARCH, required: true },
          { id: 'targetCpa', label: 'Target CPA', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPA'] }, helperText: 'Desired cost per acquisition' },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target ROAS', 'Maximize Conversion Value'] }, helperText: 'e.g. 400 = 4x return' },
          { id: 'maxCpcLimit', label: 'Max CPC Limit', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPA', 'Target ROAS', 'Maximize Clicks'] } },
          { id: 'impressionShareTarget', label: 'Target Impression Share (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target Impression Share'] } },
          { id: 'impressionShareLocation', label: 'Where to Show Ads', type: 'select', options: IMPRESSION_SHARE_LOCATION, conditionalOn: { field: 'bidStrategy', values: ['Target Impression Share'] } },
        ]
      },
      {
        title: 'Networks',
        fields: [
          { id: 'googleSearchNetwork', label: 'Google Search Network', type: 'toggle' },
          { id: 'searchPartners', label: 'Include Search Partners', type: 'toggle', helperText: 'Extends reach to Google search partner sites' },
          { id: 'displayNetworkExp', label: 'Display Network Expansion', type: 'toggle', helperText: 'Show ads on Display Network when search budget not fully used' },
        ]
      },
      {
        title: 'Dynamic Search Ads',
        fields: [
          { id: 'dsaEnabled', label: 'Enable Dynamic Search Ads', type: 'toggle' },
          { id: 'dsaDomain', label: 'Website Domain', type: 'text', conditionalOn: { field: 'dsaEnabled', values: ['true'] } },
          { id: 'dsaTargeting', label: 'DSA Targeting', type: 'select', options: ['All web pages', 'Specific pages', 'Page feeds'], conditionalOn: { field: 'dsaEnabled', values: ['true'] } },
        ]
      }
    ],
    bing: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
          { id: 'adSchedule', label: 'Ad Schedule', type: 'select', options: AD_SCHEDULES },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Manual CPC', 'Enhanced CPC', 'Target CPA', 'Target ROAS', 'Maximize Clicks', 'Maximize Conversions'], required: true },
          { id: 'targetCpa', label: 'Target CPA', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPA'] } },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target ROAS'] } },
        ]
      },
      {
        title: 'Microsoft Audience Network',
        fields: [
          { id: 'audienceNetworkExpansion', label: 'Include Microsoft Audience Network', type: 'toggle', helperText: 'Extend reach to premium sites like MSN, Outlook, LinkedIn' },
          { id: 'linkedinProfile', label: 'LinkedIn Profile Targeting', type: 'toggle', helperText: 'Target by company, job function, or industry' },
          { id: 'linkedinCompany', label: 'Target Companies', type: 'textarea', conditionalOn: { field: 'linkedinProfile', values: ['true'] }, helperText: 'One company per line' },
        ]
      }
    ]
  },
  display: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: GOOGLE_BID_STRATEGIES_DISPLAY, required: true },
          { id: 'targetCpa', label: 'Target CPA', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPA'] } },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target ROAS'] } },
          { id: 'maxCpm', label: 'Max CPM', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['CPM', 'Viewable CPM'] } },
          { id: 'viewableThreshold', label: 'Viewability Threshold', type: 'select', options: ['50% visible', '100% visible'], conditionalOn: { field: 'bidStrategy', values: ['Viewable CPM'] } },
        ]
      },
      {
        title: 'Frequency Capping',
        fields: [
          { id: 'frequencyCapEnabled', label: 'Enable Frequency Cap', type: 'toggle' },
          { id: 'frequencyCapImpressions', label: 'Impressions', type: 'number', conditionalOn: { field: 'frequencyCapEnabled', values: ['true'] } },
          { id: 'frequencyCapUnit', label: 'Per', type: 'select', options: FREQUENCY_CAP_UNITS, conditionalOn: { field: 'frequencyCapEnabled', values: ['true'] } },
        ]
      },
      {
        title: 'Content Exclusions',
        fields: [
          { id: 'excludeContentiousSensitive', label: 'Exclude Sensitive Content', type: 'toggle' },
          { id: 'excludeParked', label: 'Exclude Parked Domains', type: 'toggle' },
        ]
      }
    ]
  },
  pmax: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Maximize Conversions', 'Maximize Conversion Value'], required: true },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Maximize Conversion Value'] }, helperText: 'Optional — leave blank to maximize volume' },
          { id: 'targetCpa', label: 'Target CPA', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Maximize Conversions'] }, helperText: 'Optional — leave blank to maximize volume' },
        ]
      },
      {
        title: 'Asset Group',
        fields: [
          { id: 'assetGroupName', label: 'Asset Group Name', type: 'text', required: true },
          { id: 'finalUrl', label: 'Final URL', type: 'text', required: true },
          { id: 'displayPath1', label: 'Display URL Path 1', type: 'text' },
          { id: 'displayPath2', label: 'Display URL Path 2', type: 'text' },
        ]
      },
      {
        title: 'Audience Signals',
        fields: [
          { id: 'audienceSignals', label: 'Audience Signal Lists', type: 'textarea', helperText: 'One audience list name per line. Helps PMax learn faster.' },
          { id: 'searchThemes', label: 'Search Themes', type: 'textarea', helperText: 'Up to 25 search themes to guide AI optimization. One per line.' },
        ]
      }
    ]
  },
  shopping: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'merchantCenterId', label: 'Merchant Center ID', type: 'text', required: true },
          { id: 'countryOfSale', label: 'Country of Sale', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'campaignPriority', label: 'Campaign Priority', type: 'select', options: ['Low', 'Medium', 'High'], helperText: 'When multiple shopping campaigns match a query, highest priority wins' },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Manual CPC', 'Enhanced CPC', 'Target ROAS', 'Maximize Clicks', 'Maximize Conversion Value'], required: true },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target ROAS', 'Maximize Conversion Value'] } },
        ]
      },
      {
        title: 'Products',
        fields: [
          { id: 'productFilter', label: 'Product Filter (Custom Label)', type: 'text', helperText: 'Filter by custom label, brand, category, or condition' },
          { id: 'enableLocalInventory', label: 'Enable Local Inventory Ads', type: 'toggle' },
        ]
      }
    ],
    bing: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'merchantCenterId', label: 'Microsoft Merchant Center Store', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'salesCountry', label: 'Sales Country', type: 'text', required: true },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Manual CPC', 'Enhanced CPC', 'Target ROAS', 'Maximize Clicks'], required: true },
        ]
      }
    ]
  },
  demand_gen: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Maximize Conversions', 'Target CPA', 'Target ROAS', 'Maximize Clicks'], required: true },
          { id: 'targetCpa', label: 'Target CPA', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPA'] } },
          { id: 'targetRoas', label: 'Target ROAS (%)', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target ROAS'] } },
        ]
      },
      {
        title: 'Creative Settings',
        fields: [
          { id: 'creativeMix', label: 'Creative Mix', type: 'select', options: ['Optimized', 'Even rotation'], helperText: 'Optimized lets Google choose best performing creative' },
          { id: 'frequencyGoal', label: 'Frequency Goal (impressions/week)', type: 'number', helperText: 'Recommended: 3–5 for awareness' },
        ]
      }
    ]
  },
  video: {
    google: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'campaignSubtype', label: 'Video Ad Subtype', type: 'select', options: ['Drive Conversions', 'Drive Views & Engagement', 'Influence Consideration', 'Build Awareness & Reach'], required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Target CPV', 'Target CPA', 'Target ROAS', 'Maximize Conversions', 'CPM'], required: true },
          { id: 'targetCpv', label: 'Target CPV', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Target CPV'] }, helperText: 'Cost per view target' },
        ]
      },
      {
        title: 'Ad Formats',
        fields: [
          { id: 'skippableInstream', label: 'Skippable In-stream', type: 'toggle' },
          { id: 'nonSkippableInstream', label: 'Non-skippable In-stream (15s)', type: 'toggle' },
          { id: 'bumpersAds', label: 'Bumper Ads (6s)', type: 'toggle' },
          { id: 'inFeedVideo', label: 'In-feed Video Ads', type: 'toggle' },
        ]
      }
    ]
  },
  feed: {
    meta: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'objective', label: 'Campaign Objective', type: 'select', options: META_OBJECTIVES, required: true },
          { id: 'buyingType', label: 'Buying Type', type: 'select', options: ['Auction', 'Reach & Frequency'] },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number' },
          { id: 'lifetimeBudget', label: 'Lifetime Budget', type: 'number', helperText: 'Use lifetime OR daily budget, not both' },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
          { id: 'attributionWindow', label: 'Attribution Window', type: 'select', options: META_ATTRIBUTION_WINDOWS },
          { id: 'pixelId', label: 'Meta Pixel ID', type: 'text', helperText: 'Required for conversion tracking' },
        ]
      },
      {
        title: 'Bidding & Optimization',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: META_BID_STRATEGIES, required: true },
          { id: 'bidCap', label: 'Bid Cap', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Bid Cap'] } },
          { id: 'costCap', label: 'Cost Cap', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Cost Cap'] } },
          { id: 'minimumRoas', label: 'Minimum ROAS', type: 'number', conditionalOn: { field: 'bidStrategy', values: ['Minimum ROAS'] } },
        ]
      },
      {
        title: 'Audience',
        fields: [
          { id: 'audienceType', label: 'Audience Type', type: 'select', options: AUDIENCE_TYPES },
          { id: 'customAudienceList', label: 'Custom Audience Names', type: 'textarea', conditionalOn: { field: 'audienceType', values: ['Custom Audience', 'Lookalike Audience'] }, helperText: 'One audience name per line' },
          { id: 'lookalikeSeedSize', label: 'Lookalike Audience Size (%)', type: 'number', conditionalOn: { field: 'audienceType', values: ['Lookalike Audience'] }, helperText: '1–10% of country population' },
          { id: 'interestTargeting', label: 'Interest Targeting', type: 'textarea', helperText: 'One interest per line (e.g. "Online shopping", "Fashion")' },
        ]
      },
      {
        title: 'Placements',
        fields: [
          { id: 'placements', label: 'Placement Strategy', type: 'select', options: META_PLACEMENTS },
          { id: 'facebookFeed', label: 'Facebook Feed', type: 'toggle', conditionalOn: { field: 'placements', values: ['Manual Placements'] } },
          { id: 'instagramFeed', label: 'Instagram Feed', type: 'toggle', conditionalOn: { field: 'placements', values: ['Manual Placements'] } },
          { id: 'facebookRightColumn', label: 'Facebook Right Column', type: 'toggle', conditionalOn: { field: 'placements', values: ['Manual Placements'] } },
          { id: 'audienceNetwork', label: 'Meta Audience Network', type: 'toggle', conditionalOn: { field: 'placements', values: ['Manual Placements'] } },
          { id: 'messengerInbox', label: 'Messenger Inbox', type: 'toggle', conditionalOn: { field: 'placements', values: ['Manual Placements'] } },
        ]
      }
    ]
  },
  stories: {
    meta: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'objective', label: 'Campaign Objective', type: 'select', options: META_OBJECTIVES, required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number' },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
        ]
      },
      {
        title: 'Bidding & Optimization',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: META_BID_STRATEGIES },
          { id: 'attributionWindow', label: 'Attribution Window', type: 'select', options: META_ATTRIBUTION_WINDOWS },
        ]
      },
      {
        title: 'Creative Requirements (9:16 vertical)',
        fields: [
          { id: 'safeZoneEnabled', label: 'Enable Safe Zone Overlay', type: 'toggle', helperText: 'Keep key content within the middle 80% to avoid UI overlap' },
          { id: 'storyDuration', label: 'Story Duration (seconds)', type: 'number', helperText: 'Max 15s for Stories. Reels: 15–60s' },
          { id: 'addCta', label: 'CTA Type', type: 'select', options: ['Swipe Up', 'Learn More', 'Shop Now', 'Sign Up', 'Install Now', 'Book Now'] },
        ]
      }
    ]
  },
  reels: {
    meta: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'objective', label: 'Campaign Objective', type: 'select', options: META_OBJECTIVES, required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number' },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: META_BID_STRATEGIES },
          { id: 'attributionWindow', label: 'Attribution Window', type: 'select', options: META_ATTRIBUTION_WINDOWS },
        ]
      }
    ]
  },
  audience: {
    bing: [
      {
        title: 'Campaign Settings',
        fields: [
          { id: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
          { id: 'dailyBudget', label: 'Daily Budget', type: 'number', required: true },
          { id: 'startDate', label: 'Start Date', type: 'date', required: true },
          { id: 'endDate', label: 'End Date', type: 'date' },
        ]
      },
      {
        title: 'Bidding',
        fields: [
          { id: 'bidStrategy', label: 'Bid Strategy', type: 'select', options: ['Manual CPC', 'CPM', 'Target CPA', 'Maximize Clicks'], required: true },
        ]
      },
      {
        title: 'LinkedIn Professional Targeting',
        fields: [
          { id: 'linkedinEnabled', label: 'Enable LinkedIn Profile Targeting', type: 'toggle' },
          { id: 'companyName', label: 'Target Companies', type: 'textarea', conditionalOn: { field: 'linkedinEnabled', values: ['true'] } },
          { id: 'jobFunction', label: 'Job Functions', type: 'textarea', conditionalOn: { field: 'linkedinEnabled', values: ['true'] } },
          { id: 'industry', label: 'Industries', type: 'textarea', conditionalOn: { field: 'linkedinEnabled', values: ['true'] } },
        ]
      }
    ]
  }
};

// Ad Group targeting fields (shared across platforms)
const AD_GROUP_TARGETING_FIELDS: FieldGroup[] = [
  {
    title: 'Location Targeting',
    fields: [
      { id: 'locations', label: 'Target Locations', type: 'textarea', helperText: 'One location per line (city, state, country, or postal code)' },
      { id: 'locationMatchType', label: 'Location Match', type: 'select', options: ['People in or interested in', 'People in', 'People searching for'] },
      { id: 'excludeLocations', label: 'Excluded Locations', type: 'textarea', helperText: 'Exclude specific locations' },
      { id: 'locationRadius', label: 'Radius Targeting (km)', type: 'number', helperText: 'Target users within X km of a location' },
    ]
  },
  {
    title: 'Demographics',
    fields: [
      { id: 'ageRange', label: 'Age Range', type: 'multi-select', options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Unknown'] },
      { id: 'gender', label: 'Gender', type: 'select', options: ['All genders', 'Women', 'Men'] },
      { id: 'householdIncome', label: 'Household Income', type: 'multi-select', options: ['Top 10%', '11-20%', '21-30%', '31-40%', '41-50%', 'Lower 50%', 'Unknown'] },
      { id: 'parentalStatus', label: 'Parental Status', type: 'select', options: ['All', 'Parents only', 'Non-parents only'] },
    ]
  },
  {
    title: 'Device Targeting',
    fields: [
      { id: 'devices', label: 'Devices', type: 'multi-select', options: ['All Devices', 'Computers', 'Mobile phones', 'Tablets', 'TV screens'] },
      { id: 'mobileOsTargeting', label: 'Mobile OS', type: 'select', options: ['All', 'Android only', 'iOS only'] },
      { id: 'mobileCarrierTargeting', label: 'Mobile Carrier', type: 'text', helperText: 'Target specific mobile carriers (optional)' },
    ]
  },
  {
    title: 'Language',
    fields: [
      { id: 'languages', label: 'Target Languages', type: 'textarea', helperText: 'One language per line (e.g. English, Hindi)' },
    ]
  },
  {
    title: 'Keywords (Search only)',
    fields: [
      { id: 'keywords', label: 'Target Keywords', type: 'keywords', helperText: 'Add keywords with match type. Use +broad, "phrase", or [exact]' },
      { id: 'negativeKeywords', label: 'Negative Keywords', type: 'textarea', helperText: 'One per line. Prevents ads on irrelevant searches.' },
    ]
  }
];

// ── Tree node types ────────────────────────────────────────────────────────────

type NodePath = {
  platformIdx: number;
  adTypeIdx?: number;
  adGroupIdx?: number;
  adIdx?: number;
};

function pathKey(p: NodePath): string {
  return [p.platformIdx, p.adTypeIdx, p.adGroupIdx, p.adIdx]
    .filter((v) => v !== undefined)
    .join('-');
}

function pathsEqual(a: NodePath, b: NodePath): boolean {
  return a.platformIdx === b.platformIdx
    && a.adTypeIdx === b.adTypeIdx
    && a.adGroupIdx === b.adGroupIdx
    && a.adIdx === b.adIdx;
}

// ── Props & types ──────────────────────────────────────────────────────────────

type TreeMenuState =
  | { type: 'platform'; idx: number }
  | { type: 'adType'; platformIdx: number; adTypeIdx: number }
  | { type: 'ad'; platformIdx: number; adTypeIdx: number; adIdx: number }
  | null;

type CampaignEditPanelProps = {
  mediaPlan: MediaPlan;
  onSave: (updated: MediaPlan) => void;
  onClose: () => void;
  initialScope?: { platformIdx?: number; adTypeIdx?: number };
};

// ── Main component ─────────────────────────────────────────────────────────────

export function CampaignEditPanel({
  mediaPlan,
  onSave,
  onClose,
  initialScope
}: CampaignEditPanelProps): React.JSX.Element {
  const [localPlan, setLocalPlan] = React.useState<MediaPlan>(mediaPlan);
  const [history, setHistory] = React.useState<MediaPlan[]>([]);
  const [activeTab, setActiveTab] = React.useState<'targeting' | 'creatives'>('targeting');
  const [budgetMode, setBudgetMode] = React.useState<'dollar' | 'percent'>('dollar');
  const [budgetStrategy, setBudgetStrategy] = React.useState<'balanced' | 'performance' | 'equal'>('balanced');
  const [openTreeMenu, setOpenTreeMenu] = React.useState<TreeMenuState>(null);

  const [selectedPath, setSelectedPath] = React.useState<NodePath>(() => ({
    platformIdx: initialScope?.platformIdx ?? 0,
    adTypeIdx: initialScope?.adTypeIdx ?? 0,
  }));

  // Reset to Targeting tab when the selected ad type changes
  React.useEffect(() => {
    setActiveTab('targeting');
  }, [selectedPath.platformIdx, selectedPath.adTypeIdx]);

  // History-aware plan updater
  const updatePlan = React.useCallback((updater: (prev: MediaPlan) => MediaPlan) => {
    setLocalPlan((prev) => {
      setHistory((h) => [...h.slice(-19), prev]);
      return updater(prev);
    });
  }, []);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setLocalPlan(prev);
  };

  const handleReset = () => {
    setLocalPlan(mediaPlan);
    setHistory([]);
  };

  const handleDeletePlatform = (platformIdx: number) => {
    updatePlan((prev) => ({
      ...prev,
      platforms: prev.platforms.filter((_, i) => i !== platformIdx)
    }));
    setSelectedPath({ platformIdx: 0, adTypeIdx: 0 });
  };

  const handleDeleteAdType = (platformIdx: number, adTypeIdx: number) => {
    updatePlan((prev) => ({
      ...prev,
      platforms: prev.platforms.map((p, pi) =>
        pi !== platformIdx ? p : { ...p, adTypes: p.adTypes.filter((_, ai) => ai !== adTypeIdx) }
      )
    }));
    setSelectedPath({ platformIdx, adTypeIdx: 0 });
  };

  const handleDeleteAd = (platformIdx: number, adTypeIdx: number, adIdx: number) => {
    updatePlan((prev) => ({
      ...prev,
      platforms: prev.platforms.map((p, pi) =>
        pi !== platformIdx ? p : {
          ...p,
          adTypes: p.adTypes.map((at, ai) =>
            ai !== adTypeIdx ? at : { ...at, ads: at.ads.filter((_, i) => i !== adIdx) }
          )
        }
      )
    }));
    setSelectedPath({ platformIdx, adTypeIdx });
  };

  const handleUpdateAd = (platformIdx: number, adTypeIdx: number, adIdx: number, updated: Partial<AdCreative>) => {
    updatePlan((prev) => ({
      ...prev,
      platforms: prev.platforms.map((p, pi) =>
        pi !== platformIdx ? p : {
          ...p,
          adTypes: p.adTypes.map((at, ai) =>
            ai !== adTypeIdx ? at : {
              ...at,
              ads: at.ads.map((ad, i) => i === adIdx ? { ...ad, ...updated } : ad)
            }
          )
        }
      )
    }));
  };

  const handleAddAd = (platformIdx: number, adTypeIdx: number) => {
    const newAd: AdCreative = {
      id: crypto.randomUUID(),
      headlines: ['Your headline here'],
      descriptions: ['Your description here'],
      imageUrls: [],
      ctaText: 'Learn More',
      destinationUrl: localPlan.platforms[platformIdx]?.adTypes[adTypeIdx]?.ads[0]?.destinationUrl ?? '',
    };
    updatePlan((prev) => ({
      ...prev,
      platforms: prev.platforms.map((p, pi) =>
        pi !== platformIdx ? p : {
          ...p,
          adTypes: p.adTypes.map((at, ai) =>
            ai !== adTypeIdx ? at : { ...at, ads: [...at.ads, newAd] }
          )
        }
      )
    }));
  };

  const selectedPlatform = localPlan.platforms[selectedPath.platformIdx];
  const selectedAdType = selectedPath.adTypeIdx !== undefined
    ? selectedPlatform?.adTypes[selectedPath.adTypeIdx]
    : undefined;
  const selectedAd = selectedPath.adIdx !== undefined && selectedAdType
    ? selectedAdType.ads[selectedPath.adIdx]
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col bg-background rounded-2xl shadow-2xl border-2 border-dashed border-blue-400 w-full max-w-5xl overflow-hidden"
        style={{ height: '90vh' }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Campaign Preview - Editing</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Minimize"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Minimize2Icon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Platform nav row */}
        <div className="shrink-0 px-4 py-2 border-b border-border/50 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {localPlan.platforms.map((platform, platformIdx) => {
              const isSelected = selectedPath.platformIdx === platformIdx;
              return (
                <div key={`${platform.platform}-${platformIdx}`} className="relative group/platform flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPath({ platformIdx, adTypeIdx: 0 })}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                      isSelected
                        ? 'bg-blue-50 text-blue-600 border-blue-300'
                        : 'bg-background text-foreground border-border hover:border-blue-200 hover:bg-blue-50/40'
                    )}
                  >
                    {platform.platform === 'google' && <GoogleIcon />}
                    {platform.platform === 'meta' && <MetaIcon />}
                    {platform.platform === 'bing' && <MicrosoftIcon />}
                    {platformLabel(platform.platform)}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenTreeMenu(openTreeMenu?.type === 'platform' && openTreeMenu.idx === platformIdx ? null : { type: 'platform', idx: platformIdx }); }}
                      className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/platform:opacity-100 hover:text-foreground transition-all"
                    >
                      <MoreHorizontalIcon className="size-3" />
                    </button>
                    {openTreeMenu?.type === 'platform' && openTreeMenu.idx === platformIdx && (
                      <TreeContextMenu
                        onEdit={() => { setSelectedPath({ platformIdx, adTypeIdx: 0 }); setOpenTreeMenu(null); }}
                        onDelete={() => { handleDeletePlatform(platformIdx); setOpenTreeMenu(null); }}
                        onClose={() => setOpenTreeMenu(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AdType nav row */}
        {selectedPlatform && (
          <div className="shrink-0 px-4 py-1.5 border-b border-border/50 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {selectedPlatform.adTypes.map((adType, adTypeIdx) => {
                const isSelected = selectedPath.adTypeIdx === adTypeIdx;
                return (
                  <div key={`${adType.adType}-${adTypeIdx}`} className="relative group/adtype flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPath({ platformIdx: selectedPath.platformIdx, adTypeIdx })}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                        isSelected
                          ? 'bg-blue-50 text-blue-600 border-blue-300'
                          : 'bg-background text-foreground border-border hover:border-blue-200 hover:bg-blue-50/40'
                      )}
                    >
                      <AdTypeIconSmall type={adType.adType} />
                      {adTypeLabel(adType.adType)}
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenTreeMenu(openTreeMenu?.type === 'adType' && openTreeMenu.platformIdx === selectedPath.platformIdx && openTreeMenu.adTypeIdx === adTypeIdx ? null : { type: 'adType', platformIdx: selectedPath.platformIdx, adTypeIdx }); }}
                        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/adtype:opacity-100 hover:text-foreground transition-all"
                      >
                        <MoreHorizontalIcon className="size-3" />
                      </button>
                      {openTreeMenu?.type === 'adType' && openTreeMenu.platformIdx === selectedPath.platformIdx && openTreeMenu.adTypeIdx === adTypeIdx && (
                        <TreeContextMenu
                          onEdit={() => { setSelectedPath({ platformIdx: selectedPath.platformIdx, adTypeIdx }); setOpenTreeMenu(null); }}
                          onDelete={() => { handleDeleteAdType(selectedPath.platformIdx, adTypeIdx); setOpenTreeMenu(null); }}
                          onClose={() => setOpenTreeMenu(null)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ads nav row */}
        {selectedAdType && selectedPath.adTypeIdx !== undefined && (
          <div className="shrink-0 px-4 py-1.5 border-b border-border/50 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setSelectedPath({ platformIdx: selectedPath.platformIdx, adTypeIdx: selectedPath.adTypeIdx }); setActiveTab('targeting'); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border shrink-0',
                  selectedPath.adIdx === undefined
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'bg-background text-foreground border-border hover:border-blue-200 hover:bg-blue-50/40'
                )}
              >
                <LayersIcon className="size-3" />
                Ad group 1
              </button>
              {selectedAdType.ads.map((ad, adIdx) => {
                const isAdSelected = selectedPath.adIdx === adIdx;
                return (
                  <div key={ad.id ?? adIdx} className="relative group/ad flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => { setSelectedPath({ platformIdx: selectedPath.platformIdx, adTypeIdx: selectedPath.adTypeIdx!, adGroupIdx: 0, adIdx }); setActiveTab('creatives'); }}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                        isAdSelected
                          ? 'bg-blue-50 text-blue-600 border-blue-300'
                          : 'bg-background text-foreground border-border hover:border-blue-200 hover:bg-blue-50/40'
                      )}
                    >
                      {ad.imageUrls[0]
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={ad.imageUrls[0]} alt="" className="size-3.5 rounded object-cover shrink-0" />
                        : <ImageIcon className="size-3 shrink-0" />}
                      Ad {adIdx + 1}
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenTreeMenu({ type: 'ad', platformIdx: selectedPath.platformIdx, adTypeIdx: selectedPath.adTypeIdx!, adIdx }); }}
                        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/ad:opacity-100 hover:text-foreground transition-all"
                      >
                        <MoreHorizontalIcon className="size-3" />
                      </button>
                      {openTreeMenu?.type === 'ad' && openTreeMenu.platformIdx === selectedPath.platformIdx && openTreeMenu.adTypeIdx === selectedPath.adTypeIdx && openTreeMenu.adIdx === adIdx && (
                        <TreeContextMenu
                          onEdit={() => { setSelectedPath({ platformIdx: selectedPath.platformIdx, adTypeIdx: selectedPath.adTypeIdx!, adGroupIdx: 0, adIdx }); setOpenTreeMenu(null); setActiveTab('creatives'); }}
                          onDelete={() => { handleDeleteAd(selectedPath.platformIdx, selectedPath.adTypeIdx!, adIdx); setOpenTreeMenu(null); }}
                          onClose={() => setOpenTreeMenu(null)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => handleAddAd(selectedPath.platformIdx, selectedPath.adTypeIdx!)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-dashed border-border shrink-0"
              >
                <PlusIcon className="size-3" />
                Add Ad
              </button>
            </div>
          </div>
        )}

        {/* Tab bar — Targeting | Creatives */}
        {selectedAdType && (
          <div className="shrink-0 flex items-center px-5 border-b border-border bg-muted/10">
            {(['targeting', 'creatives'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'py-2.5 mr-7 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'creatives' ? `Creatives (${selectedAdType.ads.length})` : 'Targeting'}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {!selectedAdType ? (
            <PlatformContent
              platform={selectedPlatform!}
              currency={localPlan.currency}
              onBudgetChange={(budget) => {
                updatePlan((prev) => ({
                  ...prev,
                  platforms: prev.platforms.map((p, pi) =>
                    pi !== selectedPath.platformIdx ? p : { ...p, budget }
                  )
                }));
              }}
            />
          ) : activeTab === 'targeting' ? (
            <TargetingTabContent
              mediaPlan={localPlan}
              selectedAdType={selectedAdType}
              budgetMode={budgetMode}
              budgetStrategy={budgetStrategy}
              onBudgetModeChange={setBudgetMode}
              onStrategyChange={setBudgetStrategy}
              onPlatformBudgetChange={(platformIdx, budget) => {
                updatePlan((prev) => ({
                  ...prev,
                  platforms: prev.platforms.map((p, pi) =>
                    pi !== platformIdx ? p : { ...p, budget }
                  )
                }));
              }}
              onTargetingChange={(t) => {
                updatePlan((prev) => ({
                  ...prev,
                  platforms: prev.platforms.map((p, pi) =>
                    pi !== selectedPath.platformIdx ? p : {
                      ...p,
                      adTypes: p.adTypes.map((at, ai) =>
                        ai !== selectedPath.adTypeIdx ? at : { ...at, targeting: { ...at.targeting, ...t } }
                      )
                    }
                  )
                }));
              }}
            />
          ) : selectedAd && selectedPath.adIdx !== undefined ? (
            <AdEditor
              ad={selectedAd}
              adType={selectedAdType.adType}
              platform={selectedPlatform?.platform ?? 'google'}
              adIdx={selectedPath.adIdx}
              onUpdate={(updated) =>
                handleUpdateAd(selectedPath.platformIdx, selectedPath.adTypeIdx!, selectedPath.adIdx!, updated)
              }
            />
          ) : (
            <CreativesGridContent
              adType={selectedAdType}
              platform={selectedPlatform?.platform ?? 'google'}
              onSelectAd={(adIdx) => setSelectedPath({
                platformIdx: selectedPath.platformIdx,
                adTypeIdx: selectedPath.adTypeIdx!,
                adGroupIdx: 0,
                adIdx
              })}
            />
          )}
        </main>

        {/* Bottom action bar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={() => { onSave(localPlan); onClose(); }}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tree context menu ──────────────────────────────────────────────────────────

function TreeContextMenu({
  onEdit,
  onDelete,
  onClose
}: {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-40 mt-0.5 min-w-[110px] rounded-lg border border-border bg-popover py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent"
      >
        <PencilIcon className="size-3 text-muted-foreground" />
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
      >
        <Trash2Icon className="size-3" />
        Delete
      </button>
    </div>
  );
}

// ── Targeting tab content ──────────────────────────────────────────────────────

function TargetingTabContent({
  mediaPlan,
  selectedAdType,
  budgetMode,
  budgetStrategy,
  onBudgetModeChange,
  onStrategyChange,
  onPlatformBudgetChange,
  onTargetingChange
}: {
  mediaPlan: MediaPlan;
  selectedAdType: AdTypePlan;
  budgetMode: 'dollar' | 'percent';
  budgetStrategy: 'balanced' | 'performance' | 'equal';
  onBudgetModeChange: (m: 'dollar' | 'percent') => void;
  onStrategyChange: (s: 'balanced' | 'performance' | 'equal') => void;
  onPlatformBudgetChange: (platformIdx: number, budget: number) => void;
  onTargetingChange: (t: Partial<AdTypePlan['targeting']>) => void;
}): React.JSX.Element {
  const targeting = selectedAdType.targeting;
  const totalBudget = mediaPlan.platforms.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  const [locationSearch, setLocationSearch] = React.useState('');

  const locationStrings: string[] = (targeting.locations as unknown[]).map((loc) => {
    if (typeof loc === 'string') return loc;
    const l = loc as { raw?: string; city?: string; country?: string };
    return l.raw ?? l.city ?? l.country ?? '';
  }).filter(Boolean);

  const currencySymbol = mediaPlan.currency === 'INR' ? '₹'
    : mediaPlan.currency === 'GBP' ? '£'
    : mediaPlan.currency === 'EUR' ? '€' : '$';

  return (
    <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
      <p className="text-sm font-medium text-foreground">Basic targeting details</p>

      {/* Budget Allocation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Budget Allocation</span>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => onBudgetModeChange('dollar')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                budgetMode === 'dollar' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent'
              )}
            >$</button>
            <button
              type="button"
              onClick={() => onBudgetModeChange('percent')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                budgetMode === 'percent' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent'
              )}
            >%</button>
          </div>
        </div>

        {/* Strategy presets */}
        <div className="flex items-center gap-2">
          {(['balanced', 'performance', 'equal'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStrategyChange(s)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                budgetStrategy === s
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-background border-border text-foreground hover:border-blue-200 hover:bg-blue-50/40'
              )}
            >
              {s === 'performance' && <span>↗</span>}
              {s === 'balanced' ? 'Balanced' : s === 'performance' ? 'Performance' : 'Equal Split'}
            </button>
          ))}
        </div>

        {/* Per-platform budget rows */}
        <div className="space-y-2">
          {mediaPlan.platforms.map((platform, platformIdx) => {
            const pct = platform.budgetPercent ?? (totalBudget > 0 ? Math.round((platform.budget / totalBudget) * 100) : 0);
            return (
              <div key={platform.platform} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {platform.platform === 'google' && <GoogleIcon />}
                    {platform.platform === 'meta' && <MetaIcon />}
                    {platform.platform === 'bing' && <MicrosoftIcon />}
                    <span className="text-sm font-medium text-foreground">{platformLabel(platform.platform)} Ads</span>
                    <LockIcon className="size-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{pct}%</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                  <input
                    type="number"
                    min={0}
                    value={platform.budget ?? 0}
                    onChange={(e) => onPlatformBudgetChange(platformIdx, Number(e.target.value))}
                    className="flex-1 text-sm bg-transparent outline-none text-foreground"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Allocation */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background">
          <span className="text-sm font-medium text-foreground">Total Allocation</span>
          <span className="text-sm font-semibold text-green-600">100%</span>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location</span>
        <div className="relative flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            placeholder="Search city, region, or country"
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </div>
        {locationStrings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {locationStrings.map((loc) => (
              <span key={loc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                {loc}
                <button
                  type="button"
                  onClick={() => onTargetingChange({ locations: locationStrings.filter((l) => l !== loc) })}
                  className="hover:text-blue-900 ml-0.5"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Demographics */}
      {(targeting.ageRange ?? targeting.gender) && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Demographics</span>
          <div className="grid grid-cols-2 gap-3">
            {targeting.ageRange && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Age Range</label>
                <input
                  type="text"
                  defaultValue={targeting.ageRange}
                  className="field-input"
                  onChange={(e) => onTargetingChange({ ageRange: e.target.value })}
                />
              </div>
            )}
            {targeting.gender && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Gender</label>
                <select
                  defaultValue={targeting.gender}
                  className="field-input"
                  onChange={(e) => onTargetingChange({ gender: e.target.value })}
                >
                  {['All genders', 'Women', 'Men'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creatives grid (Creatives tab, no ad selected) ─────────────────────────────

function CreativesGridContent({
  adType,
  platform,
  onSelectAd
}: {
  adType: AdTypePlan;
  platform: string;
  onSelectAd: (adIdx: number) => void;
}): React.JSX.Element {
  const isSearch = adType.adType.toLowerCase().includes('search');
  const isStories = adType.adType.toLowerCase().includes('stories') || adType.adType.toLowerCase().includes('reels');
  const imageAspect = isStories ? '9/16' : platform === 'meta' ? '1/1' : '16/9';

  return (
    <div className="max-w-3xl mx-auto px-5 py-5">
      <div className={cn('grid gap-4', isSearch ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
        {adType.ads.map((ad, adIdx) => (
          <button
            key={ad.id ?? adIdx}
            type="button"
            onClick={() => onSelectAd(adIdx)}
            className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
          >
            {!isSearch && (
              <div className="relative bg-muted overflow-hidden" style={{ aspectRatio: imageAspect }}>
                {ad.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.imageUrls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="size-8 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            )}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-foreground line-clamp-1">{ad.headlines[0] ?? `Ad ${adIdx + 1}`}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{ad.descriptions[0] ?? ''}</p>
              <div className="pt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-medium border border-blue-100">
                  {ad.ctaText ?? 'Learn More'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Platform-level content ─────────────────────────────────────────────────────

function PlatformContent({
  platform,
  currency,
  onBudgetChange
}: {
  platform: PlatformPlan;
  currency: string;
  onBudgetChange: (budget: number) => void;
}): React.JSX.Element {
  const [budget, setBudget] = React.useState(platform.budget);

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{platformLabel(platform.platform)} Overview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{platform.adTypes.length} campaign type{platform.adTypes.length !== 1 ? 's' : ''}</p>
      </div>

      <ContentSection title="Platform Budget">
        <div className="space-y-3">
          <FieldRow label="Total Budget" required>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currency}</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                onBlur={() => onBudgetChange(budget)}
                className="field-input w-32"
              />
            </div>
          </FieldRow>
          <div className="text-xs text-muted-foreground">
            {platform.budgetPercent}% of total campaign budget
          </div>
        </div>
      </ContentSection>

      <ContentSection title="Budget Distribution">
        <div className="space-y-2">
          {platform.adTypes.map((at, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 bg-card">
              <div className="flex items-center gap-2">
                <AdTypeIconSmall type={at.adType} />
                <span className="text-xs font-medium text-foreground">{adTypeLabel(at.adType)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{at.budgetPercent ?? 0}%</span>
                <span className="text-xs font-medium text-foreground">{currency} {at.budget ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      </ContentSection>
    </div>
  );
}

// ── Campaign type-level content ────────────────────────────────────────────────

function CampaignTypeContent({
  adType,
  platform,
  adTypePlan,
  onUpdate
}: {
  adType: string;
  platform: string;
  adTypePlan: AdTypePlan;
  onUpdate: (updated: Partial<AdTypePlan>) => void;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<'settings' | 'targeting'>('settings');
  const [fieldValues, setFieldValues] = React.useState<Record<string, unknown>>({});

  const normalizedType = adType.toLowerCase();
  const fieldGroups = CAMPAIGN_TYPE_FIELDS[normalizedType]?.[platform] ?? [];

  const setValue = (id: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="shrink-0 flex items-center gap-4 px-6 border-b border-border">
        {(['settings', 'targeting'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'py-3 text-xs font-medium border-b-2 -mb-px capitalize transition-colors',
              activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {activeTab === 'settings' && (
            fieldGroups.length > 0 ? (
              fieldGroups.map((group) => (
                <ContentSection key={group.title} title={group.title}>
                  <div className="space-y-3">
                    {group.fields.map((field) => {
                      const isVisible = !field.conditionalOn || (() => {
                        const depVal = String(fieldValues[field.conditionalOn.field] ?? '');
                        return field.conditionalOn.values.includes(depVal);
                      })();
                      if (!isVisible) return null;
                      return (
                        <FieldRenderer
                          key={field.id}
                          field={field}
                          value={fieldValues[field.id] ?? ''}
                          onChange={(v) => setValue(field.id, v)}
                        />
                      );
                    })}
                  </div>
                </ContentSection>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <SparklesIcon className="size-8 mx-auto mb-2 opacity-40" />
                <p>No specific settings for {adTypeLabel(adType)} on {platformLabel(platform)}</p>
                <p className="text-xs mt-1">Targeting options are available in the Targeting tab.</p>
              </div>
            )
          )}

          {activeTab === 'targeting' && (
            <AdGroupTargetingForm
              targeting={adTypePlan.targeting}
              onUpdate={(t) => onUpdate({ targeting: { ...adTypePlan.targeting, ...t } })}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 px-6 py-3 border-t border-border flex justify-end gap-2">
        <Button size="sm" className="text-xs" onClick={() => onUpdate({})}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ── Ad Group targeting content ─────────────────────────────────────────────────

function AdGroupTargetingContent(): React.JSX.Element {
  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ad Group 1 — Targeting</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Configure targeting for this ad group</p>
      </div>
      {AD_GROUP_TARGETING_FIELDS.map((group) => (
        <ContentSection key={group.title} title={group.title}>
          <div className="space-y-3">
            {group.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value=""
                onChange={() => {}}
              />
            ))}
          </div>
        </ContentSection>
      ))}
    </div>
  );
}

function AdGroupTargetingForm({
  targeting,
  onUpdate
}: {
  targeting: AdTypePlan['targeting'];
  onUpdate: (t: Partial<AdTypePlan['targeting']>) => void;
}): React.JSX.Element {
  const locationStrings = (targeting.locations as unknown[]).map((loc) => {
    if (typeof loc === 'string') return loc;
    const l = loc as { raw?: string; city?: string; country?: string };
    return l.raw || l.city || l.country || '';
  }).filter(Boolean).join('\n');

  return (
    <div className="space-y-6">
      <ContentSection title="Location Targeting">
        <FieldRow label="Target Locations">
          <textarea
            defaultValue={locationStrings}
            rows={3}
            className="field-input"
            placeholder="One location per line"
          />
        </FieldRow>
      </ContentSection>
      <ContentSection title="Demographics">
        <FieldRow label="Age Range">
          <input type="text" defaultValue={targeting.ageRange} className="field-input" />
        </FieldRow>
        <FieldRow label="Gender">
          <select defaultValue={targeting.gender} className="field-input">
            {['All genders', 'Women', 'Men'].map((g) => <option key={g}>{g}</option>)}
          </select>
        </FieldRow>
      </ContentSection>
      <ContentSection title="Language">
        <FieldRow label="Languages">
          <textarea defaultValue={targeting.languages.join('\n')} rows={2} className="field-input" />
        </FieldRow>
      </ContentSection>
      {targeting.keywords && targeting.keywords.length > 0 && (
        <ContentSection title="Keywords">
          <FieldRow label="Target Keywords">
            <textarea defaultValue={targeting.keywords.join('\n')} rows={4} className="field-input" />
          </FieldRow>
        </ContentSection>
      )}
      <div className="flex justify-end">
        <Button size="sm" className="text-xs" onClick={() => onUpdate({})}>Save Targeting</Button>
      </div>
    </div>
  );
}

// ── Ad-level creative editor ───────────────────────────────────────────────────

function AdEditor({
  ad,
  adType,
  platform,
  adIdx,
  onUpdate
}: {
  ad: AdCreative;
  adType: string;
  platform: string;
  adIdx: number;
  onUpdate: (updated: Partial<AdCreative>) => void;
}): React.JSX.Element {
  const isSearch = adType.toLowerCase().includes('search');
  const isStories = adType.toLowerCase().includes('stories') || adType.toLowerCase().includes('reels');
  const maxHeadlines = isSearch ? 15 : isStories ? 1 : 5;
  const maxDescriptions = isSearch ? 4 : 2;

  const [headlines, setHeadlines] = React.useState<string[]>(ad.headlines);
  const [descriptions, setDescriptions] = React.useState<string[]>(ad.descriptions);
  const [ctaText, setCtaText] = React.useState(ad.ctaText);
  const [destinationUrl, setDestinationUrl] = React.useState(ad.destinationUrl);
  const [saved, setSaved] = React.useState(false);

  const addHeadline = () => {
    if (headlines.length < maxHeadlines) setHeadlines([...headlines, '']);
  };

  const updateHeadline = (idx: number, val: string) => {
    const updated = [...headlines];
    updated[idx] = val;
    setHeadlines(updated);
  };

  const removeHeadline = (idx: number) => {
    setHeadlines(headlines.filter((_, i) => i !== idx));
  };

  const addDescription = () => {
    if (descriptions.length < maxDescriptions) setDescriptions([...descriptions, '']);
  };

  const updateDescription = (idx: number, val: string) => {
    const updated = [...descriptions];
    updated[idx] = val;
    setDescriptions(updated);
  };

  const removeDescription = (idx: number) => {
    setDescriptions(descriptions.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onUpdate({ headlines, descriptions, ctaText, destinationUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const imageAspect = isStories ? '9/16' : platform === 'meta' && !isSearch ? '1/1' : '16/9';
  const imageHeight = isStories ? 'h-48' : 'h-36';

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ad {adIdx + 1} — {adTypeLabel(adType)}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{platformLabel(platform)} · {isSearch ? 'Responsive Search Ad' : isStories ? '9:16 Vertical' : '16:9 Landscape'}</p>
        </div>
        <Button size="sm" className={cn('text-xs transition-colors', saved && 'text-green-600 border-green-300')} variant="outline" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save Ad'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Image/creative preview */}
          {!isSearch && (
            <ContentSection title="Creative Image">
              <div
                className={cn('relative rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden mx-auto', imageHeight)}
                style={{ aspectRatio: imageAspect, maxWidth: isStories ? 160 : '100%' }}
              >
                {ad.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.imageUrls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center flex-col gap-2">
                    <ImageIcon className="size-8 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/60">
                      {isStories ? '9:16' : platform === 'meta' ? '1:1' : '16:9'} image
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <UploadIcon className="size-3" />
                  Upload Image
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <RefreshCwIcon className="size-3" />
                  Regenerate
                </Button>
              </div>
              {ad.videoUrl && (
                <FieldRow label="Video URL">
                  <input type="url" defaultValue={ad.videoUrl} className="field-input" />
                </FieldRow>
              )}
            </ContentSection>
          )}

          {/* Headlines */}
          <ContentSection
            title={`Headlines (${headlines.length}/${maxHeadlines})`}
            helperText={isSearch ? 'Max 30 chars each. Google picks the best combination.' : undefined}
          >
            <div className="space-y-2">
              {headlines.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={h}
                      maxLength={isSearch ? 30 : 255}
                      onChange={(e) => updateHeadline(i, e.target.value)}
                      className="field-input pr-12"
                      placeholder={`Headline ${i + 1}`}
                    />
                    {isSearch && (
                      <span className={cn(
                        'absolute right-2 top-1/2 -translate-y-1/2 text-[10px]',
                        h.length > 27 ? 'text-amber-500' : 'text-muted-foreground'
                      )}>
                        {h.length}/30
                      </span>
                    )}
                  </div>
                  {headlines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHeadline(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {headlines.length < maxHeadlines && (
                <button
                  type="button"
                  onClick={addHeadline}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <PlusIcon className="size-3" />
                  Add headline
                </button>
              )}
            </div>
          </ContentSection>

          {/* Descriptions */}
          <ContentSection
            title={`Descriptions (${descriptions.length}/${maxDescriptions})`}
            helperText={isSearch ? 'Max 90 chars each.' : undefined}
          >
            <div className="space-y-2">
              {descriptions.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={d}
                      maxLength={isSearch ? 90 : 255}
                      onChange={(e) => updateDescription(i, e.target.value)}
                      rows={2}
                      className="field-input resize-none pr-12"
                      placeholder={`Description ${i + 1}`}
                    />
                    {isSearch && (
                      <span className={cn(
                        'absolute right-2 top-2 text-[10px]',
                        d.length > 80 ? 'text-amber-500' : 'text-muted-foreground'
                      )}>
                        {d.length}/90
                      </span>
                    )}
                  </div>
                  {descriptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDescription(i)}
                      className="mt-1 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {descriptions.length < maxDescriptions && (
                <button
                  type="button"
                  onClick={addDescription}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <PlusIcon className="size-3" />
                  Add description
                </button>
              )}
            </div>
          </ContentSection>

          {/* CTA + URL */}
          <ContentSection title="Call to Action & Destination">
            <FieldRow label="CTA Text" required>
              <select value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="field-input">
                {['Learn More', 'Shop Now', 'Sign Up', 'Get Started', 'Download', 'Contact Us', 'Book Now', 'Subscribe', 'Try Free', 'Install Now', 'Apply Now'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Destination URL" required>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                className="field-input"
                placeholder="https://example.com/landing-page"
              />
            </FieldRow>
          </ContentSection>
        </div>
      </div>
    </div>
  );
}

// ── Generic field renderer ─────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}): React.JSX.Element {
  const stringVal = String(value ?? '');

  switch (field.type) {
    case 'select':
      return (
        <FieldRow label={field.label} required={field.required} helperText={field.helperText}>
          <select value={stringVal} onChange={(e) => onChange(e.target.value)} className="field-input">
            <option value="">Select…</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FieldRow>
      );

    case 'toggle':
      return (
        <FieldRow label={field.label} helperText={field.helperText}>
          <ToggleField
            checked={stringVal === 'true'}
            onChange={(v) => onChange(String(v))}
          />
        </FieldRow>
      );

    case 'number':
      return (
        <FieldRow label={field.label} required={field.required} helperText={field.helperText}>
          <input
            type="number"
            value={stringVal}
            onChange={(e) => onChange(e.target.value)}
            className="field-input w-40"
            placeholder="0"
          />
        </FieldRow>
      );

    case 'date':
      return (
        <FieldRow label={field.label} required={field.required}>
          <input type="date" value={stringVal} onChange={(e) => onChange(e.target.value)} className="field-input w-44" />
        </FieldRow>
      );

    case 'textarea':
    case 'keywords':
      return (
        <FieldRow label={field.label} required={field.required} helperText={field.helperText}>
          <textarea
            value={stringVal}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="field-input resize-y"
            placeholder={field.type === 'keywords' ? '+broad "phrase" [exact]' : ''}
          />
        </FieldRow>
      );

    default:
      return (
        <FieldRow label={field.label} required={field.required} helperText={field.helperText}>
          <input
            type="text"
            value={stringVal}
            onChange={(e) => onChange(e.target.value)}
            className="field-input"
          />
        </FieldRow>
      );
  }
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function ContentSection({
  title,
  helperText,
  children
}: {
  title: string;
  helperText?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h3>
        {helperText && <p className="text-xs text-muted-foreground mt-0.5">{helperText}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  required,
  helperText,
  children
}: {
  label: string;
  required?: boolean;
  helperText?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-foreground">{label}</label>
        {required && <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Required</span>}
      </div>
      {children}
      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function ToggleField({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
        checked ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  );
}
