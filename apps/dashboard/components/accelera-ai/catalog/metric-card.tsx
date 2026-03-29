'use client';
import React from 'react';
import { cn } from '@workspace/ui/lib/utils';
import type { MetricCardProps } from '~/lib/chat-ui/catalog-schema';
import { deltaColors, platformColors } from '~/lib/chat-ui/theme';

export function CatalogMetricCard({ label, value, delta, deltaDirection, subtitle, platform }: MetricCardProps) {
  const platformColor = platform ? platformColors[platform as keyof typeof platformColors]?.primary : undefined;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p
        className="text-xl font-semibold text-foreground tabular-nums truncate"
        style={platformColor ? { color: platformColor } : undefined}
      >
        {value}
      </p>
      {delta && (
        <p className={cn('text-xs font-medium', deltaColors[deltaDirection ?? 'neutral'])}>
          {delta}
        </p>
      )}
      {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
    </div>
  );
}
