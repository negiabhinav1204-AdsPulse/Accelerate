'use client';

import * as React from 'react';
import {
  SearchIcon,
  DownloadIcon,
  XIcon,
  SparklesIcon,
  AlertCircleIcon,
  LinkIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

// Types
type MatchType = 'exact' | 'broad' | 'phrase';

type KeywordResult = {
  keyword: string;
  matchType: MatchType;
  avgMonthlySearches: number;
  competition: 'low' | 'medium' | 'high';
  topOfPageBidLow: number;
  topOfPageBidHigh: number;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  aiSuggested: boolean;
  negative: boolean;
};

// Mock data for keyword results
function generateMockResults(keywords: string[], matchType: MatchType): KeywordResult[] {
  const base = keywords.flatMap((kw) => {
    const kwLower = kw.toLowerCase().trim();
    return [
      { keyword: kwLower, matchType, avgMonthlySearches: Math.floor(Math.random() * 40000) + 5000, competition: 'medium' as const, topOfPageBidLow: +(Math.random() * 2 + 0.5).toFixed(2), topOfPageBidHigh: +(Math.random() * 4 + 2).toFixed(2), intent: 'commercial' as const, aiSuggested: false, negative: false },
      { keyword: `best ${kwLower}`, matchType, avgMonthlySearches: Math.floor(Math.random() * 20000) + 2000, competition: 'high' as const, topOfPageBidLow: +(Math.random() * 3 + 1).toFixed(2), topOfPageBidHigh: +(Math.random() * 5 + 3).toFixed(2), intent: 'commercial' as const, aiSuggested: true, negative: false },
      { keyword: `${kwLower} price`, matchType, avgMonthlySearches: Math.floor(Math.random() * 15000) + 1000, competition: 'high' as const, topOfPageBidLow: +(Math.random() * 4 + 2).toFixed(2), topOfPageBidHigh: +(Math.random() * 6 + 4).toFixed(2), intent: 'transactional' as const, aiSuggested: true, negative: false },
      { keyword: `${kwLower} reviews`, matchType, avgMonthlySearches: Math.floor(Math.random() * 25000) + 3000, competition: 'medium' as const, topOfPageBidLow: +(Math.random() * 2 + 0.5).toFixed(2), topOfPageBidHigh: +(Math.random() * 3 + 1.5).toFixed(2), intent: 'informational' as const, aiSuggested: true, negative: false },
      { keyword: `cheap ${kwLower}`, matchType, avgMonthlySearches: Math.floor(Math.random() * 10000) + 500, competition: 'low' as const, topOfPageBidLow: +(Math.random() * 1 + 0.3).toFixed(2), topOfPageBidHigh: +(Math.random() * 2 + 0.8).toFixed(2), intent: 'transactional' as const, aiSuggested: false, negative: true },
      { keyword: `free ${kwLower}`, matchType, avgMonthlySearches: Math.floor(Math.random() * 30000) + 5000, competition: 'low' as const, topOfPageBidLow: 0.1, topOfPageBidHigh: 0.5, intent: 'informational' as const, aiSuggested: false, negative: true },
    ];
  });
  return base;
}

const COMPETITION_CONFIG: Record<string, { cls: string; label: string }> = {
  low: { cls: 'text-emerald-600', label: 'Low' },
  medium: { cls: 'text-amber-600', label: 'Med' },
  high: { cls: 'text-red-600', label: 'High' },
};

const INTENT_CONFIG: Record<string, { cls: string; label: string }> = {
  informational: { cls: 'bg-blue-50 text-blue-700', label: 'Info' },
  commercial: { cls: 'bg-purple-50 text-purple-700', label: 'Commercial' },
  transactional: { cls: 'bg-emerald-50 text-emerald-700', label: 'Transaction' },
  navigational: { cls: 'bg-gray-100 text-gray-600', label: 'Nav' },
};

function formatSearchVolume(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

export function KeywordPlannerClient({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const [seedKeywords, setSeedKeywords] = React.useState<string>('');
  const [matchType, setMatchType] = React.useState<MatchType>('broad');
  const [results, setResults] = React.useState<KeywordResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasRun, setHasRun] = React.useState(false);
  const [isGoogleConnected] = React.useState(false); // Gated behind Google Ads connection

  // Filter results
  const positiveResults = results.filter((r) => !r.negative);
  const negativeResults = results.filter((r) => r.negative);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  function toggleKeyword(kw: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  async function runPlanner() {
    const keywords = seedKeywords.split('\n').map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1800)); // Simulate API call
    const mock = generateMockResults(keywords, matchType);
    setResults(mock);
    setSelectedIds(new Set(mock.filter((r) => !r.negative && r.intent !== 'informational').map((r) => r.keyword)));
    setHasRun(true);
    setIsLoading(false);
  }

  function downloadCSV() {
    const selected = results.filter((r) => selectedIds.has(r.keyword));
    const header = ['Keyword', 'Match Type', 'Avg Monthly Searches', 'Competition', 'Top Bid Low', 'Top Bid High', 'Intent', 'Type'];
    const rows = selected.map((r) => [
      r.keyword,
      r.matchType,
      r.avgMonthlySearches,
      r.competition,
      r.topOfPageBidLow,
      r.topOfPageBidHigh,
      r.intent,
      r.negative ? 'Negative' : 'Positive',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keyword-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Gate: Google Ads not connected
  if (!isGoogleConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center max-w-md mx-auto">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
          <LinkIcon className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Connect Google Ads first</h2>
          <p className="text-sm text-muted-foreground">
            Keyword Planner uses the Google Ads Keyword Planner API. Connect your Google Ads account to access real search volume, competition data, and bid estimates.
          </p>
        </div>
        <a
          href={`/organizations/${orgSlug}/connectors`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4285F4] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Connect Google Ads
        </a>
        <p className="text-xs text-muted-foreground">
          You can also use the <strong>Demo Mode</strong> below to explore the interface with mock data.
        </p>
        <button
          type="button"
          onClick={() => {
            // Override gate for demo
            (window as any).__kwDemo = true;
            window.location.reload();
          }}
          className="text-xs text-primary underline"
        >
          Try Demo Mode
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Input panel */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Seed keywords textarea */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-xs font-medium text-foreground">Seed Keywords</label>
            <textarea
              value={seedKeywords}
              onChange={(e) => setSeedKeywords(e.target.value)}
              placeholder={'running shoes\nwireless headphones\nprotein powder'}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <p className="text-[11px] text-muted-foreground">One keyword per line</p>
          </div>

          {/* Match type + run */}
          <div className="flex flex-col gap-3 min-w-[160px]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Match Type</label>
              <div className="flex flex-col gap-1.5">
                {(['broad', 'phrase', 'exact'] as MatchType[]).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="matchType"
                      value={type}
                      checked={matchType === type}
                      onChange={() => setMatchType(type)}
                      className="size-3.5"
                    />
                    <span className="text-sm text-foreground capitalize">{type} Match</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={runPlanner}
              disabled={isLoading || !seedKeywords.trim()}
              className="gap-2"
            >
              <SearchIcon className="size-3.5" />
              {isLoading ? 'Analyzing...' : 'Get Keywords'}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasRun && !isLoading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedIds.size} keywords selected</p>
              <p className="text-xs text-muted-foreground">{positiveResults.length} suggested · {negativeResults.length} negatives</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
              <DownloadIcon className="size-3.5" />
              Export CSV
            </Button>
          </div>

          {/* Positive keywords */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Suggested Keywords</p>
              <span className="text-xs text-muted-foreground">({positiveResults.length})</span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-8"></th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Keyword</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Intent</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Volume</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Comp.</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Bid Range</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {positiveResults.map((r) => {
                    const isSelected = selectedIds.has(r.keyword);
                    const intentCfg = INTENT_CONFIG[r.intent] ?? INTENT_CONFIG.informational;
                    const compCfg = COMPETITION_CONFIG[r.competition] ?? COMPETITION_CONFIG.medium;
                    return (
                      <tr
                        key={r.keyword}
                        className={cn('transition-colors hover:bg-muted/20 cursor-pointer', isSelected && 'bg-primary/5')}
                        onClick={() => toggleKeyword(r.keyword)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleKeyword(r.keyword)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-3.5 rounded"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{r.keyword}</span>
                            {r.aiSuggested && (
                              <SparklesIcon className="size-3 text-primary/60" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', intentCfg.cls)}>
                            {intentCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-foreground font-medium">
                          {formatSearchVolume(r.avgMonthlySearches)}/mo
                        </td>
                        <td className={cn('px-3 py-2.5 text-right text-xs font-semibold', compCfg.cls)}>
                          {compCfg.label}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                          ${r.topOfPageBidLow}–${r.topOfPageBidHigh}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleKeyword(r.keyword); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Negative keywords */}
          {negativeResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="size-4 text-red-500" />
                <p className="text-sm font-semibold text-foreground">Suggested Negative Keywords</p>
                <span className="text-xs text-muted-foreground">({negativeResults.length}) — AI-flagged as low-intent or irrelevant</span>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-red-50/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Negative Keyword</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Volume</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {negativeResults.map((r) => (
                      <tr key={r.keyword} className="bg-red-50/20">
                        <td className="px-3 py-2.5 text-xs font-medium text-red-700">-{r.keyword}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatSearchVolume(r.avgMonthlySearches)}/mo</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {r.keyword.startsWith('free ') ? 'Price-sensitive / freebie seekers' : 'Non-commercial intent — hurts Quality Score'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
