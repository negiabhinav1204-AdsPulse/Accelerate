'use client';
import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { MediaPlanPreviewProps, MediaPlanCampaignProps } from '~/lib/chat-ui/catalog-schema';
import { platformColors } from '~/lib/chat-ui/theme';

function CampaignNode({ campaign }: { campaign: MediaPlanCampaignProps }) {
  const [open, setOpen] = useState(true);
  const pc = platformColors[campaign.platform.toLowerCase() as keyof typeof platformColors];
  return (
    <div className="rounded-lg border bg-background">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        {open
          ? <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
          : <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />}
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: pc?.light ?? '#f3f4f6', color: pc?.primary ?? '#374151' }}
        >
          {campaign.platform}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 truncate">{campaign.name}</span>
        {campaign.dailyBudget && (
          <span className="text-xs text-muted-foreground shrink-0">{campaign.dailyBudget}/day</span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {campaign.targeting && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {campaign.targeting.locations?.join(', ')}
              {campaign.targeting.ageRange && <span>· {campaign.targeting.ageRange}</span>}
              {campaign.targeting.gender && <span>· {campaign.targeting.gender}</span>}
            </div>
          )}
          {campaign.adSets.map((adSet, i) => (
            <div key={i} className="ml-4 rounded border bg-muted/20 p-2 space-y-1">
              <p className="text-xs font-semibold text-foreground">{adSet.name}</p>
              {adSet.audience && <p className="text-xs text-muted-foreground">{adSet.audience}</p>}
              {adSet.ads.map((ad, j) => (
                <div key={j} className="ml-2 text-xs text-muted-foreground border-l pl-2">
                  <p className="font-medium text-foreground">{ad.headline}</p>
                  {ad.description && <p className="truncate">{ad.description}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CatalogMediaPlanPreview({ planName, totalBudget, platforms, campaigns }: MediaPlanPreviewProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          {planName && <p className="text-sm font-semibold text-foreground">{planName}</p>}
          {platforms && <p className="text-xs text-muted-foreground">{platforms.join(' · ')}</p>}
        </div>
        {totalBudget && (
          <p className="text-sm font-semibold tabular-nums">{totalBudget} total</p>
        )}
      </div>
      <div className="space-y-2">
        {campaigns.map((c, i) => <CampaignNode key={i} campaign={c} />)}
      </div>
    </div>
  );
}
