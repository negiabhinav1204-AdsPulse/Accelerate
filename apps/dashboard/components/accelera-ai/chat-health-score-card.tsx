'use client';

import * as React from 'react';
import { ActivityIcon, TrendingDownIcon, TrendingUpIcon, ZapIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type HealthCategory = 'winner' | 'learner' | 'underperformer' | 'bleeder' | 'paused';

type CampaignRow = {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: string;
  spend: string;
  roas: number;
  category: HealthCategory;
  score: number;
  recommendation: string;
};

type Summary = {
  total: number;
  winners: number;
  bleeders: number;
  underperformers: number;
  learners: number;
  paused: number;
};

type Props = {
  period: string;
  currency: string;
  summary: Summary;
  campaigns: CampaignRow[];
};

const CATEGORY_CONFIG: Record<HealthCategory, { label: string; className: string; rowClass: string; icon: React.ReactNode }> = {
  winner: {
    label: 'Winner',
    className: 'border-green-500/30 bg-green-500/10 text-green-600',
    rowClass: 'border-l-2 border-l-green-500 pl-3',
    icon: <TrendingUpIcon className="size-3.5" />,
  },
  learner: {
    label: 'Learner',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
    rowClass: 'border-l-2 border-l-blue-400 pl-3',
    icon: <ZapIcon className="size-3.5" />,
  },
  underperformer: {
    label: 'Under',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    rowClass: 'border-l-2 border-l-amber-400 pl-3',
    icon: <ActivityIcon className="size-3.5" />,
  },
  bleeder: {
    label: 'Bleeder',
    className: 'border-red-500/30 bg-red-500/10 text-red-600',
    rowClass: 'border-l-2 border-l-red-500 pl-3',
    icon: <TrendingDownIcon className="size-3.5" />,
  },
  paused: {
    label: 'Paused',
    className: 'border-muted/50 bg-muted/30 text-muted-foreground',
    rowClass: 'opacity-60 pl-3',
    icon: null,
  },
};

export function ChatHealthScoreCard({ period, currency, summary, campaigns }: Props): React.JSX.Element {
  const activeCampaigns = campaigns.filter((c) => c.category !== 'paused');

  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ActivityIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Campaign Health Check</span>
        <span className="ml-auto text-xs text-muted-foreground">{period}</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 divide-x border-b">
        <HealthTile label="Winners" value={summary.winners} color="green" />
        <HealthTile label="Learning" value={summary.learners} color="blue" />
        <HealthTile label="Under" value={summary.underperformers} color="amber" />
        <HealthTile label="Bleeders" value={summary.bleeders} color="red" />
      </div>

      {/* Campaign rows */}
      {activeCampaigns.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No active campaigns found.
        </div>
      ) : (
        <div className="divide-y">
          {campaigns.map((c) => {
            const cfg = CATEGORY_CONFIG[c.category] ?? CATEGORY_CONFIG.learner;
            return (
              <div key={c.id} className={`flex items-start gap-3 px-4 py-3 ${cfg.rowClass}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${cfg.className}`}>
                      {cfg.icon}
                      <span className="ml-1">{cfg.label}</span>
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.recommendation}</p>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-sm font-medium tabular-nums">
                    {c.roas > 0 ? `${c.roas.toFixed(1)}x ROAS` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currency} {c.spend} spent
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{c.platform}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HealthTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'green' | 'blue' | 'amber' | 'red';
}): React.JSX.Element {
  const valueClass =
    color === 'green' && value > 0 ? 'text-green-600'
    : color === 'red' && value > 0 ? 'text-red-600'
    : color === 'amber' && value > 0 ? 'text-amber-600'
    : color === 'blue' && value > 0 ? 'text-blue-600'
    : 'text-foreground';

  return (
    <div className="px-3 py-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}
