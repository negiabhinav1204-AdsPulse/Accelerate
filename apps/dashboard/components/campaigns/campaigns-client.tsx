'use client';

import * as React from 'react';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import { useRole } from '~/hooks/use-role';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdGroupItem = {
  id: string;
  name: string;
  adType: string;
  status: string;
};

type PlatformCampaignItem = {
  id: string;
  platform: string;
  status: string;
  budget: number;
  currency: string;
  platformCampaignId: string | null;
  adGroups: AdGroupItem[];
};

type CampaignListItem = {
  id: string;
  acceId: string | null;
  name: string;
  source: 'accelerate' | 'external';
  objective: string;
  status: string | null;
  totalBudget: number;
  currency: string;
  updatedAt: string;
  platformCampaigns: PlatformCampaignItem[];
  platformCampaignId?: string;
  adAccountId?: string;
};

type FilterState = {
  search: string;
  source: 'all' | 'accelerate' | 'external';
  platform: string;
  status: string;
  objective: string;
  dateRange: '1' | '7' | '15' | '30' | 'custom' | 'all';
};

// ---------------------------------------------------------------------------
// (Mock data removed — real data fetched from API)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBudget(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: 'narrowSymbol'
  }).format(amount);
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

function getDeepLink(platform: string, platformCampaignId: string | null): string | null {
  if (!platformCampaignId) return null;
  if (platform === 'google') {
    return `https://ads.google.com/aw/campaigns?campaignId=${platformCampaignId}`;
  }
  if (platform === 'meta') {
    return 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
  }
  if (platform === 'bing') {
    return 'https://ui.ads.microsoft.com/campaign/vnext/campaigns';
  }
  return null;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'xs' }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    google: { bg: 'bg-[#4285F4]', text: 'text-white', label: 'G' },
    meta: { bg: 'bg-[#0866FF]', text: 'text-white', label: 'M' },
    bing: { bg: 'bg-[#00809D]', text: 'text-white', label: 'B' },
    tiktok: { bg: 'bg-black', text: 'text-white', label: 'T' },
    linkedin: { bg: 'bg-[#0A66C2]', text: 'text-white', label: 'in' },
    reddit: { bg: 'bg-[#FF4500]', text: 'text-white', label: 'R' }
  };
  const c = config[platform] ?? { bg: 'bg-gray-400', text: 'text-white', label: '?' };
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm font-bold leading-none select-none',
        c.bg,
        c.text,
        size === 'xs' ? 'size-4 text-[8px]' : 'size-5 text-[9px]'
      )}
      title={getPlatformLabel(platform)}
    >
      {c.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    live: 'bg-green-500',
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    failed: 'bg-red-500',
    ended: 'bg-gray-400',
    draft: 'bg-gray-300',
    reviewing: 'bg-gray-300'
  };
  const color = colorMap[status] ?? 'bg-gray-300';
  return <span className={cn('inline-block size-1.5 rounded-full shrink-0', color)} />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    live: { cls: 'bg-green-50 text-green-700 border border-green-200', label: 'Active' },
    active: { cls: 'bg-green-50 text-green-700 border border-green-200', label: 'Active' },
    paused: { cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: 'Paused' },
    failed: { cls: 'bg-red-50 text-red-700 border border-red-200', label: 'Failed' },
    ended: { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Ended' },
    draft: { cls: 'bg-gray-50 text-gray-500 border border-gray-200', label: 'Draft' },
    reviewing: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Reviewing' }
  };
  const c = config[status] ?? { cls: 'bg-gray-50 text-gray-500 border border-gray-200', label: toTitleCase(status) };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', c.cls)}>
      {c.label}
    </span>
  );
}

function AdTypeBadge({ adType }: { adType: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
      {adType}
    </span>
  );
}

