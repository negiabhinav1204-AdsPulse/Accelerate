'use client';

import * as React from 'react';
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';

type WastedItem = {
  platform: string;
  campaign: string;
  spend: number;
  conversions: number;
  roas: number;
  recommendation: string;
};

type Props = {
  period: string;
  currency: string;
  total_wasted: string;
  items_count: number;
  items: WastedItem[];
  summary: string;
};

export function ChatWastedSpendCard({
  period, currency, total_wasted, items_count, items, summary,
}: Props): React.JSX.Element {
  const isClean = items_count === 0;

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <AlertTriangleIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Wasted Spend Analysis</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {/* Total */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b ${isClean ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
        {isClean ? (
          <CheckCircle2Icon className="size-8 text-green-500 shrink-0" />
        ) : (
          <AlertTriangleIcon className="size-8 text-red-500 shrink-0" />
        )}
        <div>
          <p className={`text-2xl font-bold tabular-nums ${isClean ? 'text-green-600' : 'text-red-600'}`}>
            {isClean ? 'Clean' : `${currency} ${parseFloat(total_wasted).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{summary}</p>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="divide-y">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-l-2 border-l-red-400">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.campaign}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.recommendation}</p>
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <p className="text-sm font-medium text-red-600 tabular-nums">
                  {currency} {item.spend.toFixed(0)} spent
                </p>
                <p className="text-xs text-muted-foreground capitalize">{item.platform}</p>
                <p className="text-xs text-muted-foreground">
                  {item.conversions} conv · {item.roas.toFixed(2)}x ROAS
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
