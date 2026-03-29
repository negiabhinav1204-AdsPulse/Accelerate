'use client';
import React from 'react';
import type { CreativePreviewProps } from '~/lib/chat-ui/catalog-schema';
import { platformColors } from '~/lib/chat-ui/theme';

export function CatalogCreativePreview({ headline, description, imageUrl, platform, ctaLabel }: CreativePreviewProps) {
  const pc = platform ? platformColors[platform.toLowerCase() as keyof typeof platformColors] : null;
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {imageUrl ? (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <img src={imageUrl} alt={headline} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No preview</p>
        </div>
      )}
      <div className="p-3 space-y-1">
        {platform && pc && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: pc.light, color: pc.primary }}
          >
            {platform}
          </span>
        )}
        <p className="text-sm font-semibold text-foreground line-clamp-2">{headline}</p>
        {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
        {ctaLabel && (
          <div className="pt-1">
            <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground">
              {ctaLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
