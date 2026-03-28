'use client';

import * as React from 'react';
import { UsersIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type DemoRow = {
  age_range: string;
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
  cpa: number;
  currency: string;
};

type Props = {
  period?: string;
  currency?: string;
  data: DemoRow[];
  best_roas_segment?: string;
  highest_spend_segment?: string;
  note?: string | null;
};

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

export function ChatDemographicsCard({
  period,
  currency = 'USD',
  data,
  best_roas_segment,
  note,
}: Props): React.JSX.Element {
  const bestRoasRow = best_roas_segment
    ? data.find((r) => r.age_range === best_roas_segment)
    : data.reduce<DemoRow | null>((best, row) => (!best || row.roas > best.roas ? row : best), null);

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <UsersIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Demographic Insights</span>
        {period && <span className="ml-auto text-xs text-muted-foreground">{period}</span>}
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No demographic data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Age Range</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Spend</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">ROAS</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Conv.</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">CPA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => {
                const isBest = row.age_range === bestRoasRow?.age_range;
                return (
                  <tr
                    key={row.age_range}
                    className={isBest ? 'bg-green-500/5' : undefined}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <span className={isBest ? 'text-green-700' : undefined}>{row.age_range}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(row.spend, row.currency ?? currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(row.revenue, row.currency ?? currency)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${isBest ? 'text-green-700' : ''}`}>
                      {row.roas.toFixed(1)}x
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(row.cpa, row.currency ?? currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer badges */}
      {(bestRoasRow || note) && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          {bestRoasRow && (
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-700 text-xs"
            >
              Best ROAS: {bestRoasRow.age_range} ({bestRoasRow.roas.toFixed(1)}x)
            </Badge>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}
