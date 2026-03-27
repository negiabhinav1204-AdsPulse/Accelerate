'use client';

import * as React from 'react';
import { BarChart3Icon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

type Props = {
  period: string;
  currency: string;
  blended_roas: string;
  mer: string;
  total_spend: string;
  total_revenue: string;
  total_orders: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  spend_change_pct: string;
  revenue_change_pct: string;
  top_platform: string;
};

export function ChatExecutiveSummaryCard(props: Props): React.JSX.Element {
  const {
    period, currency,
    blended_roas, mer, total_spend, total_revenue, total_orders,
    total_impressions, total_clicks, total_conversions,
    spend_change_pct, revenue_change_pct, top_platform,
  } = props;

  const ctr =
    total_impressions > 0
      ? ((total_clicks / total_impressions) * 100).toFixed(2) + '%'
      : '0%';

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <BarChart3Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Executive Summary</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 divide-x border-b">
        <KpiTile
          label="Blended ROAS"
          value={`${blended_roas}x`}
          sub="revenue / ad spend"
          highlight={parseFloat(blended_roas) >= 3 ? 'green' : parseFloat(blended_roas) >= 1 ? 'amber' : 'red'}
        />
        <KpiTile
          label="Marketing Efficiency Ratio"
          value={`${mer}x`}
          sub="total revenue / total spend"
          highlight="default"
        />
      </div>

      <div className="grid grid-cols-2 divide-x border-b">
        <KpiTile
          label="Total Spend"
          value={`${currency} ${formatNum(total_spend)}`}
          sub={`${trendLabel(spend_change_pct)} vs prior period`}
          highlight="default"
          change={spend_change_pct}
        />
        <KpiTile
          label="Total Revenue"
          value={`${currency} ${formatNum(total_revenue)}`}
          sub={`${trendLabel(revenue_change_pct)} vs prior period`}
          highlight={parseFloat(revenue_change_pct) >= 0 ? 'green' : 'red'}
          change={revenue_change_pct}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-4 divide-x border-b">
        <SmallTile label="Orders" value={total_orders.toLocaleString()} />
        <SmallTile label="Impressions" value={compactNum(total_impressions)} />
        <SmallTile label="Clicks" value={compactNum(total_clicks)} />
        <SmallTile label="CTR" value={ctr} />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-4 py-2.5 text-xs text-muted-foreground">
        <span>Top platform: <span className="font-medium capitalize text-foreground">{top_platform}</span></span>
        <span className="ml-auto">{total_conversions.toLocaleString()} conversions</span>
      </div>
    </div>
  );
}

function formatNum(s: string): string {
  const n = parseFloat(s);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function trendLabel(pct: string): string {
  const n = parseFloat(pct);
  if (n > 0) return `+${pct}%`;
  return `${pct}%`;
}

function KpiTile({
  label,
  value,
  sub,
  highlight,
  change,
}: {
  label: string;
  value: string;
  sub: string;
  highlight: 'green' | 'amber' | 'red' | 'default';
  change?: string;
}): React.JSX.Element {
  const valueClass =
    highlight === 'green' ? 'text-green-600'
    : highlight === 'amber' ? 'text-amber-600'
    : highlight === 'red' ? 'text-red-600'
    : 'text-foreground';

  const changeNum = change ? parseFloat(change) : 0;
  const TrendIcon = changeNum > 0 ? TrendingUpIcon : TrendingDownIcon;
  const trendClass = changeNum > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {change && <TrendIcon className={`size-3 ${trendClass}`} />}
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function SmallTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
