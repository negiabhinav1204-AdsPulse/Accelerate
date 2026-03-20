'use client';

import * as React from 'react';
import {
  ArrowRightIcon,
  GlobeIcon,
  ImageIcon,
  MaximizeIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  PinIcon,
  RocketIcon,
  SearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserRoundIcon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import type { AdCreative, AdTypePlan, MediaPlan, PlatformPlan } from './types';

// ── Platform icons ─────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-4', className)}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MetaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
      <rect width="40" height="40" rx="8" fill="#0866FF" />
      <path
        d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z"
        fill="white"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
      <rect x="2" y="2" width="17" height="17" fill="#F25022" />
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00" />
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF" />
      <rect x="21" y="21" width="17" height="17" fill="#FFB900" />
    </svg>
  );
}

// ── Ad type icons ──────────────────────────────────────────────────────────────

function AdTypeIcon({ type }: { type: string }): React.JSX.Element {
  switch (type.toLowerCase().replace(/[_ ]/g, '')) {
    case 'search':
      return <SearchIcon className="size-3.5" />;
    case 'display':
      return <ImageIcon className="size-3.5" />;
    case 'pmax':
    case 'performancemax':
      return <ZapIcon className="size-3.5" />;
    case 'shopping':
      return <ShoppingBagIcon className="size-3.5" />;
    case 'demandgen':
    case 'demand_gen':
      return <SparklesIcon className="size-3.5" />;
    case 'feed':
      return <ImageIcon className="size-3.5" />;
    case 'stories':
    case 'reels':
      return <RocketIcon className="size-3.5" />;
    default:
      return <SparklesIcon className="size-3.5" />;
  }
}

function platformLabel(platform: string): string {
  switch (platform) {
    case 'google':
      return 'Google';
    case 'meta':
      return 'Meta';
    case 'bing':
      return 'Microsoft';
    default:
      return platform;
  }
}

function adTypeLabel(adType: string): string {
  const map: Record<string, string> = {
    search: 'Search',
    display: 'Display',
    pmax: 'P Max',
    performance_max: 'P Max',
    shopping: 'Shopping',
    demand_gen: 'Demand Gen',
    feed: 'Feed',
    stories: 'Stories',
    reels: 'Reels',
    video: 'Video'
  };
  return map[adType.toLowerCase()] ?? adType;
}

// ── Props ─────────────────────────────────────────────────────────────────────

