'use client';

import * as React from 'react';
import {
  SparklesIcon,
  CheckCircle2Icon,
  XIcon,
  FilterIcon,
  RefreshCwIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  ZapIcon,
} from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

// Types
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
type Category = 'budget' | 'bid' | 'creative' | 'audience' | 'anomaly' | 'pacing';

type Recommendation = {
  id: string;
  priority: Priority;
  category: Category;
  campaign: string;
  platform: string;
  title: string;
  reason: string;
  estimated_impact: string;
  dismissed: boolean;
};

// Mock recommendations data
const MOCK_RECOMMENDATIONS: Recommendation[] = [
  { id: 'r1', priority: 'HIGH', category: 'budget', campaign: 'Brand Awareness', platform: 'meta', title: "Pause 'Brand Awareness' — ROAS 0.4x", reason: '$5,000 spend with only $2,000 revenue. Negative ROAS for 14 consecutive days.', estimated_impact: 'Save $5,000/month', dismissed: false },
  { id: 'r2', priority: 'HIGH', category: 'anomaly', campaign: 'Shopping - Best Sellers', platform: 'google', title: 'CPC spike +81% in last 48 hours', reason: 'CPC jumped from $1.20 to $2.18. Possible auction pressure or bid change.', estimated_impact: 'Prevent budget waste', dismissed: false },
  { id: 'r3', priority: 'HIGH', category: 'pacing', campaign: 'Brand Awareness', platform: 'meta', title: 'Budget exhausts 10 days early', reason: '97% spent at 65% of month. Reduce daily budget 40% to extend campaign.', estimated_impact: 'Prevent $2,790 overspend', dismissed: false },
  { id: 'r4', priority: 'MEDIUM', category: 'bid', campaign: 'Brand Awareness', platform: 'meta', title: 'Lower CPC bids 20% — low CTR signal', reason: 'CTR 0.8% with $3.50 CPC. Overbidding on low-intent queries.', estimated_impact: 'Save ~18% on CPC', dismissed: false },
  { id: 'r5', priority: 'MEDIUM', category: 'budget', campaign: 'Shopping - Best Sellers', platform: 'google', title: "Scale 'Shopping - Best Sellers' +25%", reason: 'ROAS 4.0x consistently over 14 days. Budget-limited winner.', estimated_impact: '+40% conversions', dismissed: false },
  { id: 'r6', priority: 'MEDIUM', category: 'audience', campaign: 'Shopping - Best Sellers', platform: 'google', title: 'Create lookalike from top 200 converters', reason: 'ROAS 4.0x makes this audience worth expanding. Potential +45K reach.', estimated_impact: '+45K potential reach', dismissed: false },
  { id: 'r7', priority: 'LOW', category: 'creative', campaign: 'Brand Awareness', platform: 'meta', title: 'Refresh creative — 45 days old', reason: '180K impressions on same creative. Frequency likely causing banner blindness.', estimated_impact: 'Prevent CTR decay', dismissed: false },
  { id: 'r8', priority: 'LOW', category: 'audience', campaign: 'Retargeting', platform: 'meta', title: 'Add converters exclusion to prospecting', reason: 'Converters not excluded from Brand Awareness — wasted impressions on existing customers.', estimated_impact: 'Save ~8% of budget', dismissed: false },
];

const CATEGORY_ICONS: Record<Category, React.ElementType> = {
  budget: TrendingUpIcon,
  bid: ZapIcon,
  creative: SparklesIcon,
  audience: FilterIcon,
  anomaly: AlertTriangleIcon,
  pacing: TrendingDownIcon,
};

const CATEGORY_LABELS: Record<Category, string> = {
  budget: 'Budget',
  bid: 'Bid',
  creative: 'Creative',
  audience: 'Audience',
  anomaly: 'Anomaly',
  pacing: 'Pacing',
};

const PLATFORM_COLORS: Record<string, string> = {
  google: 'bg-[#4285F4] text-white',
  meta: 'bg-[#0866FF] text-white',
  bing: 'bg-[#00809D] text-white',
};

