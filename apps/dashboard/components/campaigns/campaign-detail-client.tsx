'use client';

import * as React from 'react';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImageIcon,
  PencilIcon,
  SparklesIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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
// New types
// ---------------------------------------------------------------------------

type CampaignMetrics = {
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  impressions: number;
  clicks: number;
  currency: string;
};

// ---------------------------------------------------------------------------
// New sub-components
// ---------------------------------------------------------------------------

function HealthBadge({ health }: { health: 'winner' | 'learner' | 'underperformer' | 'bleeder' | null }) {
  if (!health) return null;
  const config = {
    winner: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Winner' },
    learner: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Learner' },
    underperformer: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Underperformer' },
    bleeder: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Bleeder' },
  };
  const c = config[health];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap', c.cls)}>
      {c.label}
    </span>
  );
}

function MetricCard({ label, value, sub, trend }: {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {trend === 'up' && <TrendingUpIcon className="size-4 text-emerald-500" />}
        {trend === 'down' && <TrendingDownIcon className="size-4 text-red-500" />}
      </div>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RecommendationCard({ priority, title, description, onApply }: {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  onApply?: () => void;
}) {
  const cfg = {
    HIGH: 'border-l-red-500 bg-red-50/30',
    MEDIUM: 'border-l-amber-500 bg-amber-50/30',
    LOW: 'border-l-blue-500 bg-blue-50/30',
  };
  const badgeCfg = {
    HIGH: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-blue-100 text-blue-700',
  };
  return (
    <div className={cn('rounded-xl border border-border border-l-4 p-4 space-y-2', cfg[priority])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold', badgeCfg[priority])}>
            {priority}
          </span>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onApply}
        className="text-xs font-medium text-primary hover:underline"
      >
        Apply recommendation →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock chart data
// ---------------------------------------------------------------------------

const SPEND_CHART_DATA = [
  { day: 'Day 1', spend: 380, conversions: 8 },
  { day: 'Day 2', spend: 420, conversions: 11 },
  { day: 'Day 3', spend: 395, conversions: 9 },
  { day: 'Day 4', spend: 460, conversions: 14 },
  { day: 'Day 5', spend: 510, conversions: 16 },
  { day: 'Day 6', spend: 490, conversions: 13 },
  { day: 'Day 7', spend: 440, conversions: 12 },
  { day: 'Day 8', spend: 530, conversions: 17 },
  { day: 'Day 9', spend: 580, conversions: 19 },
  { day: 'Day 10', spend: 560, conversions: 18 },
  { day: 'Day 11', spend: 610, conversions: 21 },
  { day: 'Day 12', spend: 590, conversions: 20 },
  { day: 'Day 13', spend: 620, conversions: 22 },
  { day: 'Day 14', spend: 650, conversions: 24 },
];

const HEALTH_CHART_DATA = [
  { day: 'Day 1', score: 68 },
  { day: 'Day 2', score: 71 },
  { day: 'Day 3', score: 69 },
  { day: 'Day 4', score: 74 },
  { day: 'Day 5', score: 78 },
  { day: 'Day 6', score: 76 },
  { day: 'Day 7', score: 82 },
];

const MOCK_RECOMMENDATIONS = [
  {
    priority: 'HIGH' as const,
    title: 'Scale budget +25%',
    description: 'ROAS 3.1x consistently over 14 days — this campaign is budget-limited. Increasing spend could capture 40% more conversions.',
  },
  {
    priority: 'MEDIUM' as const,
    title: 'Add lookalike audience',
    description: 'Your top converters are aged 28-38 with shopping interests. A 1% lookalike could expand reach by ~50K.',
  },
  {
    priority: 'LOW' as const,
    title: 'Refresh creative assets',
    description: 'Primary creative is 32 days old. A/B test with a new variant to prevent fatigue.',
  },
];

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
  const [metrics, setMetrics] = React.useState<CampaignMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(true);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  const isAccelerate = source === 'accelerate';

  const MOCK_METRICS: CampaignMetrics = {
    spend: 12400,
    revenue: 38200,
    roas: 3.08,
    conversions: 156,
    impressions: 284000,
    clicks: 5630,
    currency: orgCurrency,
  };

  React.useEffect(() => {
    void loadDetail();
    void loadMetrics();
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

  async function loadMetrics() {
    setMetricsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/metrics?orgId=${orgId}`);
      if (!res.ok) throw new Error('metrics unavailable');
      const json = await res.json() as CampaignMetrics;
      setMetrics(json);
    } catch {
      setMetrics(MOCK_METRICS);
    } finally {
      setMetricsLoading(false);
    }
  }

  function getHealth(m: CampaignMetrics | null): 'winner' | 'learner' | 'underperformer' | 'bleeder' | null {
    if (!m) return null;
    if (m.spend < 100) return 'learner';
    if (m.roas >= 3) return 'winner';
    if (m.roas >= 1) return 'underperformer';
    return 'bleeder';
  }

  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const health = getHealth(metrics);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-6 p-6 pb-24">
      {/* 1. Back link */}
      <a
        href={`/organizations/${orgSlug}/campaigns`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeftIcon className="size-4" />
        Campaigns
      </a>

      {/* 2. Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-foreground">
          {data?.campaignName ?? campaignId}
        </h1>
        <PlatformBadge platform={data?.platform ?? platform} />
        {data && <StatusBadge status={data.adSets[0]?.status ?? 'draft'} />}
        <HealthBadge health={health} />
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

      {/* 3. Performance metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Spend"
          value={metricsLoading ? '—' : formatCurrency(metrics?.spend ?? 0, metrics?.currency ?? orgCurrency)}
          trend={null}
        />
        <MetricCard
          label="Revenue"
          value={metricsLoading ? '—' : formatCurrency(metrics?.revenue ?? 0, metrics?.currency ?? orgCurrency)}
          trend="up"
        />
        <MetricCard
          label="ROAS"
          value={metricsLoading ? '—' : `${(metrics?.roas ?? 0).toFixed(2)}x`}
          sub={health === 'winner' ? 'Performing well' : undefined}
          trend={(metrics?.roas ?? 0) >= 2 ? 'up' : 'down'}
        />
        <MetricCard
          label="Conversions"
          value={metricsLoading ? '—' : String(metrics?.conversions ?? 0)}
          trend="up"
        />
      </div>

      {/* 4. Campaign details collapsible */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
        >
          Campaign Details
          {detailsExpanded ? (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          )}
        </button>
        {detailsExpanded && (
          <div className="border-t border-border px-4 py-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Platform</p>
              <p className="text-sm text-foreground mt-0.5">{getPlatformLabel(data?.platform ?? platform)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Objective</p>
              <p className="text-sm text-foreground mt-0.5">{toTitleCase(data?.adSets[0]?.optimizationGoal ?? '—')}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Status</p>
              <p className="text-sm text-foreground mt-0.5">{toTitleCase(data?.adSets[0]?.status ?? '—')}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Daily Budget</p>
              <p className="text-sm text-foreground mt-0.5">
                {data?.adSets[0]
                  ? formatBudget(data.adSets[0].dailyBudget, orgCurrency)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Ad Sets</p>
              <p className="text-sm text-foreground mt-0.5">{data?.adSets.length ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Campaign ID</p>
              <p className="text-sm text-foreground mt-0.5 font-mono text-xs">{campaignId}</p>
            </div>
          </div>
        )}
      </div>

      {/* 5. Spend vs Conversions chart */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Spend vs Conversions — Last 14 Days</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={SPEND_CHART_DATA} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Spend ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="conversions"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Conversions"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 6. Audience Insights */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground">Audience Insights</p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { label: 'Age 25–34', pct: 35 },
            { label: 'Age 35–44', pct: 28 },
            { label: 'Male', pct: 58 },
            { label: 'Female', pct: 42 },
          ].map(({ label, pct }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xs font-semibold text-foreground">{pct}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Ad Sets */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Ad Sets {data ? `(${data.adSets.length})` : ''}
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && data && data.adSets.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-12 flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-foreground">No ad sets found</p>
            <p className="text-xs text-muted-foreground">This campaign has no ad sets, or they could not be loaded.</p>
          </div>
        )}

        {!error && data && data.adSets.length > 0 &&
          data.adSets.map((adSet) => (
            <AdSetCard key={adSet.id} adSet={adSet} currency={orgCurrency} />
          ))
        }

        {!error && !data && !loading && (
          <div className="rounded-xl border border-border bg-card py-12 flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-foreground">Campaign not found</p>
            <p className="text-xs text-muted-foreground">Could not load data for this campaign.</p>
          </div>
        )}
      </div>

      {/* 8. Health Score History */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Health Score History — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={HEALTH_CHART_DATA} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 3 }}
              name="Health Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 9. AI Recommendations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">AI Recommendations</p>
        </div>
        {MOCK_RECOMMENDATIONS.map((rec) => (
          <RecommendationCard
            key={rec.title}
            priority={rec.priority}
            title={rec.title}
            description={rec.description}
          />
        ))}
      </div>

      {/* 10. Agent Analysis (Accelerate campaigns only) */}
      {isAccelerate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Agent Analysis</p>
          </div>
          <CampaignAgentsView campaignId={campaignId} orgId={orgId} />
        </div>
      )}
    </div>
  );
}
