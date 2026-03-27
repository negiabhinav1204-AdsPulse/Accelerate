'use client';

import * as React from 'react';
import { LayersIcon } from 'lucide-react';

type PlatformRow = {
  platform: string;
  spend: string;
  impressions: number;
  clicks: number;
  ctr: string;
  cpc: string;
  conversions: number;
  roas: string;
  cpa: string;
};

type Props = {
  period: string;
  currency: string;
  platforms: PlatformRow[];
};

export function ChatPlatformComparisonCard({ period, currency, platforms }: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <LayersIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Platform Comparison</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {platforms.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No ad platform data found for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                <th className="px-3 py-2 text-right font-medium">Spend</th>
                <th className="px-3 py-2 text-right font-medium">Impressions</th>
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-right font-medium">CPC</th>
                <th className="px-3 py-2 text-right font-medium">Conv.</th>
                <th className="px-3 py-2 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {platforms.map((p, i) => {
                const roas = parseFloat(p.roas);
                const roasClass =
                  roas >= 3 ? 'text-green-600 font-semibold'
                  : roas >= 1 ? 'text-foreground'
                  : 'text-red-600 font-semibold';

                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium capitalize">{p.platform}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {currency} {parseFloat(p.spend).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {compactNum(p.impressions)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.ctr}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {currency} {parseFloat(p.cpc).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.conversions}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${roasClass}`}>{roas.toFixed(1)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
