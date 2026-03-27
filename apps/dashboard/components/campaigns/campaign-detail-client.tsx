'use client';

import * as React from 'react';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImageIcon,
  PencilIcon,
  SparklesIcon
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

import { CampaignAgentsView } from './campaign-agents-view';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Creative = {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  callToActionType?: string;
  objectUrl?: string;
} | null;

type AdItem = {
  id: string;
  name: string;
  status: string;
  creative: Creative;
};

type AdSetItem = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  optimizationGoal: string;
  targeting: {
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    geoLocations?: { countries?: string[] };
    interests?: { name: string }[];
  };
  ads: AdItem[];
};

type DetailData = {
  campaignId: string;
  campaignName: string;
  platform: string;
  adSets: AdSetItem[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatBudget(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount / 100); // Meta budget is in cents
}

function decodeGenders(genders?: number[]): string {
  if (!genders || genders.length === 0) return 'All';
  const labels: Record<number, string> = { 1: 'Male', 2: 'Female' };
  return genders.map((g) => labels[g] ?? `${g}`).join(', ');
}

function getPlatformLabel(platform: string): string {
  const map: Record<string, string> = {
    google: 'Google Ads',
    meta: 'Meta Ads',
    bing: 'Microsoft Ads',
    tiktok: 'TikTok Ads',
    linkedin: 'LinkedIn Ads',
    reddit: 'Reddit Ads'
  };
  return map[platform] ?? platform;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    live: { cls: 'bg-green-50 text-green-700 border border-green-200', label: 'Active' },
    active: { cls: 'bg-green-50 text-green-700 border border-green-200', label: 'Active' },
    ACTIVE: { cls: 'bg-green-50 text-green-700 border border-green-200', label: 'Active' },
    paused: { cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: 'Paused' },
    PAUSED: { cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: 'Paused' },
    failed: { cls: 'bg-red-50 text-red-700 border border-red-200', label: 'Failed' },
    ended: { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Ended' },
    draft: { cls: 'bg-gray-50 text-gray-500 border border-gray-200', label: 'Draft' },
    reviewing: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Reviewing' }
  };
  const c = config[status] ?? {
    cls: 'bg-gray-50 text-gray-500 border border-gray-200',
    label: toTitleCase(status)
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', c.cls)}>
      {c.label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    google: { bg: 'bg-[#4285F4]/10', text: 'text-[#4285F4]' },
    meta: { bg: 'bg-[#0866FF]/10', text: 'text-[#0866FF]' },
    bing: { bg: 'bg-[#00809D]/10', text: 'text-[#00809D]' },
    tiktok: { bg: 'bg-black/10', text: 'text-black dark:text-white' },
    linkedin: { bg: 'bg-[#0A66C2]/10', text: 'text-[#0A66C2]' }
  };
  const c = config[platform] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-border', c.bg, c.text)}>
      {getPlatformLabel(platform)}
    </span>
  );
}

function AdCard({ ad }: { ad: AdItem }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{ad.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">ID: {ad.id}</p>
        </div>
        <StatusBadge status={ad.status} />
      </div>

      {ad.creative && (
        <div className="flex gap-3">
          {/* Thumbnail */}
          {(ad.creative.thumbnailUrl ?? ad.creative.imageUrl) ? (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.creative.thumbnailUrl ?? ad.creative.imageUrl}
                alt={ad.creative.title ?? 'Ad creative'}
                className="w-16 h-16 object-cover rounded-md border border-border"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="shrink-0 w-16 h-16 rounded-md border border-border bg-muted flex items-center justify-center">
              <ImageIcon className="size-5 text-muted-foreground/40" />
            </div>
          )}

          {/* Text content */}
          <div className="min-w-0 space-y-1">
            {ad.creative.title && (
              <p className="text-xs font-medium text-foreground line-clamp-1">{ad.creative.title}</p>
            )}
            {ad.creative.body && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{ad.creative.body}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {ad.creative.callToActionType && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
                  {ad.creative.callToActionType.replace(/_/g, ' ')}
                </span>
              )}
              {ad.creative.objectUrl && (
                <a
                  href={ad.creative.objectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline truncate max-w-[160px]"
                >
                  <ExternalLinkIcon className="size-2.5 shrink-0" />
                  {ad.creative.objectUrl.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdSetCard({ adSet, currency = 'USD' }: { adSet: AdSetItem; currency?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const { targeting } = adSet;

  const ageStr =
    targeting.ageMin || targeting.ageMax
      ? `${targeting.ageMin ?? '?'}–${targeting.ageMax ?? '?'}`
      : null;
  const genderStr = decodeGenders(targeting.genders);
  const countries = targeting.geoLocations?.countries ?? [];
  const interests = targeting.interests ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{adSet.name}</p>
            <StatusBadge status={adSet.status} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">ID: {adSet.id}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-foreground">{formatBudget(adSet.dailyBudget, currency)}<span className="font-normal text-muted-foreground">/day</span></p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{adSet.optimizationGoal.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Targeting summary */}
      <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1">
        {ageStr && (
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Age:</span> {ageStr}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Gender:</span> {genderStr}
        </span>
        {countries.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Countries:</span> {countries.join(', ')}
          </span>
        )}
        {interests.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Interests:</span>{' '}
            {interests.slice(0, 5).map((i) => i.name).join(', ')}
            {interests.length > 5 && ` +${interests.length - 5} more`}
          </span>
        )}
      </div>

      {/* Expand ads */}
      {adSet.ads.length > 0 && (
        <>
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {expanded ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
              View Ads ({adSet.ads.length})
            </button>
          </div>

          {expanded && (
            <div className="border-t border-border bg-muted/10 p-3 space-y-2">
              {adSet.ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          )}
        </>
      )}

      {adSet.ads.length === 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[11px] text-muted-foreground">No ads in this ad set.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      {/* Back + header */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-7 w-64 rounded bg-muted" />
        <div className="h-5 w-20 rounded-full bg-muted" />
      </div>
      {/* Cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
            <div className="flex gap-3">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampaignDetailClient({
  orgSlug,
  orgId,
  campaignId,
  source,
  platform,
  orgCurrency = 'USD'
}: {
  orgSlug: string;
  orgId: string;
  campaignId: string;
  source: string;
  platform: string;
  orgCurrency?: string;
}) {
  const [data, setData] = React.useState<DetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'adsets' | 'agents'>('adsets');

  const isAccelerate = source === 'accelerate';

  React.useEffect(() => {
    void loadDetail();
  }, [campaignId, orgId, source, platform]);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/adsets?orgId=${orgId}&source=${source}&platform=${platform}`
      );
      if (!res.ok) {
        setError(`Failed to load campaign details (${res.status})`);
        return;
      }
      const json = await res.json() as DetailData;
      setData(json);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4 p-6 pb-24">
      {/* Back link */}
      <a
        href={`/organizations/${orgSlug}/campaigns`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeftIcon className="size-4" />
        Campaigns
      </a>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-foreground">
          {data?.campaignName ?? campaignId}
        </h1>
        <PlatformBadge platform={data?.platform ?? platform} />
        <span className="text-xs text-muted-foreground">ID: {campaignId}</span>
        {isAccelerate && (
          <a
            href={`/organizations/${orgSlug}/campaigns/${campaignId}/edit`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <PencilIcon className="size-3.5" />
            Edit
          </a>
        )}
      </div>

      {/* Tabs — only shown for Accelerate-created campaigns */}
      {isAccelerate && (
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('adsets')}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'adsets'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Ad Sets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'agents'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <SparklesIcon className="size-3.5" />
            Agent Analysis
          </button>
        </div>
      )}

      {/* Agent Analysis tab */}
      {activeTab === 'agents' && isAccelerate && (
        <CampaignAgentsView campaignId={campaignId} orgId={orgId} />
      )}

      {/* Ad Sets tab (default) */}
      {activeTab === 'adsets' && (
        <>
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && data && data.adSets.length === 0 && (
            <div className="rounded-xl border border-border bg-card py-16 flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-medium text-foreground">No ad sets found</p>
              <p className="text-xs text-muted-foreground">This campaign has no ad sets, or they could not be loaded.</p>
            </div>
          )}

          {!error && data && data.adSets.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Ad Sets ({data.adSets.length})
              </p>
              {data.adSets.map((adSet) => (
                <AdSetCard key={adSet.id} adSet={adSet} currency={orgCurrency} />
              ))}
            </div>
          )}

          {!error && !data && !loading && (
            <div className="rounded-xl border border-border bg-card py-16 flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-medium text-foreground">Campaign not found</p>
              <p className="text-xs text-muted-foreground">Could not load data for this campaign.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
