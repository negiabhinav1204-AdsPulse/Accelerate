'use client';
import React from 'react';
import { CatalogRenderer } from '~/lib/chat-ui/catalog-registry';
import type { CatalogSpec } from '~/lib/chat-ui/catalog-schema';

interface JsonRenderBlockProps {
  spec: unknown;
}

export function JsonRenderBlock({ spec }: JsonRenderBlockProps) {
  // Basic type guard — if spec is not an object with a type string, show fallback
  if (
    !spec ||
    typeof spec !== 'object' ||
    !('type' in spec) ||
    typeof (spec as Record<string, unknown>).type !== 'string'
  ) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-3 text-xs text-muted-foreground">
        Unable to render component. Invalid spec.
      </div>
    );
  }

  try {
    return <CatalogRenderer spec={spec as CatalogSpec} />;
  } catch {
    return (
      <div className="rounded border border-dashed border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
        Render error — unable to display this component.
      </div>
    );
  }
}
