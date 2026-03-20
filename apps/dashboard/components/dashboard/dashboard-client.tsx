'use client';

import * as React from 'react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  GripVerticalIcon,
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

// ── Mock data ─────────────────────────────────────────────────────────────────

type RangeData = {
  metrics: {
    campaigns: number;
    totalSpend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    spendChange: number;
    impressionsChange: number;
    clicksChange: number;
    conversionsChange: number;
  };
  spendConversions: { label: string; spend: number; conversions: number }[];
  geography: { region: string; conversions: number }[];
  ageGender: { age: string; female: number; male: number; others: number }[];
  topCampaigns: { name: string; conversions: number; change: number }[];
};

const MOCK: Record<DateRangeKey, RangeData> = {
  today: {
    metrics: { campaigns: 233, totalSpend: 1240, impressions: 9800, clicks: 4120, conversions: 310, spendChange: 3.2, impressionsChange: 2.1, clicksChange: 4.5, conversionsChange: 5.1 },
    spendConversions: [
      { label: '6am', spend: 180, conversions: 12 }, { label: '9am', spend: 340, conversions: 22 },
      { label: '12pm', spend: 520, conversions: 38 }, { label: '3pm', spend: 690, conversions: 51 },
      { label: '6pm', spend: 810, conversions: 63 }, { label: '9pm', spend: 920, conversions: 71 },
      { label: '12am', spend: 1240, conversions: 89 }
    ],
    geography: [{ region: 'CalifF', conversions: 52 }, { region: 'BosDA', conversions: 38 }, { region: 'Canada', conversions: 28 }, { region: 'Phoenix', conversions: 19 }, { region: 'MexDE', conversions: 12 }],
    ageGender: [{ age: '18-24', female: 28, male: 35, others: 4 }, { age: '25-34', female: 44, male: 30, others: 2 }, { age: '35-44', female: 38, male: 28, others: 6 }, { age: '45+', female: 22, male: 18, others: 3 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 52, change: 12 }, { name: 'Summer Blast Offer', conversions: 38, change: 8 }, { name: 'Winter Campaign', conversions: 64, change: 15 }, { name: 'Midday Social Boost', conversions: 35, change: -3 }]
  },
  '7d': {
    metrics: { campaigns: 233, totalSpend: 7657, impressions: 6353, clicks: 36563, conversions: 36563, spendChange: 8.5, impressionsChange: 8.5, clicksChange: 8.5, conversionsChange: 8.5 },
    spendConversions: [
      { label: 'Mon', spend: 47000, conversions: 44 }, { label: 'Tue', spend: 45000, conversions: 37 },
      { label: 'Wed', spend: 42000, conversions: 33 }, { label: 'Thu', spend: 33000, conversions: 28 },
      { label: 'Fri', spend: 52000, conversions: 48 }, { label: 'Sat', spend: 49000, conversions: 43 },
      { label: 'Sun', spend: 46000, conversions: 41 }
    ],
    geography: [{ region: 'CalifF', conversions: 51 }, { region: 'BosDA', conversions: 37 }, { region: 'Canada', conversions: 63 }, { region: 'Phoenix', conversions: 34 }, { region: 'MexDE', conversions: 22 }],
    ageGender: [{ age: '18-24', female: 35, male: 38, others: 3 }, { age: '25-34', female: 52, male: 28, others: 4 }, { age: '35-44', female: 55, male: 30, others: 14 }, { age: '45+', female: 42, male: 20, others: 2 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 52, change: 12 }, { name: 'Summer Blast Offer', conversions: 38, change: 8 }, { name: 'Winter Campaign', conversions: 64, change: 15 }, { name: 'Midday Social Boost', conversions: 35, change: -3 }]
  },
  '15d': {
    metrics: { campaigns: 233, totalSpend: 15320, impressions: 128400, clicks: 74200, conversions: 5810, spendChange: 11.2, impressionsChange: 9.7, clicksChange: 13.4, conversionsChange: 7.8 },
    spendConversions: [
      { label: 'D1', spend: 900, conversions: 38 }, { label: 'D2', spend: 1050, conversions: 43 }, { label: 'D3', spend: 870, conversions: 36 }, { label: 'D4', spend: 1200, conversions: 52 },
      { label: 'D5', spend: 1100, conversions: 47 }, { label: 'D6', spend: 950, conversions: 40 }, { label: 'D7', spend: 1300, conversions: 56 }, { label: 'D8', spend: 1150, conversions: 49 },
      { label: 'D9', spend: 980, conversions: 41 }, { label: 'D10', spend: 1060, conversions: 45 }, { label: 'D11', spend: 1240, conversions: 53 }, { label: 'D12', spend: 1080, conversions: 46 },
      { label: 'D13', spend: 1190, conversions: 51 }, { label: 'D14', spend: 1020, conversions: 44 }, { label: 'D15', spend: 1380, conversions: 59 }
    ],
    geography: [{ region: 'CalifF', conversions: 62 }, { region: 'BosDA', conversions: 45 }, { region: 'Canada', conversions: 71 }, { region: 'Phoenix', conversions: 40 }, { region: 'MexDE', conversions: 29 }],
    ageGender: [{ age: '18-24', female: 40, male: 45, others: 5 }, { age: '25-34', female: 58, male: 33, others: 6 }, { age: '35-44', female: 62, male: 35, others: 16 }, { age: '45+', female: 48, male: 24, others: 4 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 78, change: 18 }, { name: 'Summer Blast Offer', conversions: 64, change: 12 }, { name: 'Winter Campaign', conversions: 91, change: 22 }, { name: 'Midday Social Boost', conversions: 55, change: -1 }]
  },
  '30d': {
    metrics: { campaigns: 233, totalSpend: 31800, impressions: 264000, clicks: 148600, conversions: 11900, spendChange: 5.3, impressionsChange: 7.1, clicksChange: 6.8, conversionsChange: 9.2 },
    spendConversions: [
      { label: 'W1', spend: 7200, conversions: 280 }, { label: 'W2', spend: 8100, conversions: 310 },
      { label: 'W3', spend: 7600, conversions: 295 }, { label: 'W4', spend: 8900, conversions: 345 }
    ],
    geography: [{ region: 'CalifF', conversions: 128 }, { region: 'BosDA', conversions: 94 }, { region: 'Canada', conversions: 143 }, { region: 'Phoenix', conversions: 82 }, { region: 'MexDE', conversions: 57 }],
    ageGender: [{ age: '18-24', female: 82, male: 91, others: 11 }, { age: '25-34', female: 118, male: 68, others: 12 }, { age: '35-44', female: 127, male: 71, others: 32 }, { age: '45+', female: 96, male: 49, others: 8 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 156, change: 9 }, { name: 'Summer Blast Offer', conversions: 128, change: 6 }, { name: 'Winter Campaign', conversions: 183, change: 17 }, { name: 'Midday Social Boost', conversions: 109, change: -5 }]
  },
  year: {
    metrics: { campaigns: 233, totalSpend: 382000, impressions: 3180000, clicks: 1780000, conversions: 143000, spendChange: 22.4, impressionsChange: 18.7, clicksChange: 24.1, conversionsChange: 31.5 },
    spendConversions: [
      { label: 'Jan', spend: 28000, conversions: 1100 }, { label: 'Feb', spend: 25000, conversions: 980 },
      { label: 'Mar', spend: 30000, conversions: 1240 }, { label: 'Apr', spend: 33000, conversions: 1380 },
      { label: 'May', spend: 31000, conversions: 1290 }, { label: 'Jun', spend: 35000, conversions: 1470 },
      { label: 'Jul', spend: 38000, conversions: 1620 }, { label: 'Aug', spend: 36000, conversions: 1510 },
      { label: 'Sep', spend: 32000, conversions: 1350 }, { label: 'Oct', spend: 34000, conversions: 1440 },
      { label: 'Nov', spend: 40000, conversions: 1710 }, { label: 'Dec', spend: 20000, conversions: 900 }
    ],
    geography: [{ region: 'CalifF', conversions: 1540 }, { region: 'BosDA', conversions: 1120 }, { region: 'Canada', conversions: 1720 }, { region: 'Phoenix', conversions: 980 }, { region: 'MexDE', conversions: 690 }],
    ageGender: [{ age: '18-24', female: 980, male: 1090, others: 130 }, { age: '25-34', female: 1420, male: 810, others: 140 }, { age: '35-44', female: 1520, male: 850, others: 380 }, { age: '45+', female: 1150, male: 590, others: 95 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 1870, change: 35 }, { name: 'Summer Blast Offer', conversions: 1540, change: 28 }, { name: 'Winter Campaign', conversions: 2190, change: 42 }, { name: 'Midday Social Boost', conversions: 1310, change: -8 }]
  },
  custom: {
    metrics: { campaigns: 233, totalSpend: 7657, impressions: 6353, clicks: 36563, conversions: 36563, spendChange: 8.5, impressionsChange: 8.5, clicksChange: 8.5, conversionsChange: 8.5 },
    spendConversions: [
      { label: 'Mon', spend: 47000, conversions: 44 }, { label: 'Tue', spend: 45000, conversions: 37 },
      { label: 'Wed', spend: 42000, conversions: 33 }, { label: 'Thu', spend: 33000, conversions: 28 },
      { label: 'Fri', spend: 52000, conversions: 48 }, { label: 'Sat', spend: 49000, conversions: 43 },
      { label: 'Sun', spend: 46000, conversions: 41 }
    ],
    geography: [{ region: 'CalifF', conversions: 51 }, { region: 'BosDA', conversions: 37 }, { region: 'Canada', conversions: 63 }, { region: 'Phoenix', conversions: 34 }, { region: 'MexDE', conversions: 22 }],
    ageGender: [{ age: '18-24', female: 35, male: 38, others: 3 }, { age: '25-34', female: 52, male: 28, others: 4 }, { age: '35-44', female: 55, male: 30, others: 14 }, { age: '45+', female: 42, male: 20, others: 2 }],
    topCampaigns: [{ name: 'Frozen Lab Gaming', conversions: 52, change: 12 }, { name: 'Summer Blast Offer', conversions: 38, change: 8 }, { name: 'Winter Campaign', conversions: 64, change: 15 }, { name: 'Midday Social Boost', conversions: 35, change: -3 }]
  }
};

