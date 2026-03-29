'use client';
import React from 'react';
import { cn } from '@workspace/ui/lib/utils';
import type { AudienceCardProps } from '~/lib/chat-ui/catalog-schema';
import { platformColors } from '~/lib/chat-ui/theme';

export function CatalogAudienceCard({ name, size, platforms, status, description }: AudienceCardProps) {
  const statusDot =
    status === 'active'
      ? 'bg-green-500'
      : status === 'syncing'
        ? 'bg-yellow-500'
        : 'bg-gray-400';

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{name}</p>
        {status && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <span className={cn('w-1.5 h-1.5 rounded-full', statusDot)} />
            {status}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-3">
        {size && <p className="text-xs font-medium text-foreground">{size} users</p>}
        {platforms && platforms.length > 0 && (
          <div className="flex gap-1">
            {platforms.map(p => {
              const pc = platformColors[p.toLowerCase() as keyof typeof platformColors];
              return (
                <span
                  key={p}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: pc?.light ?? '#f3f4f6', color: pc?.primary ?? '#374151' }}
                >
                  {p}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
