'use client';

import * as React from 'react';
import {
  ArrowRightIcon,
  GlobeIcon,
  ImageIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PinIcon,
  SearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Trash2Icon,
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
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MetaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: string }): React.JSX.Element {
  if (platform === 'google') return <GoogleIcon />;
  if (platform === 'meta') return <MetaIcon />;
  return <MicrosoftIcon />;
}

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

function adTypeEmoji(adType: string): string {
  const map: Record<string, string> = {
    search: '🔍', display: '🖼️', pmax: '🎯', performance_max: '🎯',
    shopping: '🛍️', demand_gen: '✨', feed: '📰', stories: '📱',
    reels: '🎬', video: '▶️', awareness: '📢', traffic: '🚦',
    engagement: '💬', leads: '🎯', app_promotion: '📲', sales: '💰',
    audience: '👥',
  };
  return map[adType.toLowerCase()] ?? '📋';
}

function locationDisplay(loc: unknown): string {
  if (typeof loc === 'string') return loc;
  if (loc && typeof loc === 'object') {
    const l = loc as { raw?: string; city?: string | null; country?: string };
    return l.raw || l.city || l.country || '';
  }
  return '';
}

// ── Dropdown menu ──────────────────────────────────────────────────────────────

type MenuState =
  | { type: 'platform'; platformIdx: number }
  | { type: 'adType'; platformIdx: number; adTypeIdx: number }
  | null;

