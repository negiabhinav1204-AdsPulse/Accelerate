'use client';
import React from 'react';
import type { CampaignListProps } from '~/lib/chat-ui/catalog-schema';
import { CatalogCampaignCard } from './campaign-card';

export function CatalogCampaignList({ title, campaigns }: CampaignListProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      {campaigns.map((c, i) => <CatalogCampaignCard key={i} {...c} />)}
    </div>
  );
}
