'use client';

import * as React from 'react';
import { FunnelIcon } from 'lucide-react';

type FunnelStage = {
  stage: string;
  count: number;
  drop_off_pct: string | null;
};

type Props = {
  period: string;
  stages: FunnelStage[];
  overall_conversion_rate: string;
  biggest_opportunity: string | null;
  note?: string;
};

export function ChatFunnelChartCard({
  period,
  stages,
  overall_conversion_rate,
  biggest_opportunity,
  note,
}: Props): React.JSX.Element {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FunnelIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Conversion Funnel</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {note ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">{note}</div>
      ) : (
        <>
          {/* Funnel bars */}
          <div className="px-4 py-4 space-y-3">
            {stages.map((s, i) => {
              const barPct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.stage}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-6 w-full rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/70 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  {s.drop_off_pct && (
                    <p className="text-xs text-red-500 text-right">
                      -{s.drop_off_pct}% dropped off
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall conversion rate</span>
              <span className="font-semibold text-green-600">{overall_conversion_rate}</span>
            </div>
            {biggest_opportunity && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Biggest opportunity</span>
                <span className="font-medium text-amber-600">{biggest_opportunity}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
