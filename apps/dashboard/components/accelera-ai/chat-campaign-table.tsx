'use client';

import * as React from 'react';

import { Badge } from '@workspace/ui/components/badge';
import { cn } from '@workspace/ui/lib/utils';

type Campaign = {
  name: string;
  status: 'active' | 'paused' | 'ended';
  budget?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  conversions?: string;
};

type ChatCampaignTableProps = {
  title: string;
  campaigns: Campaign[];
};

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  ended: 'bg-muted text-muted-foreground'
} as const;

export function ChatCampaignTable({
  title,
  campaigns
}: ChatCampaignTableProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-background p-4 w-full my-2 overflow-x-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="pb-2 pr-3 font-medium">Campaign</th>
            <th className="pb-2 pr-3 font-medium">Status</th>
            <th className="pb-2 pr-3 font-medium">Budget</th>
            <th className="pb-2 pr-3 font-medium">Spend</th>
            <th className="pb-2 pr-3 font-medium">Impressions</th>
            <th className="pb-2 pr-3 font-medium">CTR</th>
            <th className="pb-2 font-medium">Conv.</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr
              key={i}
              className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="py-2 pr-3 font-medium text-foreground max-w-[160px] truncate">
                {c.name}
              </td>
              <td className="py-2 pr-3">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_STYLES[c.status]
                  )}
                >
                  {c.status}
                </span>
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {c.budget ?? '—'}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {c.spend ?? '—'}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {c.impressions ?? '—'}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {c.ctr ?? '—'}
              </td>
              <td className="py-2 text-muted-foreground">
                {c.conversions ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
