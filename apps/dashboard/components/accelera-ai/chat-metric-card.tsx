'use client';

import * as React from 'react';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

type Metric = {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
};

type ChatMetricCardProps = {
  title: string;
  metrics: Metric[];
};

export function ChatMetricCard({
  title,
  metrics
}: ChatMetricCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-background p-4 w-full my-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((metric, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-0.5"
          >
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-lg font-semibold text-foreground">
              {metric.value}
            </p>
            {metric.change && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  metric.trend === 'up' && 'text-emerald-600',
                  metric.trend === 'down' && 'text-red-500',
                  metric.trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {metric.trend === 'up' && <TrendingUpIcon className="size-3" />}
                {metric.trend === 'down' && (
                  <TrendingDownIcon className="size-3" />
                )}
                {metric.change}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
