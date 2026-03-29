'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import type { ActionButtonProps } from '~/lib/chat-ui/catalog-schema';

const styleClasses = {
  primary:     'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

export function CatalogActionButton({ label, action, target, style = 'primary', disabled }: ActionButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    if (action === 'navigate' && target) {
      router.push(target);
    }
    // Other actions (confirm, dismiss) handled by parent context
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${styleClasses[style ?? 'primary']} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}
