'use client';

import * as React from 'react';
import { RssIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type FeedRow = {
  id: string;
  name: string;
  channel: string;
  connector: string;
  health_score: number | null;
  last_pushed_at: string | null;
  active_rules: number;
  health_label: string;
};

type Props = {
  total: number;
  feeds: FeedRow[];
  message?: string;
};

const HEALTH_CONFIG: Record<string, { className: string }> = {
  Excellent:      { className: 'border-green-500/30 bg-green-500/10 text-green-600' },
  Good:           { className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
  Fair:           { className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  'Needs attention': { className: 'border-red-500/30 bg-red-500/10 text-red-600' },
  Unknown:        { className: 'border-muted/50 bg-muted/30 text-muted-foreground' },
};

export function ChatFeedHealthCard({ total, feeds, message }: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <RssIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Product Feed Health</span>
        <span className="ml-auto text-xs text-muted-foreground">{total} feed{total !== 1 ? 's' : ''}</span>
      </div>

      {message ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
      ) : feeds.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No product feeds configured.
        </div>
      ) : (
        <div className="divide-y">
          {feeds.map((f) => {
            const healthCfg = HEALTH_CONFIG[f.health_label] ?? HEALTH_CONFIG.Unknown!;

            return (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{f.name}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${healthCfg.className}`}>
                      {f.health_label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f.connector} · {f.channel} · {f.active_rules} rule{f.active_rules !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  {f.health_score != null && (
                    <p className="text-sm font-semibold tabular-nums">{f.health_score}%</p>
                  )}
                  {f.last_pushed_at ? (
                    <p className="text-xs text-muted-foreground">Pushed {f.last_pushed_at}</p>
                  ) : (
                    <p className="text-xs text-amber-600">Never pushed</p>
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
