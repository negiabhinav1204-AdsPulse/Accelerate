'use client';

import * as React from 'react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  MapIcon,
  SparklesIcon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentName = 'scout' | 'pulse' | 'radar' | 'edge' | 'oracle';

type AgentState = {
  name: AgentName;
  status: 'idle' | 'running' | 'complete' | 'error';
  activity?: string;
  findings: string[];
  duration?: number;
};

type Allocation = {
  label: string;
  value: number;
  daily_value: number;
  badge: string;
  description: string;
};

type PlatformPrediction = {
  platform: string;
  spend: number;
  revenue: number;
  roas: string;
  description: string;
};

type RichCard =
  | { type: 'kpi_cards'; items: Array<{ label: string; value: string; sub_value?: string; icon: string }> }
  | { type: 'budget_allocation'; title: string; total_monthly: number; total_daily: number; context: string; items: Allocation[] }
  | { type: 'metric_highlight'; label: string; value: string; context: string; color: string; sub_metrics: Array<{ label: string; value: string }> }
  | { type: 'platform_comparison'; title: string; items: PlatformPrediction[] };

// ---------------------------------------------------------------------------
// Agent metadata
// ---------------------------------------------------------------------------

const AGENT_META: Record<AgentName, { label: string; description: string; icon: string }> = {
  scout:  { label: 'SCOUT', description: 'Analyzing your business profile', icon: '🔭' },
  pulse:  { label: 'PULSE', description: 'Measuring addressable demand', icon: '📡' },
  radar:  { label: 'RADAR', description: 'Reviewing past performance', icon: '📊' },
  edge:   { label: 'EDGE',  description: 'Optimizing spend allocation',   icon: '⚖️' },
  oracle: { label: 'ORACLE', description: 'Predicting campaign outcomes',  icon: '🔮' },
};

const AGENT_ORDER: AgentName[] = ['scout', 'pulse', 'radar', 'edge', 'oracle'];

// ---------------------------------------------------------------------------
// Platform badge helper
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  meta: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  bing: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

function platformBadge(name: string) {
  const key = name.toLowerCase().split(' ')[0];
  return PLATFORM_COLORS[key] ?? 'bg-muted text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Rich content card renderers
// ---------------------------------------------------------------------------

function KpiCards({ items }: { items: RichCard & { type: 'kpi_cards' } extends { items: infer I } ? I : never }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
          <p className="text-lg font-semibold text-foreground">{item.value}</p>
          {item.sub_value && <p className="text-xs text-muted-foreground">{item.sub_value}</p>}
        </div>
      ))}
    </div>
  );
}

