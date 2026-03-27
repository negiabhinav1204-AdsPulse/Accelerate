'use client';

import * as React from 'react';
import { PieChartIcon } from 'lucide-react';

type PlatformRevenue = {
  platform: string;
  attributed_revenue: number;
  spend: number;
};

type Props = {
  period: string;
  currency: string;
  total_revenue: string;
  ad_attributed: string;
  organic: string;
  ad_share_pct: string;
  organic_share_pct: string;
  by_platform: PlatformRevenue[];
};

export function ChatRevenueBreakdownCard(props: Props): React.JSX.Element {
  const {
    period, currency, total_revenue, ad_attributed, organic,
    ad_share_pct, organic_share_pct, by_platform,
  } = props;

  const adPct = parseFloat(ad_share_pct);
  const orgPct = parseFloat(organic_share_pct);

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <PieChartIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Revenue Breakdown</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 divide-x border-b">
        <RevTile label="Total Revenue" value={`${currency} ${formatNum(total_revenue)}`} accent="default" />
        <RevTile label="Ad-Attributed" value={`${currency} ${formatNum(ad_attributed)}`} sub={`${ad_share_pct}%`} accent="blue" />
        <RevTile label="Organic" value={`${currency} ${formatNum(organic)}`} sub={`${organic_share_pct}%`} accent="green" />
      </div>

      {/* Visual bar */}
      <div className="px-4 py-3 border-b">
        <div className="flex h-4 w-full rounded overflow-hidden">
          <div className="bg-blue-500 transition-all" style={{ width: `${adPct}%` }} />
          <div className="bg-green-500 transition-all" style={{ width: `${orgPct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" />
            Ad-attributed ({ad_share_pct}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500" />
            Organic ({organic_share_pct}%)
          </span>
        </div>
      </div>

      {/* Platform breakdown */}
      {by_platform.length > 0 && (
        <div className="divide-y">
          {by_platform.map((p, i) => {
            const roas = p.spend > 0 ? (p.attributed_revenue / p.spend).toFixed(2) : '—';
            return (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium capitalize">{p.platform}</span>
                <div className="text-right space-y-0.5">
                  <p className="text-sm tabular-nums">
                    {currency} {formatNum(p.attributed_revenue.toFixed(2))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {roas}x ROAS · {currency} {formatNum(p.spend.toFixed(2))} spend
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatNum(s: string): string {
  const n = parseFloat(s);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function RevTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: 'default' | 'blue' | 'green';
}): React.JSX.Element {
  const valueClass =
    accent === 'blue' ? 'text-blue-600'
    : accent === 'green' ? 'text-green-600'
    : 'text-foreground';

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub} of total</p>}
    </div>
  );
}
