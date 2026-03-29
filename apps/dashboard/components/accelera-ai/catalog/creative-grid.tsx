'use client';
import React from 'react';
import type { CreativeGridProps } from '~/lib/chat-ui/catalog-schema';
import { CatalogCreativePreview } from './creative-preview';

export function CatalogCreativeGrid({ title, creatives, columns = 2 }: CreativeGridProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <div className={`grid gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {creatives.map((c, i) => <CatalogCreativePreview key={i} {...c} />)}
      </div>
    </div>
  );
}
