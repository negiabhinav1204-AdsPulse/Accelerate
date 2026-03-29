'use client';
import React from 'react';
import type { MetricRowProps } from '~/lib/chat-ui/catalog-schema';
import { CatalogMetricCard } from './metric-card';

export function CatalogMetricRow({ metrics }: MetricRowProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 5)}, 1fr)` }}
    >
      {metrics.map((m, i) => <CatalogMetricCard key={i} {...m} />)}
    </div>
  );
}
