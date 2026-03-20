'use client';

import * as React from 'react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import type { AgentName, AgentState } from './types';

// ── Agent metadata ────────────────────────────────────────────────────────────

const AGENT_META: Record<AgentName, { label: string; icon: string }> = {
  brand: { label: 'Brand Analysis Agent', icon: '🎨' },
  lpu: { label: 'Landing Page Agent', icon: '📄' },
  intent: { label: 'Intent Analysis Agent', icon: '🎯' },
  trend: { label: 'Trend Analysis Agent', icon: '📈' },
  competitor: { label: 'Competitor Analysis Agent', icon: '🔍' },
  creative: { label: 'Creative Agent', icon: '✨' },
  budget: { label: 'Budget Agent', icon: '💰' },
  strategy: { label: 'Strategy Agent', icon: '🚀' }
};

// ── Props ─────────────────────────────────────────────────────────────────────

type AgentProgressPanelProps = {
  agents: AgentState[];
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentProgressPanel({
  agents,
  onClose
}: AgentProgressPanelProps): React.JSX.Element {
  const completedCount = agents.filter((a) => a.status === 'complete').length;
  const totalCount = agents.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <ZapIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Agents Working</p>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {totalCount} completed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {agents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>
    </div>
  );
}

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentState }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(agent.expanded);
  const meta = AGENT_META[agent.name];

  // Sync expanded from parent
  React.useEffect(() => {
    setExpanded(agent.expanded);
  }, [agent.expanded]);

  const isComplete = agent.status === 'complete';
  const isRunning = agent.status === 'running';
  const isError = agent.status === 'error';

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-200',
        isComplete && 'border-green-200 dark:border-green-900',
        isRunning && 'border-primary/30 shadow-sm',
        isError && 'border-destructive/30',
        !isComplete && !isRunning && !isError && 'border-border'
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{meta.label}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {isComplete && agent.completedMessage
              ? agent.completedMessage
              : agent.currentMessage || 'Waiting...'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          {isComplete && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
              <CheckCircle2Icon className="size-3" />
              DONE
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Loader2Icon className="size-3 animate-spin" />
              Running
            </span>
          )}
          {isError && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Error
            </span>
          )}
          {agent.status === 'idle' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Idle
            </span>
          )}
          {/* Expand toggle */}
          {(isComplete || isRunning) && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronUpIcon className="size-3.5" />
              ) : (
                <ChevronDownIcon className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Capability list */}
          {agent.output && agent.output.capabilities.length > 0 && (
            <div className="space-y-1.5">
              {agent.output.capabilities.map((cap, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-medium text-muted-foreground w-4">
                    {i + 1}.
                  </span>
                  <div>
                    <span className="font-medium text-foreground">{cap.title}</span>
                    {cap.description && (
                      <span className="text-muted-foreground"> — {cap.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {agent.output?.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {agent.output.summary}
            </p>
          )}

          {/* Performance metrics */}
          {isComplete && (agent.timeTaken !== undefined || agent.confidence) && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
              {agent.timeTaken !== undefined && (
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="size-3 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Time Taken
                    </p>
                    <p className="text-xs font-semibold text-foreground">
                      {agent.timeTaken.toFixed(1)}s
                    </p>
                  </div>
                </div>
              )}
              {agent.confidence && (
                <div className="ml-auto">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Confidence
                  </p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      agent.confidence === 'High' &&
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                      agent.confidence === 'Medium' &&
                        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                      agent.confidence === 'Low' &&
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    )}
                  >
                    {agent.confidence}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {isComplete && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={() => {/* Rerun agent */}}
              >
                <RefreshCwIcon className="size-3" />
                Rerun
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={() => {/* Explain agent output */}}
              >
                ? Explain
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={() => {/* Improve agent */}}
              >
                <SparklesIcon className="size-3" />
                Improve
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