// ── Chart registry ────────────────────────────────────────────────────────────

type ChartId = 'spend-conversions' | 'geography' | 'age-gender' | 'top-campaigns';

const CHART_META: Record<ChartId, { title: string; subtitle: string }> = {
  'spend-conversions': { title: 'Spend vs. Conversions', subtitle: 'Multi-axis view showing spend and conversion correlation' },
  geography: { title: 'Geography Breakdown', subtitle: 'Conversion location by region' },
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

function SpendConversionsChart({ data }: { data: RangeData['spendConversions'] }): React.JSX.Element {
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

function GeographyChart({ data }: { data: RangeData['geography'] }): React.JSX.Element {
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

function AgeGenderChart({ data }: { data: RangeData['ageGender'] }): React.JSX.Element {
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

function TopCampaignsTable({ data }: { data: RangeData['topCampaigns'] }): React.JSX.Element {
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
  data
}: {
  chartId: ChartId | null;
  onClose: () => void;
  data: RangeData;
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
          {chartId === 'spend-conversions' && <SpendConversionsChart data={data.spendConversions} />}
          {chartId === 'geography' && (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={data.geography} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
                <BarChart data={data.ageGender} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
              {data.topCampaigns.map((row) => (
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

export function DashboardClient(): React.JSX.Element {
  const [activeRange, setActiveRange] = React.useState<DateRangeKey>('7d');
  const [activeCharts, setActiveCharts] = React.useState<ChartId[]>([...DEFAULT_CHARTS]);
  const [expandedChart, setExpandedChart] = React.useState<ChartId | null>(null);
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');

  const data = MOCK[activeRange];
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
          <MetricCard label="Campaigns" value={String(data.metrics.campaigns)} icon={MegaphoneIcon} />
          <MetricCard label="Total Spend" value={formatCurrency(data.metrics.totalSpend)} change={data.metrics.spendChange} icon={WalletIcon} />
          <MetricCard label="Impressions" value={formatNumber(data.metrics.impressions)} change={data.metrics.impressionsChange} icon={BarChart3Icon} />
          <MetricCard label="Clicks" value={formatNumber(data.metrics.clicks)} change={data.metrics.clicksChange} icon={MousePointerClickIcon} />
          <MetricCard label="Conversions" value={formatNumber(data.metrics.conversions)} change={data.metrics.conversionsChange} icon={TrendingUpIcon} />
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
                <SpendConversionsChart data={data.spendConversions} />
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
                    <GeographyChart data={data.geography} />
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
                    <AgeGenderChart data={data.ageGender} />
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
                    <TopCampaignsTable data={data.topCampaigns} />
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
        data={data}
      />
    </div>
  );
}
