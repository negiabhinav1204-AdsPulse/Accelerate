'use client';

import * as React from 'react';
import { ArrowUpIcon, BotIcon, ChevronDownIcon, ChevronUpIcon, FilterIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Switch } from '@workspace/ui/components/switch';
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LlmTrafficTabProps {
  orgId: string;
  orgSlug: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const LLM_PLATFORMS = [
  { platform: 'ChatGPT',    visitors: 1512, pct: 8.2, cvr: 5.75, color: '#10a37f', trend: 'up'   },
  { platform: 'Claude',     visitors: 571,  pct: 3.1, cvr: 6.65, color: '#cc785c', trend: 'up'   },
  { platform: 'Perplexity', visitors: 497,  pct: 2.7, cvr: 4.23, color: '#1fb8cd', trend: 'up'   },
  { platform: 'Gemini',     visitors: 184,  pct: 1.0, cvr: 4.89, color: '#4285f4', trend: 'flat' },
  { platform: 'Copilot',    visitors: 55,   pct: 0.3, cvr: 5.45, color: '#00adef', trend: 'up'   },
];

// 30 days of mock trend data — LLM share grows from ~10% to ~16%
const TREND_DATA = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 2, i + 1);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const totalVisitors = Math.round(590 + i * 3 + Math.random() * 40);
  const llmPct = 0.10 + (i / 29) * 0.06 + (Math.random() - 0.5) * 0.01;
  const llmVisitors = Math.round(totalVisitors * llmPct);
  return {
    date: label,
    'LLM Visitors': llmVisitors,
    'Total Visitors': totalVisitors,
  };
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LlmTrafficTab({ orgId: _orgId, orgSlug: _orgSlug, period: _period }: LlmTrafficTabProps) {
  const [filterEnabled, setFilterEnabled] = React.useState(false);
  const [filterLoading, setFilterLoading] = React.useState(false);
  const [detectionOpen, setDetectionOpen] = React.useState(false);
  const [testReferrer, setTestReferrer] = React.useState('');
  const [testUserAgent, setTestUserAgent] = React.useState('');
  const [testUrl, setTestUrl] = React.useState('');
  const [testResult, setTestResult] = React.useState<{
    is_llm: boolean;
    platform: string;
    confidence: number;
  } | null>(null);

  function handleFilterToggle(val: boolean) {
    setFilterLoading(true);
    setTimeout(() => {
      setFilterEnabled(val);
      setFilterLoading(false);
      toast(val ? 'LLM traffic filtering enabled' : 'LLM traffic filtering disabled', {
        description: val
          ? 'AI bot visits will be excluded from your analytics.'
          : 'All traffic is now included in analytics.',
      });
    }, 800);
  }

  function handleTestDetection() {
    // Mock detection result
    const isLlm =
      testReferrer.toLowerCase().includes('chat') ||
      testUserAgent.toLowerCase().includes('gpt') ||
      testReferrer.toLowerCase().includes('claude') ||
      true; // always show a result for demo
    setTestResult({ is_llm: true, platform: 'ChatGPT', confidence: 0.95 });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <BotIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">LLM Visitors</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">2,579</p>
            <p className="text-xs text-muted-foreground mt-1">14% of total traffic</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Highest Source</p>
            <p className="text-2xl font-bold text-foreground mt-1">ChatGPT</p>
            <p className="text-xs text-muted-foreground mt-1">8.2% of total</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-green-200 bg-green-50">
          <CardContent className="p-5">
            <p className="text-sm text-green-700">LLM Conv. Rate</p>
            <p className="text-2xl font-bold text-green-800 tabular-nums mt-1">5.6%</p>
            <p className="text-xs text-green-700 mt-1">1.6x higher than organic (3.4%)</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Filtering</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {filterEnabled ? 'On' : 'Off'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">LLM traffic filter status</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform breakdown */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Platform Breakdown</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {LLM_PLATFORMS.map((p) => (
            <Card key={p.platform} className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${p.color}20` }}
                  >
                    <BotIcon className="h-4 w-4" style={{ color: p.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.platform}</p>
                    <p className="text-xs text-muted-foreground">{p.pct}% of total</p>
                  </div>
                  {p.trend === 'up' && (
                    <ArrowUpIcon className="h-4 w-4 text-green-500 ml-auto shrink-0" />
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Visitors</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">
                      {p.visitors.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Conv. Rate</p>
                    <p className="text-lg font-bold text-green-600 tabular-nums">
                      {p.cvr.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(p.visitors / 1512) * 100}%`, backgroundColor: p.color }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">LLM Traffic Trend (30 days)</p>
        </div>
        <CardContent className="p-5 pt-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={TREND_DATA} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLlm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10a37f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10a37f" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="Total Visitors"
                stroke="#94a3b8"
                strokeWidth={2}
                fill="url(#colorTotal)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="LLM Visitors"
                stroke="#10a37f"
                strokeWidth={2}
                fill="url(#colorLlm)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filter toggle */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Filter LLM traffic from analytics</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, AI bot visits will be excluded from your conversion rates and revenue
                attribution.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className={
                  filterEnabled
                    ? 'bg-green-100 text-green-700 border-green-200 text-xs'
                    : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                }
              >
                Currently: {filterEnabled ? 'ON' : 'OFF'}
              </Badge>
              <Switch
                checked={filterEnabled}
                onCheckedChange={handleFilterToggle}
                disabled={filterLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detection test panel */}
      <Card className="rounded-xl shadow-sm">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setDetectionOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <BotIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Test Detection</span>
          </div>
          {detectionOpen ? (
            <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {detectionOpen && (
          <CardContent className="px-5 pb-5 pt-0 border-t border-gray-100">
            <div className="flex flex-col gap-3 mt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Referrer URL
                </label>
                <Input
                  placeholder="https://chat.openai.com/..."
                  value={testReferrer}
                  onChange={(e) => setTestReferrer(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  User-Agent
                </label>
                <Input
                  placeholder="Mozilla/5.0 (ChatGPT-User)..."
                  value={testUserAgent}
                  onChange={(e) => setTestUserAgent(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Page URL
                </label>
                <Input
                  placeholder="https://yourstore.com/products/..."
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
              <Button
                size="sm"
                className="w-fit mt-1"
                onClick={handleTestDetection}
              >
                Test Detection
              </Button>

              {testResult && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-foreground mt-1">
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
