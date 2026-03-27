'use client';

import * as React from 'react';
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  SendIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthDimension = {
  score: number;
  max: number;
  label: string;
  detail: string;
};

type HealthData = {
  overall_score: number;
  max_score: number;
  grade: string;
  dimensions: Record<string, HealthDimension>;
  recommendations: Array<{ dimension: string; label: string; priority: 'high' | 'medium' }>;
};

type DashboardData = {
  period: { days: number };
  overview: {
    total_spend: number;
    total_revenue: number;
    blended_roas: number;
    total_orders: number;
    active_campaigns: number;
  };
  period_comparison: {
    spend_change_pct: number | null;
    revenue_change_pct: number | null;
    roas_change_pct: number | null;
  };
  platforms: Array<{ platform: string; spend: number; revenue: number; roas: number; ctr: number; cpa: number }>;
  revenue_trend: Array<{ date: string; revenue: number; orders: number }>;
};

type BriefData = {
  brief: string;
  summary: { total_spend: number; total_revenue: number; blended_roas: number; platforms: number };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctBadge(pct: number | null) {
  if (pct === null) return null;
  const positive = pct >= 0;
  return (
    <span className={cn('text-xs font-medium', positive ? 'text-green-600' : 'text-red-600')}>
      {positive ? <TrendingUpIcon className="inline size-3 mr-0.5" /> : <TrendingDownIcon className="inline size-3 mr-0.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const DIMENSION_LABELS: Record<string, string> = {
  spend_efficiency: 'Spend Efficiency',
  audience_health: 'Audience Health',
  creative_performance: 'Creative Performance',
  funnel_health: 'Funnel Health',
  budget_pacing: 'Budget Pacing',
};

// ---------------------------------------------------------------------------
// Health Score Ring
// ---------------------------------------------------------------------------

function HealthRing({ score, max, grade }: { score: number; max: number; grade: string }) {
  const pct = max > 0 ? score / max : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const gradeColor =
    grade === 'A' ? '#10B981' :
    grade === 'B' ? '#3B82F6' :
    grade === 'C' ? '#F59E0B' :
    grade === 'D' ? '#EF4444' : '#6B7280';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="70" cy="70" r={radius} fill="none" strokeWidth="10"
          stroke={gradeColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-foreground" style={{ color: gradeColor }}>{score}</p>
        <p className="text-xs text-muted-foreground">/ {max}</p>
        <p className="text-lg font-bold mt-0.5" style={{ color: gradeColor }}>{grade}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CMO Client
// ---------------------------------------------------------------------------

type Props = {
  orgCurrency: string;
};

export function CmoClient({ orgCurrency }: Props) {
  const currencySymbol = orgCurrency === 'USD' ? '$' : orgCurrency === 'EUR' ? '€' : orgCurrency === 'GBP' ? '£' : '$';

  const [activeTab, setActiveTab] = React.useState<'overview' | 'health' | 'ask'>('overview');
  const [loadingDashboard, setLoadingDashboard] = React.useState(true);
  const [loadingHealth, setLoadingHealth] = React.useState(false);
  const [loadingBrief, setLoadingBrief] = React.useState(true);
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [health, setHealth] = React.useState<HealthData | null>(null);
  const [brief, setBrief] = React.useState<BriefData | null>(null);
  const [question, setQuestion] = React.useState('');
  const [askAnswer, setAskAnswer] = React.useState<string | null>(null);
  const [askLoading, setAskLoading] = React.useState(false);
  const [days, setDays] = React.useState(30);

  React.useEffect(() => {
    async function loadDashboard() {
      setLoadingDashboard(true);
      try {
        const res = await fetch(`/api/cmo?action=dashboard&days=${days}`);
        const data = await res.json();
        setDashboard(data);
      } catch { /* ignore */ }
      setLoadingDashboard(false);
    }
    async function loadBrief() {
      setLoadingBrief(true);
      try {
        const res = await fetch('/api/cmo?action=brief');
        const data = await res.json();
        setBrief(data);
      } catch { /* ignore */ }
      setLoadingBrief(false);
    }
    void loadDashboard();
    void loadBrief();
  }, [days]);

  const loadHealth = React.useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/cmo?action=health');
      const data = await res.json();
      setHealth(data);
    } catch { /* ignore */ }
    setLoadingHealth(false);
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const res = await fetch('/api/cmo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', question }),
      });
      const data = await res.json();
      setAskAnswer(data.answer ?? 'No answer returned');
    } catch { setAskAnswer('Failed to get answer.'); }
    setAskLoading(false);
  };

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'health' as const, label: 'Health Score' },
    { id: 'ask' as const, label: 'Ask CMO' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <BrainCircuitIcon className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">AI CMO</h2>
          <p className="text-xs text-muted-foreground">Strategic marketing intelligence · Powered by Claude</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="text-xs border border-border bg-background rounded-lg px-2 py-1.5"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Daily brief card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Daily Brief</p>
          <button
            type="button"
            onClick={() => { setBrief(null); setLoadingBrief(true); fetch('/api/cmo?action=brief').then((r) => r.json()).then((d) => { setBrief(d); setLoadingBrief(false); }); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
        </div>
        {loadingBrief ? (
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 text-muted-foreground animate-spin" />
            <p className="text-xs text-muted-foreground">Generating brief...</p>
          </div>
        ) : brief ? (
          <div>
            <div className="flex gap-4 mb-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Spend</p>
                <p className="text-sm font-semibold">{currencySymbol}{brief.summary.total_spend.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-sm font-semibold">{currencySymbol}{brief.summary.total_revenue.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className="text-sm font-semibold">{brief.summary.blended_roas.toFixed(1)}x</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{brief.brief}</p>
          </div>
        ) : null}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'health' && !health) void loadHealth();
            }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div>
          {loadingDashboard ? (
            <div className="flex items-center justify-center h-40">
              <Loader2Icon className="size-6 text-muted-foreground animate-spin" />
            </div>
          ) : dashboard ? (
            <div className="space-y-4">
              {/* KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Spend', value: `${currencySymbol}${dashboard.overview.total_spend.toLocaleString()}`, change: dashboard.period_comparison.spend_change_pct },
                  { label: 'Revenue', value: `${currencySymbol}${dashboard.overview.total_revenue.toLocaleString()}`, change: dashboard.period_comparison.revenue_change_pct },
                  { label: 'Blended ROAS', value: `${dashboard.overview.blended_roas.toFixed(1)}x`, change: dashboard.period_comparison.roas_change_pct },
                  { label: 'Orders', value: dashboard.overview.total_orders.toLocaleString(), change: null },
                  { label: 'Active Campaigns', value: dashboard.overview.active_campaigns.toLocaleString(), change: null },
                ].map((kpi, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
                    {kpi.change !== null && <div className="mt-0.5">{pctBadge(kpi.change)}</div>}
                  </div>
                ))}
              </div>

              {/* Platform breakdown */}
              {dashboard.platforms.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Platform Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left pb-2">Platform</th>
                          <th className="text-right pb-2">Spend</th>
                          <th className="text-right pb-2">Revenue</th>
                          <th className="text-right pb-2">ROAS</th>
                          <th className="text-right pb-2">CTR</th>
                          <th className="text-right pb-2">CPA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.platforms.map((p, i) => {
                          const roasColor = p.roas >= 3 ? 'text-green-600' : p.roas >= 1 ? 'text-amber-600' : 'text-red-600';
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="py-2 font-medium capitalize">{p.platform}</td>
                              <td className="py-2 text-right">{currencySymbol}{p.spend.toLocaleString()}</td>
                              <td className="py-2 text-right">{currencySymbol}{p.revenue.toLocaleString()}</td>
                              <td className={cn('py-2 text-right font-bold', roasColor)}>{p.roas.toFixed(1)}x</td>
                              <td className="py-2 text-right">{p.ctr.toFixed(2)}%</td>
                              <td className="py-2 text-right">{currencySymbol}{p.cpa.toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'health' && (
        <div>
          {loadingHealth ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Loader2Icon className="size-6 text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">Calculating health score...</p>
            </div>
          ) : health ? (
            <div className="space-y-4">
              {/* Score ring + grade */}
              <div className="rounded-xl border border-border bg-card p-6 flex flex-col md:flex-row items-center gap-6">
                <HealthRing score={health.overall_score} max={health.max_score} grade={health.grade} />
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground mb-3">Marketing Health Score</h3>
                  <div className="space-y-2">
                    {Object.entries(health.dimensions).map(([key, dim]) => {
                      const pct = dim.max > 0 ? (dim.score / dim.max) * 100 : 0;
                      const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{DIMENSION_LABELS[key] ?? key}</span>
                            <span className="font-medium text-foreground">{dim.score}/{dim.max} — {dim.label}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {health.recommendations.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Recommendations</h3>
                  <div className="space-y-2">
                    {health.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                        <CheckCircle2Icon className="size-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{rec.dimension}</p>
                          <p className="text-xs text-muted-foreground">{rec.label}</p>
                        </div>
                        <span className={cn(
                          'ml-auto shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                          rec.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        )}>
                          {rec.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Button onClick={() => void loadHealth()}>Calculate Health Score</Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ask' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquareIcon className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Ask your AI CMO anything</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !askLoading && void handleAsk()}
                placeholder="Which platform has the best ROAS this month?"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button onClick={handleAsk} disabled={askLoading || !question.trim()} size="sm">
                {askLoading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </div>

            {/* Suggested questions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                'Which platform has the best ROAS?',
                'Where is our spend going?',
                'What is our cost per acquisition?',
                'How is performance trending?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {askLoading && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card">
              <Loader2Icon className="size-4 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">AI CMO is analyzing your data...</p>
            </div>
          )}

          {askAnswer && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuitIcon className="size-4 text-primary" />
                <p className="text-xs font-semibold text-primary">AI CMO</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{askAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
