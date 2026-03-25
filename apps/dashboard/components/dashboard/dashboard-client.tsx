'use client';

import * as React from 'react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  GripVerticalIcon,
  Loader2Icon,
  Maximize2Icon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrendingUpIcon,
  WalletIcon,
  BarChart3Icon,
  MousePointerClickIcon,
  XIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@workspace/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@workspace/ui/components/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@workspace/ui/components/popover';
import { cn } from '@workspace/ui/lib/utils';

// ── Date range types ──────────────────────────────────────────────────────────

type DateRangeKey = 'today' | '7d' | '15d' | '30d' | 'year' | 'custom';

const DATE_FILTERS: { label: string; value: DateRangeKey }[] = [
  { label: 'Today', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '15D', value: '15d' },
  { label: '30D', value: '30d' },
  { label: 'Year', value: 'year' },
  { label: 'Custom', value: 'custom' }
];

// ── Reporting data types ──────────────────────────────────────────────────────

type DailyMetric = { date: string; spend: number; impressions: number; clicks: number; conversions: number };
type PerCampaign = { campaignId: string; campaignName: string; spend: number; impressions: number; clicks: number; conversions: number };
type AgeGenderItem = { age: string; female: number; male: number; others: number };
type PlatformItem = { region: string; conversions: number };

type ReportingData = {
  dailyMetrics: DailyMetric[];
  summaryTotals: { spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; roas: number };
  perCampaign: PerCampaign[];
  ageGender: AgeGenderItem[];
  platformBreakdown: PlatformItem[];
  lastSyncAt: string | null;
};

// ── Chart registry ────────────────────────────────────────────────────────────

type ChartId = 'spend-conversions' | 'geography' | 'age-gender' | 'top-campaigns';

const CHART_META: Record<ChartId, { title: string; subtitle: string }> = {
  'spend-conversions': { title: 'Spend vs. Conversions', subtitle: 'Multi-axis view showing spend and conversion correlation' },
  geography: { title: 'Platform Breakdown', subtitle: 'Clicks by publisher platform and placement' },
  'age-gender': { title: 'Age and Gender Breakdown', subtitle: 'Conversion statistics by demographic' },
  'top-campaigns': { title: 'Top Performing Campaigns', subtitle: 'Ad campaign ranking with +70 conversions' }
};

