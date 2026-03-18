'use client';

import * as React from 'react';
import {
  BarChart3Icon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-campaign',
    label: 'Create a campaign',
    icon: <ZapIcon className="size-5" />,
    description: 'Launch a new ad campaign across platforms'
  },
  {
    id: 'analyse',
    label: 'Analyse my Ad Account',
    icon: <BarChart3Icon className="size-5" />,
    description: 'Get AI-powered insights on your performance'
  },
  {
    id: 'optimise',
    label: 'Optimise my campaigns',
    icon: <TrendingUpIcon className="size-5" />,
    description: 'Let Accelera find opportunities to improve'
  }
];

type AcceleraAiHomeProps = {
  firstName: string;
};

export function AcceleraAiHome({
  firstName
}: AcceleraAiHomeProps): React.JSX.Element {
  const [input, setInput] = React.useState('');

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] px-4 py-16">
      <div className="w-full max-w-2xl space-y-12">
        {/* Greeting */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <SparklesIcon className="size-6" />
            <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              accelera ai
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Good to see you, {firstName}.
          </h1>
          <p className="text-muted-foreground">
            What would you like to create today?
          </p>
        </div>

        {/* Input */}
        <div className="relative">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <SparklesIcon className="size-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Accelerate to create a campaign..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              disabled
            />
            <Button
              size="sm"
              variant="default"
              className="gap-2 shrink-0"
              disabled
            >
              <SendIcon className="size-4" />
              Send
            </Button>
          </div>
          {/* Coming soon badge */}
          <div className="absolute -top-3 right-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400">
              Accelera AI — Coming soon
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
            Quick actions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {action.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          Accelera AI is currently in development. Stay tuned for updates.
        </p>
      </div>
    </div>
  );
}
