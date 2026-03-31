'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  Loader2Icon,
  RefreshCwIcon,
  ScanSearchIcon,
  SendIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'warning' | 'opportunity' | 'healthy';

interface AuditFinding {
  id: string;
  category: string;
  severity: Severity;
  platform: string | null;
  title: string;
  description: string;
  impact: string;
  cta: { label: string; action: string; target: string } | null;
  // Deep audit fields
  cta_label?: string;
  cta_target?: string;
}

interface AuditData {
  phase: 'instant' | 'deep';
  generated_at: string;
  accounts_audited: Array<{ platform: string; accountId: string; accountName: string }>;
  summary: { critical: number; warning: number; opportunity: number; healthy: number };
  findings: AuditFinding[];
  ai_summary: string;
  overall_score?: number;
  score_breakdown?: Record<string, number>;
  executive_summary?: string;
  recommendations?: Array<{
    id: string; title: string; rationale: string; estimated_impact: string;
    platform: string; objective: string; suggested_budget: number;
  }>;
  savings_estimate?: { monthly_wasted_spend: number; potential_cpa_improvement_pct: number; potential_roas_improvement_pct: number };
  report_id?: string;
}

interface DashboardData {
  period: { days: number };
  overview: { total_spend: number; total_revenue: number; blended_roas: number; total_orders: number; active_campaigns: number };
  period_comparison: { spend_change_pct: number | null; revenue_change_pct: number | null; roas_change_pct: number | null };
  platforms: Array<{ platform: string; spend: number; revenue: number; roas: number; ctr: number; cpa: number }>;
}

interface BriefData {
  brief: string;
  summary: { total_spend: number; total_revenue: number; blended_roas: number; platforms: number };
}

