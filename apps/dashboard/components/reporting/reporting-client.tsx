'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BarChart3Icon, DownloadIcon, XIcon } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DailyMetric = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type SummaryTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
};

type PerCampaign = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
};

type ReportingData = {
  dailyMetrics: DailyMetric[];
  summaryTotals: SummaryTotals;
  perCampaign: PerCampaign[];
  lastSyncAt: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function fmtRoas(n: number): string {
  return `${n.toFixed(1)}x`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-12 rounded-full bg-muted" />
          ))}
        </div>
        <div className="h-8 w-28 rounded bg-muted" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-6 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-36 rounded bg-muted mb-4" />
        <div className="h-[280px] rounded-lg bg-muted/40" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-36 rounded bg-muted mb-4" />
        <div className="h-[220px] rounded-lg bg-muted/40" />
      </div>
      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-3 border-b border-border last:border-0">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for line chart
// ---------------------------------------------------------------------------

function LineChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name === 'Spend' ? fmtMoney(p.value) : fmtNum(p.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReportingClient({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const [dateRange, setDateRange] = React.useState<'7d' | '15d' | '30d'>('7d');
  const [data, setData] = React.useState<ReportingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void loadData();
  }, [orgId, dateRange, selectedCampaignId]);

  async function loadData() {
    setLoading(true);
    try {
      const url = `/api/reporting?orgId=${orgId}&dateRange=${dateRange}${
        selectedCampaignId ? `&campaignId=${selectedCampaignId}` : ''
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json() as ReportingData;
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  // Empty state — no data returned at all
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <BarChart3Icon className="size-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">No reporting data yet</p>
        <p className="text-xs text-muted-foreground">
          Connect Meta Ads to start seeing reporting data.{' '}
          <a href={`/organizations/${orgSlug}/connectors`} className="text-primary hover:underline">
            Set up connector
          </a>
        </p>
      </div>
    );
  }

  const { summaryTotals: t, dailyMetrics, perCampaign, lastSyncAt } = data;

  // Top 5 campaigns by spend for bar chart
  const top5 = [...perCampaign]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map((c) => ({ ...c, shortName: truncate(c.campaignName, 12) }));

  // Find selected campaign name for chip
  const selectedCampaign = selectedCampaignId
    ? perCampaign.find((c) => c.campaignId === selectedCampaignId)
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* 1. Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
          {(['7d', '15d', '30d'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                dateRange === range
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastSyncAt && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Last synced {timeAgo(lastSyncAt)}
            </span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <DownloadIcon className="size-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Viewing chip */}
      {selectedCampaign && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary">
          Viewing: {selectedCampaign.campaignName}
          <button
            type="button"
            onClick={() => setSelectedCampaignId(null)}
            className="ml-1 text-primary/70 hover:text-primary transition-colors"
            aria-label="Clear filter"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}

      {/* 2. Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <SummaryCard label="Spend" value={fmtMoney(t.spend)} />
        <SummaryCard label="Impressions" value={fmtNum(t.impressions)} />
        <SummaryCard label="Clicks" value={fmtNum(t.clicks)} />
        <SummaryCard label="CTR" value={fmtPct(t.ctr)} />
        <SummaryCard label="CPC" value={fmtMoney(t.cpc)} />
        <SummaryCard label="Conversions" value={fmtNum(t.conversions)} />
        <SummaryCard label="ROAS" value={fmtRoas(t.roas)} />
      </div>

      {/* 3. Line chart — Daily Performance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Daily Performance</h3>
        {dailyMetrics.length === 0 ? (
          <div className="h-[280px] rounded-lg bg-muted/30 flex flex-col items-center justify-center gap-2">
            <BarChart3Icon className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No daily data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyMetrics} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="spend"
                orientation="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
              />
              <Tooltip content={<LineChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Line
                yAxisId="spend"
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. Bar chart — Platform Breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Platform Breakdown</h3>
        <p className="text-xs text-muted-foreground mb-4">Spend by Campaign (top 5)</p>
        {top5.length === 0 ? (
          <div className="h-[220px] rounded-lg bg-muted/30 flex flex-col items-center justify-center gap-2">
            <BarChart3Icon className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No campaign data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top5} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                formatter={(value: number) => [fmtMoney(value), 'Spend']}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                formatter={() => 'Spend by Campaign'}
              />
              <Bar dataKey="spend" name="Spend" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Campaign performance table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Campaign Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Campaign
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Spend
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Impressions
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Clicks
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  CTR
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  CPC
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Conversions
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  ROAS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {perCampaign.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No campaigns match the selected date range.
                  </td>
                </tr>
              ) : (
                perCampaign.map((c) => (
                  <tr
                    key={c.campaignId}
                    onClick={() =>
                      setSelectedCampaignId(
                        selectedCampaignId === c.campaignId ? null : c.campaignId
                      )
                    }
                    className={cn(
                      'transition-colors cursor-pointer',
                      selectedCampaignId === c.campaignId
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <td className="px-5 py-3 font-medium text-foreground max-w-[200px]">
                      <span className="block truncate">{c.campaignName}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtMoney(c.spend)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtNum(c.impressions)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtNum(c.clicks)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtPct(c.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtMoney(c.cpc)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtNum(c.conversions)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {fmtRoas(c.roas)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