type CampaignPreviewPanelProps = {
  mediaPlan: MediaPlan;
  onClose: () => void;
  onEdit: () => void;
  onPublish: (mediaPlan: MediaPlan) => Promise<void>;
  publishing: boolean;
  orgSlug: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignPreviewPanel({
  mediaPlan,
  onClose,
  onEdit,
  onPublish,
  publishing
}: CampaignPreviewPanelProps): React.JSX.Element {
  const [selectedPlatformIdx, setSelectedPlatformIdx] = React.useState(0);
  const [selectedAdTypeIdx, setSelectedAdTypeIdx] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'targeting' | 'creatives'>('targeting');
  const [targetingExpanded, setTargetingExpanded] = React.useState(false);
  const [platformMenuOpen, setPlatformMenuOpen] = React.useState<number | null>(null);
  const [adTypeMenuOpen, setAdTypeMenuOpen] = React.useState<number | null>(null);

  const selectedPlatform: PlatformPlan | undefined = mediaPlan.platforms[selectedPlatformIdx];
  const selectedAdType: AdTypePlan | undefined =
    selectedPlatform?.adTypes[selectedAdTypeIdx];

  const totalCreatives = selectedPlatform?.adTypes.reduce(
    (sum, at) => sum + at.ads.length,
    0
  ) ?? 0;

  // Close menus on outside click
  React.useEffect(() => {
    const handler = () => {
      setPlatformMenuOpen(null);
      setAdTypeMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Campaign Preview</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <MaximizeIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="shrink-0 px-3 pt-3 pb-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {mediaPlan.platforms.map((p, i) => (
            <div key={p.platform} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlatformIdx(i);
                  setSelectedAdTypeIdx(0);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                  i === selectedPlatformIdx
                    ? 'border-primary text-foreground bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {p.platform === 'google' && <GoogleIcon />}
                {p.platform === 'meta' && <MetaIcon />}
                {p.platform === 'bing' && <MicrosoftIcon />}
                {platformLabel(p.platform)}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlatformMenuOpen(platformMenuOpen === i ? null : i);
                }}
                className="absolute right-0 top-1.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreHorizontalIcon className="size-3" />
              </button>
              {platformMenuOpen === i && (
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-accent transition-colors"
                    onClick={() => setPlatformMenuOpen(null)}
                  >
                    Remove platform
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="h-px bg-border" />
      </div>

      {/* Ad type chips */}
      {selectedPlatform && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-border">
          {selectedPlatform.adTypes.map((at, i) => (
            <div key={at.adType} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAdTypeIdx(i)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  i === selectedAdTypeIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <AdTypeIcon type={at.adType} />
                {adTypeLabel(at.adType)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('targeting')}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'targeting'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          Targeting
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('creatives')}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'creatives'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          Creatives ({totalCreatives})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activeTab === 'targeting' && selectedAdType && (
          <TargetingTab
            targeting={selectedAdType.targeting}
            expanded={targetingExpanded}
            onToggleExpand={() => setTargetingExpanded((prev) => !prev)}
          />
        )}
        {activeTab === 'creatives' && selectedAdType && (
          <CreativesTab ads={selectedAdType.ads} adType={selectedAdType.adType} />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onEdit}
        >
          Edit details
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs gap-1.5"
          onClick={() => void onPublish(mediaPlan)}
          disabled={publishing}
        >
          {publishing ? (
            <>Publishing...</>
          ) : (
            <>
              Publish
              <RocketIcon className="size-3" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Targeting Tab ─────────────────────────────────────────────────────────────

function TargetingTab({
  targeting,
  expanded,
  onToggleExpand
}: {
  targeting: AdTypePlan['targeting'];
  expanded: boolean;
  onToggleExpand: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Basic &amp; Advanced targeting settings
      </p>

      <TargetingRow
        icon={<PinIcon className="size-3.5" />}
        label="LOCATION"
        value={targeting.locations.join(', ') || 'All locations'}
      />
      <TargetingRow
        icon={<UserRoundIcon className="size-3.5" />}
        label="AGE &amp; GENDER"
        value={`${targeting.ageRange} • ${targeting.gender}`}
      />
      <TargetingRow
        icon={<PhoneIcon className="size-3.5" />}
        label="DEVICE TARGETING"
        value={targeting.deviceTargeting.join(', ') || 'All devices'}
      />
      <TargetingRow
        icon={<GlobeIcon className="size-3.5" />}
        label="LANGUAGE"
        value={targeting.languages.join(', ') || 'All languages'}
      />

      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-2"
      >
        {expanded ? 'Hide details' : 'View more details'}
        <ArrowRightIcon
          className={cn(
            'size-3 transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 pt-2 border-t border-border">
          {targeting.keywords && targeting.keywords.length > 0 && (
            <TargetingRow
              icon={<SearchIcon className="size-3.5" />}
              label="KEYWORDS"
              value={targeting.keywords.slice(0, 5).join(', ') + (targeting.keywords.length > 5 ? '...' : '')}
            />
          )}
          <TargetingRow
            icon={<ZapIcon className="size-3.5" />}
            label="BID STRATEGY"
            value={targeting.bidStrategy}
          />
        </div>
      )}
    </div>
  );
}

function TargetingRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors">
      <span className="shrink-0 mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xs text-foreground mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

// ── Creatives Tab ─────────────────────────────────────────────────────────────

function CreativesTab({
  ads,
  adType
}: {
  ads: AdCreative[];
  adType: string;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      {ads.map((ad) => (
        <CreativeCard key={ad.id} ad={ad} adType={adType} />
      ))}
      {ads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ImageIcon className="size-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">No creatives yet</p>
        </div>
      )}
    </div>
  );
}

function CreativeCard({
  ad,
  adType
}: {
  ad: AdCreative;
  adType: string;
}): React.JSX.Element {
  const headline = ad.headlines[0] ?? 'No headline';
  const description = ad.descriptions[0] ?? 'No description';
  const imageUrl = ad.imageUrls[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Image */}
      <div className="relative h-28 bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={headline}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/40" />
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {adTypeLabel(adType)}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground line-clamp-1">{headline}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Ad · {new URL(ad.destinationUrl.startsWith('http') ? ad.destinationUrl : `https://${ad.destinationUrl}`).hostname.replace('www.', '')}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {ad.ctaText}
          </span>
        </div>
      </div>
    </div>
  );
}
