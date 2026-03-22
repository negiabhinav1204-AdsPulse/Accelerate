'use client';

import * as React from 'react';
import {
  ArrowRightIcon,
  BarChart3Icon,
  LinkIcon,
  SettingsIcon,
  SparklesIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

type NavPath =
  | 'create-campaign'
  | 'campaigns'
  | 'reporting'
  | 'connectors'
  | 'settings'
  | 'accelera-ai';

const PATH_ICONS: Record<NavPath, React.ReactNode> = {
  'create-campaign': <ZapIcon className="size-4" />,
  campaigns: <ZapIcon className="size-4" />,
  reporting: <BarChart3Icon className="size-4" />,
  connectors: <LinkIcon className="size-4" />,
  settings: <SettingsIcon className="size-4" />,
  'accelera-ai': <SparklesIcon className="size-4" />
};

type ChatNavSuggestionProps = {
  label: string;
  description: string;
  path: NavPath;
  orgSlug: string;
};

export function ChatNavSuggestion({
  label,
  description,
  path,
  orgSlug
}: ChatNavSuggestionProps): React.JSX.Element {
  const href = `/organizations/${orgSlug}/${path}`;

  return (
    <div className="rounded-xl border border-border bg-background p-4 w-full my-2 flex items-center gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {PATH_ICONS[path] ?? <ArrowRightIcon className="size-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" variant="outline" asChild className="shrink-0">
        <a href={href}>
          Go <ArrowRightIcon className="size-3 ml-1" />
        </a>
      </Button>
    </div>
  );
}
