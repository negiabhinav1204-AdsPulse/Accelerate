'use client';
import React from 'react';
import type { ActionRowProps } from '~/lib/chat-ui/catalog-schema';
import { CatalogActionButton } from './action-button';

export function CatalogActionRow({ actions }: ActionRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => <CatalogActionButton key={i} {...a} />)}
    </div>
  );
}