function ContextMenu({
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 min-w-[120px] rounded-lg border border-border bg-popover py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={() => { onClose(); onEdit(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
      >
        <PencilIcon className="size-3 text-muted-foreground" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onDelete(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2Icon className="size-3" />
        Delete
      </button>
    </div>
  );
}

// ── Edit scope type ────────────────────────────────────────────────────────────

export type EditScope = {
  platformIdx?: number;
  adTypeIdx?: number;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type CampaignPreviewPanelProps = {
  mediaPlan: MediaPlan;
  onClose: () => void;
  onEdit: (scope?: EditScope) => void;
  onPublish?: () => void;
  onMediaPlanChange?: (updated: MediaPlan) => void;
  orgSlug: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  publishing?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignPreviewPanel({
  mediaPlan,
  onClose,
  onEdit,
  onPublish,
  onMediaPlanChange,
  fullscreen = false,
  onToggleFullscreen,
  publishing = false
}: CampaignPreviewPanelProps): React.JSX.Element {
  const [selectedPlatformIdx, setSelectedPlatformIdx] = React.useState(0);
  const [selectedAdTypeIdx, setSelectedAdTypeIdx] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'targeting' | 'creatives'>('targeting');
  const [targetingExpanded, setTargetingExpanded] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<MenuState>(null);

  // Generate images lazily for visual ad types that have no images yet.
  // Uses a ref to track which have been attempted and processes sequentially
  // so each successive update is applied on top of the previous.
  const imageGenAttemptedRef = React.useRef<Set<string>>(new Set());
  const mediaPlanRef = React.useRef(mediaPlan);
  mediaPlanRef.current = mediaPlan;

  React.useEffect(() => {
    if (!onMediaPlanChange) return;

    const visualAdTypes: { platform: string; adType: string; aspectRatio: '1:1' | '16:9' | '9:16'; prompts: string[] }[] = [];
    const brandName = mediaPlan.summary?.brandName ?? '';

    for (const platform of mediaPlan.platforms) {
      for (const adType of platform.adTypes) {
        const normalizedType = adType.adType.toLowerCase();
        if (['search', 'rsa'].includes(normalizedType)) continue;
        const key = `${platform.platform}:${adType.adType}`;
        const needsImages = adType.ads.some((ad) => ad.imageUrls.length === 0);
        if (!needsImages || imageGenAttemptedRef.current.has(key)) continue;
        imageGenAttemptedRef.current.add(key);

        const aspectRatio: '1:1' | '16:9' | '9:16' =
          normalizedType.includes('stories') || normalizedType.includes('reels') ? '9:16'
          : platform.platform === 'meta' ? '1:1'
          : '16:9';

        visualAdTypes.push({
          platform: platform.platform,
          adType: adType.adType,
          aspectRatio,
          prompts: adType.ads.slice(0, 3).map((ad) =>
            ad.imagePrompt ?? `${ad.headlines[0] ?? brandName}. ${ad.descriptions[0] ?? ''}`.trim()
          )
        });
      }
    }

    if (visualAdTypes.length === 0) return;

    // Process sequentially so each update builds on the previous
    void (async () => {
      for (const item of visualAdTypes) {
        try {
          const res = await fetch('/api/campaign/generate-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompts: item.prompts, aspectRatio: item.aspectRatio, brandName })
          });
          const data = (await res.json()) as { imageUrls?: string[] };
          if (!data.imageUrls || data.imageUrls.length === 0) continue;

          // Read the current latest plan from the ref so we always apply on top of previous updates
          const current = mediaPlanRef.current;
          onMediaPlanChange({
            ...current,
            platforms: current.platforms.map((p) =>
              (p.platform as string) !== item.platform ? p : {
                ...p,
                adTypes: p.adTypes.map((at) =>
                  at.adType !== item.adType ? at : {
                    ...at,
                    ads: at.ads.map((ad, i) =>
                      data.imageUrls![i] ? { ...ad, imageUrls: [data.imageUrls![i]!] } : ad
                    )
                  }
                )
              }
            )
          });
        } catch {
          // non-fatal
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaPlan.platforms, onMediaPlanChange]);

  const selectedPlatform: PlatformPlan | undefined = mediaPlan.platforms[selectedPlatformIdx];
  const selectedAdType: AdTypePlan | undefined = selectedPlatform?.adTypes[selectedAdTypeIdx];

  const totalCreatives = selectedPlatform?.adTypes.reduce((sum, at) => sum + at.ads.length, 0) ?? 0;

  const handleDeletePlatform = (platformIdx: number) => {
    if (!onMediaPlanChange) return;
    const updated: MediaPlan = {
      ...mediaPlan,
      platforms: mediaPlan.platforms.filter((_, i) => i !== platformIdx)
    };
    onMediaPlanChange(updated);
    if (selectedPlatformIdx >= updated.platforms.length) {
      setSelectedPlatformIdx(Math.max(0, updated.platforms.length - 1));
    }
  };

  const handleDeleteAdType = (platformIdx: number, adTypeIdx: number) => {
    if (!onMediaPlanChange) return;
    const updated: MediaPlan = {
      ...mediaPlan,
      platforms: mediaPlan.platforms.map((p, pi) =>
        pi !== platformIdx ? p : { ...p, adTypes: p.adTypes.filter((_, ai) => ai !== adTypeIdx) }
      )
    };
    onMediaPlanChange(updated);
    if (selectedAdTypeIdx >= (updated.platforms[platformIdx]?.adTypes.length ?? 0)) {
      setSelectedAdTypeIdx(0);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white border-l border-[#e5e7eb]',
        fullscreen ? 'fixed inset-0 z-50' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb]">
        <p className="text-sm font-semibold text-[#101828]">Campaign Preview</p>
        <div className="flex items-center gap-1">
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={fullscreen ? 'Minimize' : 'Expand'}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#6a7282] hover:bg-gray-100 hover:text-[#364153] transition-colors"
            >
              {fullscreen ? <MinimizeIcon className="size-3.5" /> : <MaximizeIcon className="size-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6a7282] hover:bg-gray-100 hover:text-[#364153] transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Platform pills row */}
      <div className="shrink-0 px-6 pt-4 pb-4 border-b border-[#e5e7eb]">
        <div className="flex items-center gap-2 flex-wrap">
          {mediaPlan.platforms.map((p, i) => (
            <div key={p.platform} className="relative shrink-0">
              <div
                className={cn(
                  'flex items-center gap-0.5 h-9 rounded-[50px] border transition-all',
                  i === selectedPlatformIdx
                    ? 'bg-[#fef3c7] border-[#1677ff]'
                    : 'bg-white border-[#e5e7eb] hover:bg-gray-50 hover:border-[#9ca3af]'
                )}
              >
                <button
                  type="button"
                  onClick={() => { setSelectedPlatformIdx(i); setSelectedAdTypeIdx(0); }}
                  className="flex items-center gap-1.5 pl-[13px] pr-1 h-full"
                >
                  <PlatformIcon platform={p.platform} />
                  <span className={cn('text-sm font-medium', i === selectedPlatformIdx ? 'text-[#1677ff]' : 'text-[#364153]')}>
                    {platformLabel(p.platform)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu(
                    openMenu?.type === 'platform' && openMenu.platformIdx === i
                      ? null
                      : { type: 'platform', platformIdx: i }
                  )}
                  className="flex h-6 w-5 items-center justify-center rounded-r-[18px] text-[#6a7282] hover:text-[#364153] transition-colors pr-1"
                >
                  <MoreHorizontalIcon className="size-3" />
                </button>
              </div>
              {openMenu?.type === 'platform' && openMenu.platformIdx === i && (
                <ContextMenu
                  onEdit={() => onEdit({ platformIdx: i })}
                  onDelete={() => handleDeletePlatform(i)}
                  onClose={() => setOpenMenu(null)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ad type pills row */}
      {selectedPlatform && (
        <div className="shrink-0 px-6 pt-4 pb-4 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPlatform.adTypes.map((at, i) => (
              <div key={at.adType} className="relative shrink-0">
                <div
                  className={cn(
                    'flex items-center gap-0.5 h-8 rounded-2xl border transition-all',
                    i === selectedAdTypeIdx
                      ? 'bg-[#eff6ff] border-[#1677ff]'
                      : 'bg-white border-[#e5e7eb] hover:bg-gray-50 hover:border-[#9ca3af]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAdTypeIdx(i)}
                    className="flex items-center gap-1.5 pl-[11px] pr-1 h-full"
                  >
                    <span className="text-base leading-none">{adTypeEmoji(at.adType)}</span>
                    <span className={cn('text-xs font-medium', i === selectedAdTypeIdx ? 'text-[#1677ff]' : 'text-[#4a5565]')}>
                      {adTypeLabel(at.adType)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(
                      openMenu?.type === 'adType' && openMenu.platformIdx === selectedPlatformIdx && openMenu.adTypeIdx === i
                        ? null
                        : { type: 'adType', platformIdx: selectedPlatformIdx, adTypeIdx: i }
                    )}
                    className="flex h-6 w-5 items-center justify-center text-[#6a7282] hover:text-[#364153] transition-colors pr-1"
                  >
                    <MoreHorizontalIcon className="size-3" />
                  </button>
                </div>
                {openMenu?.type === 'adType' && openMenu.platformIdx === selectedPlatformIdx && openMenu.adTypeIdx === i && (
                  <ContextMenu
                    onEdit={() => onEdit({ platformIdx: selectedPlatformIdx, adTypeIdx: i })}
                    onDelete={() => handleDeleteAdType(selectedPlatformIdx, i)}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="shrink-0 flex items-center border-b border-[#e5e7eb] h-12 px-6">
        <button
          type="button"
          onClick={() => setActiveTab('targeting')}
          className={cn(
            'relative mr-12 font-semibold text-sm leading-5 h-full transition-colors',
            activeTab === 'targeting' ? 'text-[#1677ff]' : 'text-[#4a5565] hover:text-[#364153]'
          )}
        >
          Targeting
          {activeTab === 'targeting' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1677ff]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('creatives')}
          className={cn(
            'relative font-semibold text-sm leading-5 h-full transition-colors',
            activeTab === 'creatives' ? 'text-[#1677ff]' : 'text-[#4a5565] hover:text-[#364153]'
          )}
        >
          Creatives ({totalCreatives})
          {activeTab === 'creatives' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1677ff]" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6">
        {activeTab === 'targeting' && selectedAdType && (
          <TargetingTab
            targeting={selectedAdType.targeting}
            platform={selectedPlatform?.platform ?? 'google'}
            expanded={targetingExpanded}
            onToggleExpand={() => setTargetingExpanded((prev) => !prev)}
          />
        )}
        {activeTab === 'creatives' && selectedAdType && (
          <CreativesTab
            ads={selectedAdType.ads}
            adType={selectedAdType.adType}
            platform={selectedPlatform?.platform ?? 'google'}
            destinationUrl={mediaPlan.platforms[0]?.adTypes[0]?.ads[0]?.destinationUrl ?? ''}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 grid grid-cols-2 gap-3 px-4 py-3 border-t border-[#e5e7eb] bg-white min-h-[72px] items-center">
        <Button variant="outline" className="flex items-center justify-center gap-2 py-5" onClick={() => onEdit()}>
          <PencilIcon className="size-4" />
          Edit Details
        </Button>
        <Button
          className="flex items-center justify-center gap-2 py-5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          onClick={onPublish}
          disabled={publishing}
        >
          {publishing ? (
            <>
              <span className="size-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Publishing...
            </>
          ) : (
            'Publish'
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
  platform: string;
  expanded: boolean;
  onToggleExpand: () => void;
}): React.JSX.Element {
  const locations = (targeting.locations as unknown[])
    .map(locationDisplay)
    .filter(Boolean);

  const keywords = targeting.keywords ?? [];
  const interests = (targeting as { interests?: string[] }).interests ?? [];
  const deviceTargeting = (targeting as { deviceTargeting?: string[] }).deviceTargeting ?? [];
  const bidStrategy = (targeting as { bidStrategy?: string }).bidStrategy ?? 'Auto';
  const negativeKeywords = (targeting as { negativeKeywords?: string[] }).negativeKeywords ?? [];
  const optimizationGoal = (targeting as { optimizationGoal?: string }).optimizationGoal;
  const conversionEvent = (targeting as { conversionEvent?: string }).conversionEvent;

  const items: { icon: React.ReactNode; label: string; value: string | string[] }[] = [
    {
      icon: <PinIcon className="size-5 text-[#6a7282]" />,
      label: 'LOCATION',
      value: locations.length > 0 ? locations : 'All locations'
    },
    {
      icon: <UserRoundIcon className="size-5 text-[#6a7282]" />,
      label: 'AGE & GENDER',
      value: `${targeting.ageRange} • ${targeting.gender}`
    },
    {
      icon: <PhoneIcon className="size-5 text-[#6a7282]" />,
      label: 'DEVICE TARGETING',
      value: deviceTargeting.length > 0 ? deviceTargeting : 'All devices'
    },
    {
      icon: <GlobeIcon className="size-5 text-[#6a7282]" />,
      label: 'LANGUAGE',
      value: targeting.languages.length > 0 ? targeting.languages : 'All languages'
    },
  ];

  const expandedItems: { icon: React.ReactNode; label: string; value: string | string[] }[] = [];
  if (keywords.length > 0) {
    expandedItems.push({ icon: <SearchIcon className="size-5 text-[#6a7282]" />, label: 'KEYWORDS', value: keywords });
  }
  if (negativeKeywords.length > 0) {
    expandedItems.push({ icon: <SearchIcon className="size-5 text-[#6a7282]" />, label: 'NEGATIVE KEYWORDS', value: negativeKeywords });
  }
  if (interests.length > 0) {
    expandedItems.push({ icon: <SparklesIcon className="size-5 text-[#6a7282]" />, label: 'INTERESTS', value: interests });
  }
  if (optimizationGoal) {
    expandedItems.push({ icon: <ZapIcon className="size-5 text-[#6a7282]" />, label: 'OPTIMIZATION GOAL', value: optimizationGoal });
  }
  if (conversionEvent) {
    expandedItems.push({ icon: <ZapIcon className="size-5 text-[#6a7282]" />, label: 'CONVERSION EVENT', value: conversionEvent });
  }
  expandedItems.push({ icon: <ZapIcon className="size-5 text-[#6a7282]" />, label: 'BID STRATEGY', value: bidStrategy });

  return (
    <div className="pb-6">
      <div className="space-y-1">
        {items.map((item, idx) => (
          <TargetingRow key={idx} icon={item.icon} label={item.label} value={item.value} />
        ))}
      </div>

      {expandedItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 mt-3 text-sm font-medium text-[#1677ff] hover:underline"
          >
            {expanded ? 'View less' : 'View more details'}
            <ArrowRightIcon className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {expandedItems.map((item, idx) => (
                <TargetingRow key={idx} icon={item.icon} label={item.label} value={item.value} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TargetingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | string[] }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const isArray = Array.isArray(value);
  const displayValue = isArray
    ? (expanded ? value : value.slice(0, 6)).join(' • ')
    : value;
  const hasMore = isArray && value.length > 6;

  return (
    <div className="flex items-start gap-3 p-4 rounded-[10px] hover:bg-gray-50 transition-colors">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#6a7282] leading-4 mb-1">{label}</p>
        <p className="text-sm text-[#101828] leading-5 break-words">
          {displayValue}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="ml-1.5 text-xs font-medium text-[#1677ff] hover:underline"
            >
              {expanded ? 'View less' : `View more (${value.length - 5} more)`}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Creatives Tab ─────────────────────────────────────────────────────────────

function CreativesTab({
  ads,
  adType,
  platform,
  destinationUrl
}: {
  ads: AdCreative[];
  adType: string;
  platform: string;
  destinationUrl: string;
}): React.JSX.Element {
  const isSearch = adType.toLowerCase().includes('search');
  const isStories = adType.toLowerCase().includes('stories') || adType.toLowerCase().includes('reels');

  if (ads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ImageIcon className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">No creatives yet</p>
      </div>
    );
  }

  if (isSearch) {
    const domain = (() => {
      try {
        return new URL(destinationUrl.startsWith('http') ? destinationUrl : `https://${destinationUrl}`).hostname.replace('www.', '');
      } catch { return destinationUrl; }
    })();

    return (
      <div className="space-y-3">
        <div className="rounded-lg p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-zinc-700">
            {platform === 'bing' ? <MicrosoftIcon /> : <GoogleIcon />}
            <span className="text-xs text-gray-500">{platform === 'bing' ? 'Bing' : 'Google'} Search Preview</span>
          </div>
          {ads.slice(0, 3).map((ad, idx) => {
            const headlines = ad.headlines.slice(0, 3);
            const description = ad.descriptions[0] ?? '';
            return (
              <div key={ad.id || idx} className={cn('space-y-0.5', idx > 0 && 'mt-4 pt-4 border-t border-gray-100 dark:border-zinc-700')}>
                <div className="flex items-center gap-1.5">
                  <span className="rounded border border-gray-400 dark:border-zinc-500 px-1 py-0.5 text-[9px] font-medium text-gray-600 dark:text-zinc-400 leading-none">Ad</span>
                  <span className="text-xs text-gray-600 dark:text-zinc-400 truncate">{domain} › {adTypeLabel(adType)}</span>
                </div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer leading-snug">
                  {headlines.join(' | ')}
                </p>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed line-clamp-2">{description}</p>
                {idx === 0 && (
                  <div className="flex gap-3 mt-1">
                    {['Shop Now', 'New Arrivals', 'Sale', 'About Us'].map((link) => (
                      <span key={link} className="text-xs text-blue-700 dark:text-blue-400 hover:underline cursor-pointer">{link}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-center text-muted-foreground">
          Responsive Search Ad · {ads[0]?.headlines.length ?? 0} headlines · {ads[0]?.descriptions.length ?? 0} descriptions
        </p>
      </div>
    );
  }

  if (isStories) {
    return (
      <div className="space-y-3">
        {ads.slice(0, 3).map((ad, idx) => (
          <StoriesCreativeCard key={ad.id || idx} ad={ad} adType={adType} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ads.slice(0, 3).map((ad, idx) => (
        <CreativeCard key={ad.id || idx} ad={ad} adType={adType} />
      ))}
    </div>
  );
}

function CreativeCard({ ad, adType }: { ad: AdCreative; adType: string }): React.JSX.Element {
  const headline = ad.headlines[0] ?? 'No headline';
  const description = ad.descriptions[0] ?? 'No description';
  const imageUrl = ad.imageUrls[0];
  const domain = (() => {
    try { return new URL(ad.destinationUrl.startsWith('http') ? ad.destinationUrl : `https://${ad.destinationUrl}`).hostname.replace('www.', ''); }
    catch { return ad.destinationUrl; }
  })();
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="relative h-40 bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={headline} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-1">
            <ImageIcon className="size-8 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/60">Image generating...</span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {adTypeLabel(adType)}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground line-clamp-1">{headline}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">Ad · {domain}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{ad.ctaText}</span>
        </div>
      </div>
    </div>
  );
}

function StoriesCreativeCard({ ad, adType }: { ad: AdCreative; adType: string }): React.JSX.Element {
  const headline = ad.headlines[0] ?? 'No headline';
  const imageUrl = ad.imageUrls[0];
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden mx-auto" style={{ maxWidth: 200 }}>
      <div className="relative bg-muted" style={{ aspectRatio: '9/16' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={headline} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-1">
            <ImageIcon className="size-6 text-muted-foreground/40" />
            <span className="text-[9px] text-muted-foreground/60">9:16 image</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-xs font-semibold text-white line-clamp-2">{headline}</p>
          <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white">{ad.ctaText}</span>
        </div>
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {adTypeLabel(adType)}
        </span>
      </div>
    </div>
  );
}
