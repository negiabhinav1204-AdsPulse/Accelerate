'use client';

import * as React from 'react';
import { AlertTriangleIcon, CheckCircle2Icon, PackageIcon, XCircleIcon } from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';

type InventoryItem = {
  title: string;
  inventory: number;
  days_until_stockout?: number | null;
  weekly_velocity?: number;
  status: 'out_of_stock' | 'critical' | 'low' | 'ok';
};

type Summary = {
  total_products: number;
  out_of_stock: number;
  low_stock: number;
  at_risk_revenue?: string;
};

type Props = {
  title: string;
  summary: Summary;
  items: InventoryItem[];
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string; rowClass: string }> = {
  out_of_stock: {
    icon: <XCircleIcon className="size-3.5" />,
    label: 'Out of Stock',
    className: 'border-red-500/30 bg-red-500/10 text-red-600',
    rowClass: 'border-l-2 border-l-red-500 pl-3',
  },
  critical: {
    icon: <AlertTriangleIcon className="size-3.5" />,
    label: 'Critical',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
    rowClass: 'border-l-2 border-l-orange-500 pl-3',
  },
  low: {
    icon: <AlertTriangleIcon className="size-3.5" />,
    label: 'Low Stock',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    rowClass: 'border-l-2 border-l-amber-400 pl-3',
  },
  ok: {
    icon: <CheckCircle2Icon className="size-3.5" />,
    label: 'OK',
    className: 'border-green-500/30 bg-green-500/10 text-green-600',
    rowClass: 'pl-3',
  },
};

export function ChatInventoryCard({ title, summary, items }: Props): React.JSX.Element {
  const isHealthy = summary.out_of_stock === 0 && summary.low_stock === 0;

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <PackageIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 divide-x border-b">
        <SummaryTile
          label="Total Products"
          value={summary.total_products.toLocaleString()}
          sub={null}
          accent="default"
        />
        <SummaryTile
          label="Out of Stock"
          value={summary.out_of_stock.toString()}
          sub={summary.out_of_stock > 0 ? 'Need restock' : 'All stocked'}
          accent={summary.out_of_stock > 0 ? 'red' : 'green'}
        />
        <SummaryTile
          label="Low Stock"
          value={summary.low_stock.toString()}
          sub={summary.at_risk_revenue ? `${summary.at_risk_revenue}/wk at risk` : null}
          accent={summary.low_stock > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Items list */}
      {isHealthy ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2Icon className="mb-2 size-8 text-green-500" />
          <p className="text-sm font-medium">All products are well-stocked</p>
          <p className="text-xs text-muted-foreground mt-1">No inventory alerts at current threshold.</p>
        </div>
      ) : (
        <div className="divide-y">
          {items.map((item, i) => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.ok!;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 ${cfg.rowClass}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.status === 'out_of_stock'
                      ? 'No stock remaining'
                      : `${item.inventory} units remaining`}
                    {item.weekly_velocity && item.weekly_velocity > 0
                      ? ` · selling ${item.weekly_velocity}/wk`
                      : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                    {cfg.icon}
                    <span className="ml-1">{cfg.label}</span>
                  </Badge>
                  {item.days_until_stockout != null && item.status !== 'out_of_stock' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{item.days_until_stockout}d left
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string | null;
  accent: 'default' | 'red' | 'green' | 'amber';
}): React.JSX.Element {
  const valueClass =
    accent === 'red'
      ? 'text-red-600'
      : accent === 'amber'
      ? 'text-amber-600'
      : accent === 'green'
      ? 'text-green-600'
      : 'text-foreground';

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
