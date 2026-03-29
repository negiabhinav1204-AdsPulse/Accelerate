'use client';
import React from 'react';
import { cn } from '@workspace/ui/lib/utils';
import type { CampaignCardProps } from '~/lib/chat-ui/catalog-schema';
import { statusColors, platformColors } from '~/lib/chat-ui/theme';

const healthLabels = {
  winner:         { label: 'Winner',         bg: 'bg-emerald-100', text: 'text-emerald-800' },
  learner:        { label: 'Learner',         bg: 'bg-blue-100',    text: 'text-blue-800'    },
  underperformer: { label: 'Underperformer',  bg: 'bg-amber-100',   text: 'text-amber-800'   },
  bleeder:        { label: 'Bleeder',         bg: 'bg-red-100',     text: 'text-red-800'     },
};

export function CatalogCampaignCard({ name, platform, status, spend, roas, impressions, clicks, budget, health }: CampaignCardProps) {
  const sc = statusColors[status] ?? statusColors.draft;
  const hc = health ? healthLabels[health] : null;
  const pc = platformColors[platform.toLowerCase() as keyof typeof platformColors];

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate flex-1">{name}</p>
        <div className="flex gap-1.5 shrink-0">
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium', sc.bg, sc.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
            {status}
          </span>
          {hc && (
            <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', hc.bg, hc.text)}>
              {hc.label}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded"
          style={{ background: pc?.light ?? '#f3f4f6', color: pc?.primary ?? '#374151' }}
        >
          {platform}
        </span>
        {budget && <span className="text-xs text-muted-foreground">Budget: {budget}/day</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Spend</p>
          <p className="text-sm font-semibold tabular-nums">{spend}</p>
        </div>
        {roas && (
          <div>
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="text-sm font-semibold tabular-nums">{roas}x</p>
          </div>
        )}
        {clicks !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-sm font-semibold tabular-nums">{clicks.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
