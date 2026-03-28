'use client';

import * as React from 'react';
import { LayoutGridIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type PlacementRow = {
  publisher: string;
  placement: string;
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
  data: PlacementRow[];
  best_placement?: string | null;
  note?: string | null;
};

const PUBLISHER_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  bing: 'Bing',
  meta: 'Meta',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

function capitalizePublisher(name: string): string {
  return PUBLISHER_LABELS[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function rowKey(row: PlacementRow): string {
  return `${row.publisher}:${row.placement}`;
}

export function ChatPlacementsCard({
  period,
  currency = 'USD',
  data,
  best_placement,
  note,
}: Props): React.JSX.Element {
  // Determine best row: match best_placement string or fallback to highest ROAS
  const bestRow = best_placement
    ? data.find(
        (r) =>
          `${r.publisher}:${r.placement}` === best_placement ||
          r.placement === best_placement ||
          `${capitalizePublisher(r.publisher)} ${r.placement}` === best_placement,
      )
    : data.reduce<PlacementRow | null>((best, row) => (!best || row.roas > best.roas ? row : best), null);

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <LayoutGridIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Placement Performance</span>
        {period && <span className="ml-auto text-xs text-muted-foreground">{period}</span>}
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No placement data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Placement</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Spend</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">ROAS</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => {
                const isBest = bestRow ? rowKey(row) === rowKey(bestRow) : false;
                return (
                  <tr key={rowKey(row)} className={isBest ? 'bg-green-500/5' : undefined}>
                    <td className="px-4 py-2.5 font-medium">
                      <span className={isBest ? 'text-green-700' : undefined}>
                        {capitalizePublisher(row.publisher)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {row.placement.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(row.spend, row.currency ?? currency)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${isBest ? 'text-green-700' : ''}`}>
                      {row.roas.toFixed(1)}x
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.conversions.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {(bestRow || note) && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          {bestRow && (
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-700 text-xs"
            >
              Best: {capitalizePublisher(bestRow.publisher)} — {bestRow.placement.replace(/_/g, ' ')} ({bestRow.roas.toFixed(1)}x ROAS)
            </Badge>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}