type Tab = 'overview' | 'deep-analysis' | 'ask-cmo';

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEV: Record<Severity, { icon: React.ElementType; color: string; bg: string; dot: string; label: string }> = {
  critical:    { icon: AlertCircleIcon,  color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30',    dot: 'bg-red-500',    label: 'Critical' },
  warning:     { icon: CircleAlertIcon,  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500',  label: 'Warning' },
  opportunity: { icon: ZapIcon,          color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/30',   dot: 'bg-blue-500',   label: 'Opportunity' },
  healthy:     { icon: CheckCircle2Icon, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/30', dot: 'bg-green-500',  label: 'Healthy' },
};

const SCORE_DIMENSIONS: Record<string, { label: string; max: number }> = {
  tracking_attribution: { label: 'Tracking & Attribution', max: 20 },
  spend_efficiency:     { label: 'Spend Efficiency',        max: 20 },
  creative_health:      { label: 'Creative Health',         max: 15 },
  audience_targeting:   { label: 'Audience & Targeting',    max: 15 },
  funnel_health:        { label: 'Funnel Health',           max: 15 },
  budget_pacing:        { label: 'Budget Pacing',           max: 15 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctBadge(pct: number | null) {
  if (pct === null) return null;
  const positive = pct >= 0;
  return (
    <span className={cn('text-xs font-medium flex items-center gap-0.5', positive ? 'text-green-600' : 'text-red-600')}>
      {positive ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const color = pct >= 0.7 ? '#10B981' : pct >= 0.5 ? '#3B82F6' : pct >= 0.35 ? '#F59E0B' : '#EF4444';
  const grade = pct >= 0.85 ? 'A' : pct >= 0.7 ? 'B' : pct >= 0.55 ? 'C' : pct >= 0.4 ? 'D' : 'F';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle cx="70" cy="70" r={radius} fill="none" strokeWidth="10" stroke={color}
          strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-muted-foreground">/ {max}</p>
        <p className="text-lg font-bold mt-0.5" style={{ color }}>{grade}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finding Card
// ---------------------------------------------------------------------------

function FindingCard({ finding, orgSlug }: { finding: AuditFinding; orgSlug: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const router = useRouter();
  const sev = SEV[finding.severity];
  const Icon = sev.icon;
  const ctaTarget = finding.cta?.target ?? finding.cta_target;
  const ctaLabel = finding.cta?.label ?? finding.cta_label;

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', finding.severity === 'healthy' && 'opacity-70')}>
      <button
        type="button"
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', sev.bg)}>
          <Icon className={cn('size-3.5', sev.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', sev.bg, sev.color)}>{sev.label}</span>
            {finding.platform && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{finding.platform}</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-1">{finding.title}</p>
        </div>
        {expanded ? <ChevronUpIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDownIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 bg-muted/20">
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{finding.description}</p>
          {finding.impact && (
            <p className="text-xs text-foreground/70 mt-2 leading-relaxed">
              <span className="font-medium">Impact: </span>{finding.impact}
            </p>
          )}
          {ctaTarget && ctaLabel && (
            <Button
              size="sm"
              className="mt-3 h-7 text-xs gap-1"
              onClick={() => router.push(ctaTarget)}
            >
              {ctaLabel}
              <ArrowRightIcon className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CmoClient
// ---------------------------------------------------------------------------

export function CmoClient({ orgCurrency, orgSlug }: { orgCurrency: string; orgSlug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'overview';

  const curr = orgCurrency === 'USD' ? '$' : orgCurrency === 'EUR' ? '€' : orgCurrency === 'GBP' ? '£' : '$';

  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [days, setDays] = React.useState(30);

  // Overview state
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [brief, setBrief] = React.useState<BriefData | null>(null);
  const [loadingDash, setLoadingDash] = React.useState(true);
  const [loadingBrief, setLoadingBrief] = React.useState(true);

  // Instant audit state (Phase 1)
  const [instantAudit, setInstantAudit] = React.useState<AuditData | null>(null);
  const [loadingInstant, setLoadingInstant] = React.useState(false);
  const [instantRan, setInstantRan] = React.useState(false);

  // Deep analysis state (Phase 2)
  const [deepReport, setDeepReport] = React.useState<AuditData | null>(null);
  const [loadingDeep, setLoadingDeep] = React.useState(false);
  const [deepRunning, setDeepRunning] = React.useState(false);

  // Ask CMO state
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [askLoading, setAskLoading] = React.useState(false);

  const isNewUser = !dashboard || (dashboard.overview.total_spend === 0 && dashboard.overview.active_campaigns === 0);

  // Load dashboard + brief on mount
  React.useEffect(() => {
    void loadDashboard();
    void loadBrief();
    void loadLatestDeepReport();
    // Auto-run instant audit once
    void loadInstantAudit();
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [days]);

  // Sync tab from URL
  React.useEffect(() => {
    const t = searchParams.get('tab') as Tab | null;
    if (t && t !== tab) setTab(t);
  }, [searchParams]);

  function switchTab(t: Tab) {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  async function loadDashboard() {
    setLoadingDash(true);
    try {
      const res = await fetch(`/api/cmo?action=dashboard&days=${days}`);
      const data = await res.json() as DashboardData;
      setDashboard(data);
    } catch { /* ignore */ }
    setLoadingDash(false);
  }

  async function loadBrief() {
    setLoadingBrief(true);
    try {
      const res = await fetch('/api/cmo?action=brief');
      const data = await res.json() as BriefData;
      setBrief(data);
    } catch { /* ignore */ }
    setLoadingBrief(false);
  }

  async function loadInstantAudit() {
    if (instantRan) return;
    setLoadingInstant(true);
    setInstantRan(true);
    try {
      const res = await fetch('/api/cmo/audit');
      const data = await res.json() as AuditData;
      setInstantAudit(data);
    } catch { /* ignore */ }
    setLoadingInstant(false);
  }

  async function loadLatestDeepReport() {
    try {
      const res = await fetch('/api/cmo/audit?phase=latest');
      const data = await res.json() as { report: AuditData | null };
      if (data.report) setDeepReport(data.report);
    } catch { /* ignore */ }
  }

  async function triggerDeepAudit() {
    setDeepRunning(true);
    setLoadingDeep(true);
    try {
      await fetch('/api/cmo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });
      // Poll for completion every 10s (max 6 attempts = 1 min)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const res = await fetch('/api/cmo/audit?phase=latest');
        const data = await res.json() as { report: AuditData | null };
        if (data.report?.status === 'completed' || attempts >= 6) {
          clearInterval(poll);
          if (data.report) setDeepReport(data.report);
          setDeepRunning(false);
          setLoadingDeep(false);
        }
      }, 10_000);
    } catch {
      setDeepRunning(false);
      setLoadingDeep(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAskLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/cmo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', question }),
      });
      const data = await res.json() as { answer?: string };
      setAnswer(data.answer ?? 'No answer returned.');
    } catch { setAnswer('Failed to get answer.'); }
    setAskLoading(false);
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'deep-analysis', label: 'Deep Analysis' },
    { id: 'ask-cmo', label: 'Ask CMO' },
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

      {/* Tab navigation */}
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* New user state — audit is the hero */}
          {isNewUser && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScanSearchIcon className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Account Health Check</p>
              </div>
              {loadingInstant ? (
                <div className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Scanning your connected accounts...</p>
                </div>
              ) : instantAudit ? (
                <div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{instantAudit.ai_summary}</p>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {instantAudit.summary.critical > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <span className="size-2 rounded-full bg-red-500" /> {instantAudit.summary.critical} Critical
                      </span>
                    )}
                    {instantAudit.summary.warning > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <span className="size-2 rounded-full bg-amber-500" /> {instantAudit.summary.warning} Warnings
                      </span>
                    )}
                    {instantAudit.summary.opportunity > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                        <span className="size-2 rounded-full bg-blue-500" /> {instantAudit.summary.opportunity} Opportunities
                      </span>
                    )}
                    {instantAudit.summary.healthy > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                        <span className="size-2 rounded-full bg-green-500" /> {instantAudit.summary.healthy} Healthy
                      </span>
                    )}
                  </div>
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => switchTab('deep-analysis')}>
                    View Full Analysis
                    <ArrowRightIcon className="size-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setInstantRan(false); void loadInstantAudit(); }}>
                  Run Account Scan
                </Button>
              )}
            </div>
          )}

          {/* Daily brief */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Daily Brief</p>
              <button type="button" onClick={() => void loadBrief()} className="text-muted-foreground hover:text-foreground">
                <RefreshCwIcon className="size-3.5" />
              </button>
            </div>
            {loadingBrief ? (
              <div className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generating brief...</p>
              </div>
            ) : brief ? (
              <div>
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Spend</p>
                    <p className="text-sm font-semibold">{curr}{brief.summary.total_spend.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-semibold">{curr}{brief.summary.total_revenue.toLocaleString()}</p>
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

          {/* KPI grid (established users) */}
          {!isNewUser && !loadingDash && dashboard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Spend', value: `${curr}${dashboard.overview.total_spend.toLocaleString()}`, change: dashboard.period_comparison.spend_change_pct },
                  { label: 'Revenue', value: `${curr}${dashboard.overview.total_revenue.toLocaleString()}`, change: dashboard.period_comparison.revenue_change_pct },
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
                          const rc = p.roas >= 3 ? 'text-green-600' : p.roas >= 1 ? 'text-amber-600' : 'text-red-600';
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="py-2 font-medium capitalize">{p.platform}</td>
                              <td className="py-2 text-right">{curr}{p.spend.toLocaleString()}</td>
                              <td className="py-2 text-right">{curr}{p.revenue.toLocaleString()}</td>
                              <td className={cn('py-2 text-right font-bold', rc)}>{p.roas.toFixed(1)}x</td>
                              <td className="py-2 text-right">{p.ctr.toFixed(2)}%</td>
                              <td className="py-2 text-right">{curr}{p.cpa.toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Compact audit widget for established users */}
              {instantAudit && (instantAudit.summary.critical > 0 || instantAudit.summary.warning > 0) && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScanSearchIcon className="size-4 text-amber-600" />
                      <p className="text-sm font-semibold text-foreground">Account Health</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => switchTab('deep-analysis')}>
                      View Report <ArrowRightIcon className="size-3" />
                    </Button>
                  </div>
                  <div className="flex gap-4 mt-2">
                    {instantAudit.summary.critical > 0 && <span className="text-xs text-red-600 font-medium">{instantAudit.summary.critical} critical</span>}
                    {instantAudit.summary.warning > 0 && <span className="text-xs text-amber-600 font-medium">{instantAudit.summary.warning} warnings</span>}
                    {instantAudit.summary.opportunity > 0 && <span className="text-xs text-blue-600 font-medium">{instantAudit.summary.opportunity} opportunities</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DEEP ANALYSIS ── */}
      {tab === 'deep-analysis' && (
        <div className="space-y-4">
          {/* Instant findings */}
          {instantAudit && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">Instant Account Scan</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(instantAudit.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setInstantRan(false); void loadInstantAudit(); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCwIcon className="size-3.5" />
                  </button>
                </div>
              </div>
              {instantAudit.ai_summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{instantAudit.ai_summary}</p>
              )}
              <div className="flex gap-3 flex-wrap mb-4">
                {(['critical', 'warning', 'opportunity', 'healthy'] as Severity[]).map((s) => {
                  const count = instantAudit.summary[s];
                  if (count === 0) return null;
                  return (
                    <span key={s} className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', SEV[s].bg, SEV[s].color)}>
                      <span className={cn('size-1.5 rounded-full', SEV[s].dot)} />
                      {count} {SEV[s].label}
                    </span>
                  );
                })}
              </div>
              <div className="space-y-2">
                {instantAudit.findings
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, opportunity: 2, healthy: 3 };
                    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                  })
                  .map((f) => (
                    <FindingCard key={f.id} finding={f} orgSlug={orgSlug} />
                  ))}
              </div>
            </div>
          )}

          {loadingInstant && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Running account scan...</p>
            </div>
          )}

          {/* Deep AI Analysis section */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Deep AI Analysis</p>
                <p className="text-xs text-muted-foreground">90-day historical analysis · AI-powered · 2-5 min</p>
              </div>
              {!deepRunning && (
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => void triggerDeepAudit()}>
                  {deepReport ? 'Run New Analysis' : 'Run Deep Analysis'}
                  <ZapIcon className="size-3" />
                </Button>
              )}
            </div>

            {deepRunning && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Loader2Icon className="size-4 animate-spin text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Analysing your account data...</p>
                  <p className="text-xs text-muted-foreground">This takes 2-5 minutes. We will notify you when it is ready.</p>
                </div>
              </div>
            )}

            {!deepRunning && deepReport && (
              <div className="space-y-4">
                {/* Unified health score */}
                {deepReport.overallScore != null && (
                  <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-muted/30">
                    <ScoreRing score={deepReport.overallScore} max={100} />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-foreground">Marketing Health Score</p>
                      {deepReport.scoreBreakdown && Object.entries(deepReport.scoreBreakdown).map(([key, val]) => {
                        const dim = SCORE_DIMENSIONS[key];
                        if (!dim) return null;
                        const pct = (val / dim.max) * 100;
                        const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{dim.label}</span>
                              <span className="font-medium text-foreground">{val}/{dim.max}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Executive summary */}
                {deepReport.executive_summary && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold text-foreground mb-1">Executive Summary</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{deepReport.executive_summary}</p>
                  </div>
                )}

                {/* Savings estimate */}
                {deepReport.savingsEstimate && deepReport.savingsEstimate.monthly_wasted_spend > 0 && (
                  <div className="flex gap-4 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Est. Monthly Wasted Spend</p>
                      <p className="text-base font-bold text-amber-700 dark:text-amber-400">{curr}{deepReport.savingsEstimate.monthly_wasted_spend.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">CPA Improvement</p>
                      <p className="text-base font-bold text-green-600">{deepReport.savingsEstimate.potential_cpa_improvement_pct}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">ROAS Improvement</p>
                      <p className="text-base font-bold text-green-600">{deepReport.savingsEstimate.potential_roas_improvement_pct}%</p>
                    </div>
                  </div>
                )}

                {/* Deep findings */}
                {Array.isArray(deepReport.findings) && deepReport.findings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Detailed Findings</p>
                    <div className="space-y-2">
                      {(deepReport.findings as AuditFinding[])
                        .sort((a, b) => {
                          const order = { critical: 0, warning: 1, opportunity: 2, healthy: 3 };
                          return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                        })
                        .map((f) => <FindingCard key={f.id} finding={f} orgSlug={orgSlug} />)}
                    </div>
                  </div>
                )}

                {/* Strategic recommendations */}
                {deepReport.recommendations && deepReport.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Strategic Recommendations</p>
                    <div className="space-y-2">
                      {deepReport.recommendations.map((rec, i) => (
                        <div key={rec.id ?? i} className="rounded-xl border border-border p-3 space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{i + 1}</span>
                            <p className="text-sm font-medium text-foreground">{rec.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                          {rec.estimated_impact && (
                            <p className="text-xs text-green-600 font-medium">{rec.estimated_impact}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{rec.platform}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{rec.objective}</span>
                            {rec.suggested_budget > 0 && (
                              <span className="text-xs font-medium text-foreground">{curr}{rec.suggested_budget.toLocaleString()}/mo</span>
                            )}
                            <Button
                              size="sm"
                              className="ml-auto h-6 text-xs gap-1"
                              onClick={() => router.push(`/organizations/${orgSlug}/create-campaign`)}
                            >
                              Create Campaign <ArrowRightIcon className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!deepRunning && !deepReport && !loadingDeep && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <BrainCircuitIcon className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Run a deep analysis to see AI-powered insights</p>
                <p className="text-xs text-muted-foreground/60">Analyses 90 days of performance data across all connected platforms</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: ASK CMO ── */}
      {tab === 'ask-cmo' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuitIcon className="size-4 text-primary" />
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
              <p className="text-xs text-muted-foreground">AI CMO is analysing your data...</p>
            </div>
          )}

          {answer && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuitIcon className="size-4 text-primary" />
                <p className="text-xs font-semibold text-primary">AI CMO</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