const DEFAULT_CHARTS: ChartId[] = ['spend-conversions', 'geography', 'age-gender', 'top-campaigns'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function formatDateLabel(dateStr: string, range: DateRangeKey): string {
  const d = new Date(dateStr);
  if (range === 'today') return d.toLocaleDateString('en-US', { hour: '2-digit' });
  if (range === 'year') return d.toLocaleDateString('en-US', { month: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  icon: Icon
}: {
  label: string;
  value: string;
  change?: number;
  icon: React.ElementType;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {change !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
          {change >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({
  id,
  title,
  subtitle,
  onRemove,
  onExpand,
  children,
  fullWidth = false
}: {
  id: ChartId;
  title: string;
  subtitle: string;
  onRemove: (id: ChartId) => void;
  onExpand: (id: ChartId) => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-4', fullWidth && 'col-span-full')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0">
          <GripVerticalIcon className="size-4 text-muted-foreground/50 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onExpand(id)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Expand"
          >
            <Maximize2Icon className="size-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="More options">
                <MoreHorizontalIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onExpand(id)}>
                Expand
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 dark:text-red-400"
                onClick={() => onRemove(id)}
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Individual charts ─────────────────────────────────────────────────────────

function SpendConversionsChart({ data }: { data: { label: string; spend: number; conversions: number }[] }): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatNumber(v)} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(value: number, name: string) => [name === 'spend' ? formatCurrency(value) : value, name === 'spend' ? 'Total Spend' : 'Total Conversions']}
        />
        <Legend iconType="circle" iconSize={8} formatter={(v) => v === 'spend' ? 'Total Spend' : 'Total Conversions'} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} activeDot={{ r: 6 }} />
        <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function GeographyChart({ data }: { data: { region: string; conversions: number }[] }): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
        <XAxis dataKey="region" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: 'hsl(var(--accent))' }}
        />
        <Bar dataKey="conversions" fill="#93AECF" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AgeGenderChart({ data }: { data: { age: string; female: number; male: number; others: number }[] }): React.JSX.Element {
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: 'hsl(var(--accent))' }}
          />
          <Bar dataKey="female" stackId="a" fill="#F9A8C9" />
          <Bar dataKey="male" stackId="a" fill="#93AECF" />
          <Bar dataKey="others" stackId="a" fill="#FCD34D" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-1">
        {[{ color: '#F9A8C9', label: 'Female' }, { color: '#93AECF', label: 'Male' }, { color: '#FCD34D', label: 'Others' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TopCampaignsTable({ data }: { data: { name: string; conversions: number; change: number }[] }): React.JSX.Element {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 pb-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Campaign</span>
        <span className="text-xs font-medium text-muted-foreground">Conversions</span>
        <span className="text-xs font-medium text-muted-foreground">Change</span>
      </div>
      <div className="divide-y divide-border/50">
        {data.map((row) => (
          <div key={row.name} className="grid grid-cols-[1fr_auto_auto] gap-x-3 py-2.5 items-center">
            <span className="text-sm text-foreground truncate">{row.name}</span>
            <span className="text-sm font-semibold text-foreground bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-center min-w-[2.5rem]">
              {row.conversions}
            </span>
            <span className={cn('text-xs font-medium', row.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
              {row.change >= 0 ? '+' : ''}{row.change}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded chart modal ──────────────────────────────────────────────────────

function ExpandedChartModal({
  chartId,
  onClose,
  spendConversions,
  geography,
  ageGender,
  topCampaigns
}: {
  chartId: ChartId | null;
  onClose: () => void;
  spendConversions: { label: string; spend: number; conversions: number }[];
  geography: { region: string; conversions: number }[];
  ageGender: { age: string; female: number; male: number; others: number }[];
  topCampaigns: { name: string; conversions: number; change: number }[];
}): React.JSX.Element | null {
  if (!chartId) return null;
  const meta = CHART_META[chartId];

  return (
    <Dialog open={!!chartId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </DialogHeader>
        <div className="mt-2">
          {chartId === 'spend-conversions' && <SpendConversionsChart data={spendConversions} />}
          {chartId === 'geography' && (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={geography} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} cursor={{ fill: 'hsl(var(--accent))' }} />
                <Bar dataKey="conversions" fill="#93AECF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartId === 'age-gender' && (
            <div className="space-y-3">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageGender} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                  <XAxis dataKey="age" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar dataKey="female" stackId="a" fill="#F9A8C9" />
                  <Bar dataKey="male" stackId="a" fill="#93AECF" />
                  <Bar dataKey="others" stackId="a" fill="#FCD34D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4">
                {[{ color: '#F9A8C9', label: 'Female' }, { color: '#93AECF', label: 'Male' }, { color: '#FCD34D', label: 'Others' }].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {chartId === 'top-campaigns' && (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 pb-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground">Campaign</span>
                <span className="text-sm font-medium text-muted-foreground">Conversions</span>
                <span className="text-sm font-medium text-muted-foreground">Change</span>
              </div>
              {topCampaigns.map((row) => (
                <div key={row.name} className="grid grid-cols-[1fr_auto_auto] gap-x-6 py-3 items-center">
                  <span className="text-sm text-foreground">{row.name}</span>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded text-center">
                    {row.conversions}
                  </span>
                  <span className={cn('text-sm font-medium', row.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                    {row.change >= 0 ? '+' : ''}{row.change}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add view picker ───────────────────────────────────────────────────────────

function AddViewPicker({
  removedCharts,
  onAdd
}: {
  removedCharts: ChartId[];
  onAdd: (id: ChartId) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  if (removedCharts.length === 0) return <></>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Add View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <div className="space-y-0.5">
          {removedCharts.map((id) => (
            <button
              key={id}
              onClick={() => { onAdd(id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent text-left transition-colors"
            >
              <PlusIcon className="size-3.5 text-muted-foreground" />
              {CHART_META[id].title}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({ orgId }: { orgId: string }): React.JSX.Element {
  // state
  const [activeRange, setActiveRange] = React.useState<DateRangeKey>('7d');
  const [activeCharts, setActiveCharts] = React.useState<ChartId[]>([...DEFAULT_CHARTS]);
  const [expandedChart, setExpandedChart] = React.useState<ChartId | null>(null);
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ReportingData | null>(null);

  // fetch on range/custom date change
  React.useEffect(() => {
    void fetchData();
  }, [activeRange, customFrom, customTo]);

  async function fetchData() {
    setLoading(true);
    try {
      let url = `/api/reporting?orgId=${orgId}`;
      if (activeRange === 'today') {
        const today = new Date().toISOString().split('T')[0];
        url += `&dateRange=custom&dateFrom=${today}&dateTo=${today}`;
      } else if (activeRange === 'year') {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        url += `&dateRange=custom&dateFrom=${from}&dateTo=${to}`;
      } else if (activeRange === 'custom' && customFrom && customTo) {
        url += `&dateRange=custom&dateFrom=${customFrom}&dateTo=${customTo}`;
      } else if (activeRange !== 'custom') {
        url += `&dateRange=${activeRange}`;
      } else {
        return; // custom but dates not set yet
      }
      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json() as ReportingData);
      }
    } finally {
      setLoading(false);
    }
  }

  const removedCharts = DEFAULT_CHARTS.filter((id) => !activeCharts.includes(id));

  function removeChart(id: ChartId): void {
    setActiveCharts((prev) => prev.filter((c) => c !== id));
  }

  function addChart(id: ChartId): void {
    // Re-insert in original order
    setActiveCharts((prev) => {
      const withNew = [...prev, id];
      return DEFAULT_CHARTS.filter((d) => withNew.includes(d));
    });
  }

  const smallCharts = activeCharts.filter((id) => id !== 'spend-conversions');

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full py-32">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (!loading && !data) {
    return (
      <div className="p-6 max-w-[1400px]">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-20 gap-3">
          <BarChart3Icon className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            No campaign data yet. Connect a platform and run a sync to see your dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Transform real data for charts
  const spendConversions = (data?.dailyMetrics ?? []).map((d) => ({
    label: formatDateLabel(d.date, activeRange),
    spend: d.spend,
    conversions: d.conversions
  }));

  const topCampaigns = [...(data?.perCampaign ?? [])]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map((c) => ({ name: c.campaignName, conversions: c.conversions, change: 0 }));

  const ageGender = data?.ageGender ?? [];
  const geography = data?.platformBreakdown ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Date filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveRange(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              activeRange === f.value
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground bg-transparent'
            )}
          >
            {f.label}
          </button>
        ))}
        {activeRange === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
            />
          </div>
        )}
      </div>

      {/* Performance overview */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Performance overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Active Campaigns" value={String(data?.perCampaign.length ?? 0)} icon={MegaphoneIcon} />
          <MetricCard label="Total Spend" value={formatCurrency(data?.summaryTotals.spend ?? 0)} icon={WalletIcon} />
          <MetricCard label="Impressions" value={formatNumber(data?.summaryTotals.impressions ?? 0)} icon={BarChart3Icon} />
          <MetricCard label="Clicks" value={formatNumber(data?.summaryTotals.clicks ?? 0)} icon={MousePointerClickIcon} />
          <MetricCard label="Conversions" value={formatNumber(data?.summaryTotals.conversions ?? 0)} icon={TrendingUpIcon} />
        </div>
      </div>

      {/* Charts section */}
      {activeCharts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance views &amp; charts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Insights from your current performance data</p>
            </div>
            <AddViewPicker removedCharts={removedCharts} onAdd={addChart} />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Full-width: Spend vs Conversions */}
            {activeCharts.includes('spend-conversions') && (
              <ChartCard
                id="spend-conversions"
                title={CHART_META['spend-conversions'].title}
                subtitle={CHART_META['spend-conversions'].subtitle}
                onRemove={removeChart}
                onExpand={setExpandedChart}
                fullWidth
              >
                <SpendConversionsChart data={spendConversions} />
              </ChartCard>
            )}

            {/* Bottom row: 3 smaller charts */}
            {smallCharts.length > 0 && (
              <div className={cn('grid gap-4', smallCharts.length === 1 ? 'grid-cols-1 max-w-md' : smallCharts.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
                {smallCharts.includes('geography') && (
                  <ChartCard
                    id="geography"
                    title={CHART_META.geography.title}
                    subtitle={CHART_META.geography.subtitle}
                    onRemove={removeChart}
                    onExpand={setExpandedChart}
                  >
                    <GeographyChart data={geography} />
                  </ChartCard>
                )}
                {smallCharts.includes('age-gender') && (
                  <ChartCard
                    id="age-gender"
                    title={CHART_META['age-gender'].title}
                    subtitle={CHART_META['age-gender'].subtitle}
                    onRemove={removeChart}
                    onExpand={setExpandedChart}
                  >
                    <AgeGenderChart data={ageGender} />
                  </ChartCard>
                )}
                {smallCharts.includes('top-campaigns') && (
                  <ChartCard
                    id="top-campaigns"
                    title={CHART_META['top-campaigns'].title}
                    subtitle={CHART_META['top-campaigns'].subtitle}
                    onRemove={removeChart}
                    onExpand={setExpandedChart}
                  >
                    <TopCampaignsTable data={topCampaigns} />
                  </ChartCard>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state when all charts removed */}
      {activeCharts.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance views &amp; charts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Insights from your current performance data</p>
            </div>
            <AddViewPicker removedCharts={removedCharts} onAdd={addChart} />
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-16 gap-3">
            <BarChart3Icon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">All views removed. Add a view to see charts.</p>
          </div>
        </div>
      )}

      {/* Expanded chart modal */}
      <ExpandedChartModal
        chartId={expandedChart}
        onClose={() => setExpandedChart(null)}
        spendConversions={spendConversions}
        geography={geography}
        ageGender={ageGender}
        topCampaigns={topCampaigns}
      />
    </div>
  );
}