function BudgetAllocationCard({ card }: { card: RichCard & { type: 'budget_allocation' } }) {
  const total = card.total_monthly;
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{card.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{card.context}</p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-lg font-bold text-foreground">${total.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
          <p className="text-xs text-muted-foreground">${card.total_daily.toLocaleString()}/day</p>
        </div>
      </div>
      <div className="space-y-2">
        {card.items.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', platformBadge(item.label))}>
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.badge}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">${item.value.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricHighlightCard({ card }: { card: RichCard & { type: 'metric_highlight' } }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
      <p className="text-3xl font-bold mb-1" style={{ color: card.color }}>{card.value}</p>
      <p className="text-xs text-muted-foreground mb-3">{card.context}</p>
      <div className="grid grid-cols-3 gap-2">
        {card.sub_metrics.map((m, i) => (
          <div key={i} className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformComparisonCard({ card }: { card: RichCard & { type: 'platform_comparison' } }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <h3 className="font-semibold text-foreground text-sm mb-3">{card.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left pb-2">Channel</th>
              <th className="text-right pb-2">Spend</th>
              <th className="text-right pb-2">Revenue</th>
              <th className="text-right pb-2">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {card.items.map((item, i) => {
              const roas = parseFloat(item.roas);
              const roasColor = roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-amber-600' : 'text-red-600';
              return (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-2">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', platformBadge(item.platform))}>
                      {item.platform}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </td>
                  <td className="py-2 text-right font-medium">${item.spend.toLocaleString()}</td>
                  <td className="py-2 text-right font-medium">${item.revenue.toLocaleString()}</td>
                  <td className={cn('py-2 text-right font-bold', roasColor)}>{item.roas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RichContent({ cards }: { cards: RichCard[] }) {
  return (
    <div>
      {cards.map((card, i) => {
        if (card.type === 'kpi_cards') return <KpiCards key={i} items={card.items} />;
        if (card.type === 'budget_allocation') return <BudgetAllocationCard key={i} card={card} />;
        if (card.type === 'metric_highlight') return <MetricHighlightCard key={i} card={card} />;
        if (card.type === 'platform_comparison') return <PlatformComparisonCard key={i} card={card} />;
        return null;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent stepper
// ---------------------------------------------------------------------------

function AgentStepper({ agents }: { agents: AgentState[] }) {
  const [expanded, setExpanded] = React.useState<AgentName | null>(null);

  return (
    <div className="space-y-2">
      {agents.map((agent) => {
        const meta = AGENT_META[agent.name];
        const isExpanded = expanded === agent.name;

        return (
          <div
            key={agent.name}
            className={cn(
              'rounded-lg border transition-colors',
              agent.status === 'complete' ? 'border-green-500/30 bg-green-500/5' :
              agent.status === 'running' ? 'border-primary/30 bg-primary/5' :
              'border-border bg-card',
            )}
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 p-3 text-left"
              onClick={() => agent.status === 'complete' && setExpanded(isExpanded ? null : agent.name)}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {agent.status === 'complete' ? (
                  <CheckCircle2Icon className="size-5 text-green-500" />
                ) : agent.status === 'running' ? (
                  <Loader2Icon className="size-5 text-primary animate-spin" />
                ) : (
                  <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{meta.icon} {meta.label}</span>
                  {agent.duration && (
                    <span className="text-xs text-muted-foreground">{agent.duration.toFixed(1)}s</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {agent.status === 'running' ? (agent.activity ?? meta.description) : meta.description}
                </p>
              </div>

              {/* Expand toggle for complete agents */}
              {agent.status === 'complete' && agent.findings.length > 0 && (
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                </div>
              )}
            </button>

            {/* Findings */}
            {isExpanded && agent.findings.length > 0 && (
              <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-1">
                {agent.findings.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground">· {f}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  orgSlug: string;
  orgCurrency: string;
};

const OBJECTIVES = [
  { value: 'max_conversions', label: 'Max Conversions' },
  { value: 'max_roas', label: 'Maximize ROAS' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'lead_generation', label: 'Lead Generation' },
];

const PLATFORM_OPTIONS = [
  { value: 'google', label: 'Google Ads' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'bing', label: 'Microsoft Bing' },
];

export function MediaPlannerClient({ orgCurrency }: Props) {
  const [budget, setBudget] = React.useState('');
  const [objective, setObjective] = React.useState('max_conversions');
  const [platforms, setPlatforms] = React.useState<string[]>(['google', 'meta']);
  const [phase, setPhase] = React.useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [agents, setAgents] = React.useState<AgentState[]>(
    AGENT_ORDER.map((name) => ({ name, status: 'idle', findings: [] }))
  );
  const [richContent, setRichContent] = React.useState<RichCard[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [totalDuration, setTotalDuration] = React.useState<number | null>(null);

  const currencySymbol = orgCurrency === 'USD' ? '$' : orgCurrency === 'EUR' ? '€' : orgCurrency === 'GBP' ? '£' : '$';

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const updateAgent = (name: AgentName, patch: Partial<AgentState>) => {
    setAgents((prev) => prev.map((a) => (a.name === name ? { ...a, ...patch } : a)));
  };

  const handleRun = async () => {
    const budgetNum = parseFloat(budget.replace(/,/g, ''));
    if (!budgetNum || budgetNum < 100) return;

    setPhase('running');
    setError(null);
    setRichContent([]);
    setTotalDuration(null);
    setAgents(AGENT_ORDER.map((name) => ({ name, status: 'idle', findings: [] })));

    try {
      const res = await fetch('/api/media-planner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: budgetNum,
          objective,
          selectedPlatforms: platforms,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Failed to start media planning');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.type === 'agent_running') {
              updateAgent(event.agent as AgentName, {
                status: 'running',
                activity: event.activity as string,
              });
            } else if (event.type === 'agent_complete') {
              updateAgent(event.agent as AgentName, {
                status: 'complete',
                duration: event.duration as number,
                findings: (event.findings as string[]) ?? [],
              });
            } else if (event.type === 'agent_error') {
              updateAgent(event.agent as AgentName, { status: 'error' });
            } else if (event.type === 'plan_complete') {
              const result = event.result as { rich_content: RichCard[]; total_duration_seconds: number };
              setRichContent(result.rich_content ?? []);
              setTotalDuration(result.total_duration_seconds);
              setPhase('complete');
            } else if (event.type === 'plan_error') {
              setError(event.error as string ?? 'Planning failed');
              setPhase('error');
            }
          } catch { /* ignore malformed events */ }
        }
      }
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 h-full">
      {/* Left panel — form + agent stepper */}
      <div className="flex flex-col gap-4">
        {/* Input form */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <MapIcon className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Media Planner</h2>
              <p className="text-xs text-muted-foreground">5 AI agents · ~2 min</p>
            </div>
          </div>

          {/* Budget */}
          <div className="mb-3">
            <label className="text-xs font-medium text-foreground mb-1 block">Monthly Budget</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="10,000"
                disabled={phase === 'running'}
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Objective */}
          <div className="mb-3">
            <label className="text-xs font-medium text-foreground mb-1 block">Campaign Objective</label>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={phase === 'running'}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Platforms */}
          <div className="mb-4">
            <label className="text-xs font-medium text-foreground mb-2 block">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  disabled={phase === 'running'}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-50',
                    platforms.includes(p.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleRun}
            disabled={phase === 'running' || !budget || parseFloat(budget.replace(/,/g, '')) < 100}
            className="w-full"
          >
            {phase === 'running' ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Agents Working...
              </>
            ) : (
              <>
                <SparklesIcon className="size-4 mr-2" />
                Generate Media Plan
              </>
            )}
          </Button>
        </div>

        {/* Agent stepper */}
        {phase !== 'idle' && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Agent Pipeline</p>
              {totalDuration && (
                <p className="text-xs text-muted-foreground">{totalDuration}s total</p>
              )}
            </div>
            <AgentStepper agents={agents} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Right panel — plan output */}
      <div className="min-h-[400px]">
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-xl border border-dashed border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <ZapIcon className="size-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Ready to build your media plan</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Enter your monthly budget and let 5 AI agents analyze your data and allocate spend across channels.
            </p>
          </div>
        )}

        {phase === 'running' && richContent.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Loader2Icon className="size-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">
              {agents.find((a) => a.status === 'running')
                ? `${AGENT_META[agents.find((a) => a.status === 'running')!.name].label} is working...`
                : 'Starting agents...'}
            </p>
          </div>
        )}

        {richContent.length > 0 && (
          <div>
            {phase === 'complete' && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <TrendingUpIcon className="size-4 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Media plan complete · {totalDuration}s
                </p>
              </div>
            )}
            <RichContent cards={richContent} />
          </div>
        )}
      </div>
    </div>
  );
}
