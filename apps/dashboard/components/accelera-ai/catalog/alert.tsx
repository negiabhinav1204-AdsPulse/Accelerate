'use client';
import React from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import type { AlertProps } from '~/lib/chat-ui/catalog-schema';

const alertConfig = {
  info: {
    icon: InfoIcon,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    iconClass: 'text-blue-500',
  },
  warning: {
    icon: TriangleAlertIcon,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    iconClass: 'text-yellow-500',
  },
  error: {
    icon: AlertCircleIcon,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    iconClass: 'text-red-500',
  },
  success: {
    icon: CheckCircleIcon,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    iconClass: 'text-green-500',
  },
};

export function CatalogAlert({ type, title, message }: AlertProps) {
  const c = alertConfig[type];
  const Icon = c.icon;
  return (
    <div className={`rounded-lg border p-3 flex gap-2.5 ${c.bg} ${c.border}`}>
      <Icon className={`size-4 mt-0.5 shrink-0 ${c.iconClass}`} />
      <div className="space-y-0.5">
        {title && <p className={`text-xs font-semibold ${c.text}`}>{title}</p>}
        <p className={`text-xs ${c.text}`}>{message}</p>
      </div>
    </div>
  );
}