// Simple dropdown menu implementation without external dependency issues
function DropdownMenu({
  trigger,
  children
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-lg py-1"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  variant = 'default',
  href,
  target
}: {
  onClick?: () => void;
  icon?: React.ReactNode;
  label: string;
  variant?: 'default' | 'destructive';
  href?: string;
  target?: string;
}) {
  const cls = cn(
    'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors hover:bg-muted cursor-pointer',
    variant === 'destructive' ? 'text-red-600' : 'text-foreground'
  );

  if (href) {
    return (
      <a href={href} target={target} rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 border-t border-border" />;
}

// Simple Select component
function Select({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
    >
      {placeholder && (
        <option value="">{placeholder}</option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampaignListClient({ orgSlug, orgId }: { orgSlug: string; orgId: string }) {
  const { permissions } = useRole();
  const [campaigns, setCampaigns] = React.useState<CampaignListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showBanner, setShowBanner] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const perPage = 10;

  React.useEffect(() => {
    void loadCampaigns();
  }, [orgId]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const [internalRes, externalRes] = await Promise.all([
        fetch(`/api/campaigns?orgId=${orgId}&perPage=100`),
        fetch(`/api/campaigns/external?orgId=${orgId}`)
      ]);
      const internalData = internalRes.ok ? await internalRes.json() : { campaigns: [] };
      const externalData = externalRes.ok ? await externalRes.json() : { campaigns: [], lastSyncAt: null };

      const merged = [
        ...(internalData.campaigns as CampaignListItem[]),
        ...(externalData.campaigns as CampaignListItem[])
      ];
      setCampaigns(merged);
      if (externalData.lastSyncAt) setLastSyncAt(externalData.lastSyncAt as string);
    } catch {
      // keep empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      await loadCampaigns();
    } finally {
      setSyncing(false);
    }
  }

  async function handleStatusChange(c: CampaignListItem, action: 'pause' | 'resume') {
    const platformCampaignId = c.source === 'external'
      ? (c.platformCampaignId ?? c.platformCampaigns[0]?.platformCampaignId ?? '')
      : (c.platformCampaigns[0]?.platformCampaignId ?? '');
    const adAccountId = c.adAccountId ?? '';
    const platform = c.platformCampaigns[0]?.platform ?? 'meta';

    await fetch(`/api/campaigns/${c.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, source: c.source, platform, platformCampaignId, adAccountId, orgId })
    });
    await loadCampaigns();
  }

  const [filters, setFilters] = React.useState<FilterState>({
    search: '',
    source: 'all',
    platform: '',
    status: '',
    objective: '',
    dateRange: 'all'
  });

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const filteredCampaigns = React.useMemo(() => {
    return campaigns.filter((c) => {
      // Archived check (safety — won't exist in mock)
      if ((c as CampaignListItem & { archivedAt?: string }).archivedAt) return false;

      if (filters.source !== 'all' && c.source !== filters.source) return false;

      if (filters.platform && filters.platform !== 'all') {
        const hasPlatform = c.platformCampaigns.some((pc) => pc.platform === filters.platform);
        if (!hasPlatform) return false;
      }

      if (filters.status && filters.status !== 'all') {
        if (c.source === 'external') {
          if (c.status !== filters.status) return false;
        } else {
          const hasStatus = c.platformCampaigns.some((pc) => pc.status === filters.status);
          if (!hasStatus) return false;
        }
      }

      if (filters.objective && filters.objective !== 'all') {
        if (c.objective.toUpperCase() !== filters.objective.toUpperCase()) return false;
      }

      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.acceId?.toLowerCase().includes(q)) return false;
      }

      if (filters.dateRange && filters.dateRange !== 'all') {
        const days =
          filters.dateRange === '1'
            ? 1
            : filters.dateRange === '7'
            ? 7
            : filters.dateRange === '15'
            ? 15
            : 30;
        const cutoff =
          filters.dateRange === '1'
            ? new Date(new Date().setHours(0, 0, 0, 0))
            : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        if (new Date(c.updatedAt) < cutoff) return false;
      }

      return true;
    });
  }, [campaigns, filters]);

  const pagedCampaigns = React.useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredCampaigns.slice(start, start + perPage);
  }, [filteredCampaigns, page]);

  const totalPages = Math.ceil(filteredCampaigns.length / perPage);

  const failedCount = React.useMemo(
    () =>
      campaigns.filter(
        (c) =>
          c.status === 'failed' ||
          c.platformCampaigns.some((pc) => pc.status === 'failed')
      ).length,
    [campaigns]
  );

  const allSelected =
    filteredCampaigns.length > 0 &&
    filteredCampaigns.every((c) => selected.has(c.id));

  const hasActiveFilters =
    filters.source !== 'all' ||
    filters.platform !== '' ||
    filters.status !== '' ||
    filters.objective !== '' ||
    filters.dateRange !== 'all';

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCampaigns.map((c) => c.id)));
    }
  }

  function clearFilters() {
    setFilters({
      search: '',
      source: 'all',
      platform: '',
      status: '',
      objective: '',
      dateRange: 'all'
    });
    setPage(1);
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function exportCsv() {
    const rows = filteredCampaigns
      .filter((c) => selected.has(c.id))
      .map((c) => {
        const platforms = [...new Set(c.platformCampaigns.map((pc) => getPlatformLabel(pc.platform)))].join('; ');
        const status =
          c.source === 'accelerate'
            ? c.platformCampaigns.map((pc) => pc.status).join('; ')
            : (c.status ?? '');
        return [
          `"${c.name.replace(/"/g, '""')}"`,
          `"${c.acceId ?? ''}"`,
          `"${c.source}"`,
          `"${toTitleCase(c.objective)}"`,
          `"${status}"`,
          `"${formatBudget(c.totalBudget, c.currency)}"`,
          `"${platforms}"`,
          `"${timeAgo(c.updatedAt)}"`
        ].join(',');
      });

    const csv = [
      '"Campaign Name","ACCE ID","Source","Objective","Status","Budget","Platforms","Last Edited"',
      ...rows
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaigns.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Determine pause/resume action for accelerate campaign row
  function getCampaignAction(c: CampaignListItem): 'pause' | 'resume' | null {
    if (c.source === 'external') {
      if (c.status === 'live') return 'pause';
      if (c.status === 'paused') return 'resume';
      return null;
    }
    const hasLive = c.platformCampaigns.some((pc) => pc.status === 'live');
    const allPaused = c.platformCampaigns.every((pc) => pc.status === 'paused');
    if (hasLive) return 'pause';
    if (allPaused) return 'resume';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderAdGroupRow(ag: AdGroupItem, indent: string) {
    return (
      <tr key={ag.id} className="border-b border-border last:border-0 bg-muted/10 hover:bg-muted/20 transition-colors">
        <td className={cn('py-2 pr-2', indent)}>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground font-bold">
              AG
            </span>
            <span className="text-xs text-foreground truncate max-w-[220px]">{ag.name}</span>
          </div>
        </td>
        <td className="px-2 py-2">
          {/* source — blank */}
        </td>
        <td className="px-2 py-2">
          {/* objective — blank */}
        </td>
        <td className="px-2 py-2">
          <StatusBadge status={ag.status} />
        </td>
        <td className="px-2 py-2">
          {/* budget — blank */}
        </td>
        <td className="px-2 py-2">
          <AdTypeBadge adType={ag.adType} />
        </td>
        <td className="px-2 py-2">
          {/* last edited — blank */}
        </td>
        <td className="px-2 py-2">
          {/* actions — blank */}
        </td>
        <td className="px-2 py-2">
          {/* checkbox — blank */}
        </td>
      </tr>
    );
  }

  function renderPlatformCampaignRow(pc: PlatformCampaignItem, parentId: string) {
    const rowId = `${parentId}-${pc.id}`;
    const isExpanded = expanded.has(rowId);
    const deepLink = getDeepLink(pc.platform, pc.platformCampaignId);

    return (
      <React.Fragment key={pc.id}>
        <tr className="border-b border-border last:border-0 bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
          <td className="pl-8 pr-2 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleExpand(rowId)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-3.5" />
                ) : (
                  <ChevronRightIcon className="size-3.5" />
                )}
              </button>
              <PlatformIcon platform={pc.platform} />
              <span className="text-xs font-medium text-foreground">{getPlatformLabel(pc.platform)}</span>
            </div>
          </td>
          <td className="px-2 py-2.5">
            {/* source — blank */}
          </td>
          <td className="px-2 py-2.5">
            {/* objective — blank */}
          </td>
          <td className="px-2 py-2.5">
            <StatusBadge status={pc.status} />
          </td>
          <td className="px-2 py-2.5">
            <span className="text-xs text-foreground">{formatBudget(pc.budget, pc.currency)}</span>
          </td>
          <td className="px-2 py-2.5">
            <PlatformIcon platform={pc.platform} size="xs" />
          </td>
          <td className="px-2 py-2.5">
            {/* last edited — blank */}
          </td>
          <td className="px-2 py-2.5">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-6 rounded hover:bg-muted text-muted-foreground transition-colors"
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </button>
              }
            >
              {deepLink && (
                <MenuItem
                  href={deepLink}
                  target="_blank"
                  icon={<ExternalLinkIcon className="size-3" />}
                  label={`View in ${getPlatformLabel(pc.platform)}`}
                />
              )}
              {(pc.status === 'live' || pc.status === 'paused') && (
                <MenuItem
                  icon={pc.status === 'live' ? <PauseIcon className="size-3" /> : <PlayIcon className="size-3" />}
                  label={pc.status === 'live' ? 'Pause' : 'Resume'}
                  onClick={() => {/* platform-level status change via parent campaign */}}
                />
              )}
            </DropdownMenu>
          </td>
          <td className="px-2 py-2.5">
            {/* checkbox — blank (platform rows not selectable) */}
          </td>
        </tr>

        {isExpanded &&
          pc.adGroups.map((ag) => renderAdGroupRow(ag, 'pl-16 pr-2 py-2'))}
      </React.Fragment>
    );
  }

  function renderCampaignRow(c: CampaignListItem) {
    const isExpanded = expanded.has(c.id);
    const isSelected = selected.has(c.id);
    const campaignAction = getCampaignAction(c);
    const uniquePlatforms = [...new Set(c.platformCampaigns.map((pc) => pc.platform))];
    const singlePlatformDeepLink =
      c.source === 'external' && c.platformCampaigns.length === 1
        ? getDeepLink(c.platformCampaigns[0].platform, c.platformCampaigns[0].platformCampaignId)
        : null;

    return (
      <React.Fragment key={c.id}>
        <tr
          className={cn(
            'border-b border-border last:border-0 transition-colors',
            isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
          )}
        >
          {/* Expand chevron + Name */}
          <td className="pl-3 pr-2 py-3">
            <div className="flex items-center gap-2">
              {c.source === 'accelerate' ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                </button>
              )}

              {c.source === 'accelerate' ? (
                <MegaphoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0">
                <a
                  href={`/organizations/${orgSlug}/campaigns/${
                    c.source === 'external'
                      ? (c.platformCampaigns[0]?.platformCampaignId ?? c.id)
                      : c.id
                  }?source=${c.source}&platform=${c.platformCampaigns[0]?.platform ?? 'meta'}&orgId=${orgId}`}
                  className="text-sm font-semibold text-foreground hover:text-primary truncate max-w-[240px] block"
                >
                  {c.name}
                </a>
                {c.acceId && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.acceId}</p>
                )}
              </div>
            </div>
          </td>

          {/* Source */}
          <td className="px-2 py-3">
            {c.source === 'accelerate' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
                Internal
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
                External
              </span>
            )}
          </td>

          {/* Objective */}
          <td className="px-2 py-3">
            <span className="text-xs text-foreground">{toTitleCase(c.objective)}</span>
          </td>

          {/* Status */}
          <td className="px-2 py-3">
            {c.source === 'external' && c.status ? (
              <StatusBadge status={c.status} />
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.platformCampaigns.map((pc) => (
                  <div key={pc.id} className="relative inline-flex">
                    <PlatformIcon platform={pc.platform} size="xs" />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot status={pc.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>

          {/* Budget */}
          <td className="px-2 py-3">
            <span className="text-xs font-medium text-foreground">
              {formatBudget(c.totalBudget, c.currency)}
            </span>
          </td>

          {/* Platforms */}
          <td className="px-2 py-3">
            <div className="flex items-center gap-1">
              {uniquePlatforms.map((p) => (
                <PlatformIcon key={p} platform={p} size="xs" />
              ))}
            </div>
          </td>

          {/* Last edited */}
          <td className="px-2 py-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(c.updatedAt)}</span>
          </td>

          {/* Actions */}
          <td className="px-2 py-3">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-7 rounded hover:bg-muted text-muted-foreground transition-colors"
                >
                  <MoreHorizontalIcon className="size-4" />
                </button>
              }
            >
              {permissions.canManageCampaigns && campaignAction === 'pause' && (
                <MenuItem
                  icon={<PauseIcon className="size-3" />}
                  label="Pause"
                  onClick={() => void handleStatusChange(c, 'pause')}
                />
              )}
              {permissions.canManageCampaigns && campaignAction === 'resume' && (
                <MenuItem
                  icon={<PlayIcon className="size-3" />}
                  label="Resume"
                  onClick={() => void handleStatusChange(c, 'resume')}
                />
              )}
              {permissions.canManageCampaigns && (
                <MenuItem
                  icon={<span className="size-3 inline-block" />}
                  label="Edit"
                  href={`/organizations/${orgSlug}/campaign/${c.id}/edit`}
                />
              )}
              {permissions.canManageCampaigns && (
                <MenuItem
                  icon={<CopyIcon className="size-3" />}
                  label="Duplicate"
                  onClick={() => {/* placeholder */}}
                />
              )}
              {singlePlatformDeepLink && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    href={singlePlatformDeepLink}
                    target="_blank"
                    icon={<ExternalLinkIcon className="size-3" />}
                    label={`View in ${getPlatformLabel(c.platformCampaigns[0].platform)}`}
                  />
                </>
              )}
              {permissions.canManageCampaigns && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    icon={<Trash2Icon className="size-3" />}
                    label="Archive"
                    variant="destructive"
                    onClick={() => {/* placeholder */}}
                  />
                </>
              )}
            </DropdownMenu>
          </td>

          {/* Checkbox */}
          <td className="pr-3 pl-2 py-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(c.id)}
              className="size-4 rounded border-border text-primary cursor-pointer"
              aria-label={`Select ${c.name}`}
            />
          </td>
        </tr>

        {/* Expanded rows */}
        {isExpanded && c.source === 'accelerate' &&
          c.platformCampaigns.map((pc) => renderPlatformCampaignRow(pc, c.id))}

        {isExpanded && c.source === 'external' &&
          c.platformCampaigns.flatMap((pc) =>
            pc.adGroups.map((ag) => renderAdGroupRow(ag, 'pl-8 pr-2 py-2'))
          )}
      </React.Fragment>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const fromIdx = Math.min((page - 1) * perPage + 1, filteredCampaigns.length);
  const toIdx = Math.min(page * perPage, filteredCampaigns.length);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Loading campaigns...</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified view of internal and external campaigns
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastSyncAt && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Last synced {timeAgo(lastSyncAt)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="inline-flex items-center justify-center size-8 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title={syncing ? 'Syncing...' : 'Sync now'}
          >
            <RefreshCwIcon className={cn('size-4', syncing && 'animate-spin')} />
          </button>
          {permissions.canManageCampaigns && (
            <a
              href={`/organizations/${orgSlug}/create-campaign`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusIcon className="size-4" />
              Create New
            </a>
          )}
        </div>
      </div>

      {/* Error banner */}
      {showBanner && failedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span>
              {failedCount} campaign{failedCount > 1 ? 's' : ''} have errors. Review and resolve to resume delivery.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="shrink-0 text-red-500 hover:text-red-700 transition-colors"
            aria-label="Dismiss"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {/* Filter bar — row 1 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Select
          value={filters.source}
          onChange={(v) => updateFilter('source', v as FilterState['source'])}
          options={[
            { value: 'all', label: 'All Sources' },
            { value: 'accelerate', label: 'Internal (Accelerate)' },
            { value: 'external', label: 'External' }
          ]}
        />

        <Select
          value={filters.dateRange}
          onChange={(v) => updateFilter('dateRange', v as FilterState['dateRange'])}
          options={[
            { value: 'all', label: 'All Time' },
            { value: '1', label: 'Today' },
            { value: '7', label: 'Last 7 Days' },
            { value: '15', label: 'Last 15 Days' },
            { value: '30', label: 'Last 30 Days' }
          ]}
        />
      </div>

      {/* Filter bar — row 2 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={filters.platform}
          onChange={(v) => updateFilter('platform', v)}
          placeholder="All Platforms"
          options={[
            { value: 'all', label: 'All Platforms' },
            { value: 'google', label: 'Google Ads' },
            { value: 'meta', label: 'Meta Ads' },
            { value: 'bing', label: 'Microsoft Ads' },
            { value: 'tiktok', label: 'TikTok Ads' },
            { value: 'linkedin', label: 'LinkedIn Ads' },
            { value: 'reddit', label: 'Reddit Ads' }
          ]}
        />

        <Select
          value={filters.objective}
          onChange={(v) => updateFilter('objective', v)}
          placeholder="All Objectives"
          options={[
            { value: 'all', label: 'All Objectives' },
            { value: 'CONVERSIONS', label: 'Conversions' },
            { value: 'AWARENESS', label: 'Awareness' },
            { value: 'TRAFFIC', label: 'Traffic' },
            { value: 'LEADS', label: 'Leads' },
            { value: 'ENGAGEMENT', label: 'Engagement' }
          ]}
        />

        <Select
          value={filters.status}
          onChange={(v) => updateFilter('status', v)}
          placeholder="All Statuses"
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'live', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'ended', label: 'Ended' },
            { value: 'failed', label: 'Failed' }
          ]}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table header row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground">
            Campaign list{' '}
            <span className="text-muted-foreground font-normal">({filteredCampaigns.length})</span>
          </h2>
          <button
            type="button"
            onClick={exportCsv}
            disabled={selected.size === 0}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              selected.size > 0
                ? 'text-foreground border border-border hover:bg-muted'
                : 'text-muted-foreground/40 border border-border/40 cursor-not-allowed'
            )}
          >
            <DownloadIcon className="size-3" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left pl-3 pr-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[260px]">
                  Campaign
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[90px]">
                  Source
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[110px]">
                  Objective
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[120px]">
                  Status
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[90px]">
                  Budget
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[90px]">
                  Platforms
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[90px]">
                  Last edited
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap w-[40px]">
                  {/* Actions */}
                </th>
                <th className="text-right pr-3 pl-2 py-2.5 w-[40px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-border text-primary cursor-pointer"
                    aria-label="Select all campaigns"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                    No campaigns match your filters.
                  </td>
                </tr>
              ) : (
                pagedCampaigns.map(renderCampaignRow)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredCampaigns.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {fromIdx}–{toIdx} of {filteredCampaigns.length}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  page === 1
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    'size-7 rounded text-xs font-medium transition-colors',
                    p === page
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  page === totalPages || totalPages === 0
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                Next
              </button>

              <span className="ml-2 text-xs text-muted-foreground">10 / page</span>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-card shadow-xl px-5 py-3">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {selected.size} campaign{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors text-foreground"
            onClick={() => {/* placeholder bulk pause */}}
          >
            <PauseIcon className="size-3" />
            Pause All
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => {/* placeholder bulk archive */}}
          >
            <Trash2Icon className="size-3" />
            Archive All
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors text-foreground"
            onClick={exportCsv}
          >
            <DownloadIcon className="size-3" />
            Export CSV
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center size-7 rounded hover:bg-muted text-muted-foreground transition-colors"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