const PRIORITY_CONFIG: Record<Priority, { badge: string; border: string; bg: string }> = {
  HIGH: { badge: 'bg-red-100 text-red-700 border-red-200', border: 'border-l-red-500', bg: '' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-l-amber-500', bg: '' },
  LOW: { badge: 'bg-blue-100 text-blue-700 border-blue-200', border: 'border-l-blue-500', bg: '' },
};

export function OptimizationClient({ orgSlug }: { orgSlug: string }) {
  const [recs, setRecs] = React.useState<Recommendation[]>(MOCK_RECOMMENDATIONS);
  const [activeFilter, setActiveFilter] = React.useState<'all' | Priority | Category>('all');
  const [isRunning, setIsRunning] = React.useState(false);
  const [lastRun, setLastRun] = React.useState<string | null>(null);

  const filtered = recs.filter((r) => {
    if (r.dismissed) return false;
    if (activeFilter === 'all') return true;
    if (['HIGH', 'MEDIUM', 'LOW'].includes(activeFilter)) return r.priority === activeFilter;
    return r.category === activeFilter;
  });

  const highCount = recs.filter((r) => !r.dismissed && r.priority === 'HIGH').length;
  const totalDismissed = recs.filter((r) => r.dismissed).length;

  function dismiss(id: string) {
    setRecs((prev) => prev.map((r) => r.id === id ? { ...r, dismissed: true } : r));
  }

  function applyRec(id: string) {
    // In production, this would call the campaigns API to apply the action
    setRecs((prev) => prev.map((r) => r.id === id ? { ...r, dismissed: true } : r));
  }

  async function runAnalysis() {
    setIsRunning(true);
    // Simulate running the 7-agent workflow
    await new Promise((r) => setTimeout(r, 2000));
    setIsRunning(false);
    setLastRun(new Date().toLocaleTimeString());
    // Reset dismissed state to show fresh recs
    setRecs(MOCK_RECOMMENDATIONS);
  }

  const filterTabs: Array<{ key: typeof activeFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'HIGH', label: 'High Priority' },
    { key: 'MEDIUM', label: 'Medium' },
    { key: 'LOW', label: 'Low' },
    { key: 'budget', label: 'Budget' },
    { key: 'bid', label: 'Bid' },
    { key: 'creative', label: 'Creative' },
    { key: 'audience', label: 'Audience' },
    { key: 'anomaly', label: 'Anomaly' },
    { key: 'pacing', label: 'Pacing' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangleIcon className="size-4 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{highCount}</p>
              <p className="text-xs text-muted-foreground">High priority</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Active recommendations</p>
          </div>
          {lastRun && (
            <>
              <div className="h-8 w-px bg-border" />
              <p className="text-xs text-muted-foreground">Last run: {lastRun}</p>
            </>
          )}
        </div>
        <Button
          size="sm"
          onClick={runAnalysis}
          disabled={isRunning}
          className="gap-2"
        >
          <RefreshCwIcon className={cn('size-3.5', isRunning && 'animate-spin')} />
          {isRunning ? 'Running agents...' : 'Run AI Analysis'}
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
              activeFilter === tab.key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 flex flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2Icon className="size-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground">
              {totalDismissed > 0 ? `${totalDismissed} recommendations applied or dismissed.` : 'No recommendations for this filter.'}
            </p>
          </div>
        ) : (
          filtered.map((rec) => {
            const Icon = CATEGORY_ICONS[rec.category];
            const cfg = PRIORITY_CONFIG[rec.priority];
            const platformColor = PLATFORM_COLORS[rec.platform] ?? 'bg-muted text-muted-foreground';
            return (
              <div
                key={rec.id}
                className={cn('rounded-xl border border-border border-l-4 bg-card p-4', cfg.border)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="shrink-0 size-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border', cfg.badge)}>
                          {rec.priority}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {CATEGORY_LABELS[rec.category]}
                        </span>
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold', platformColor)}>
                          {rec.platform.charAt(0).toUpperCase() + rec.platform.slice(1)}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{rec.campaign}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      <div className="flex items-center gap-1">
                        <TrendingUpIcon className="size-3 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">{rec.estimated_impact}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyRec(rec.id)}
                      className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(rec.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
