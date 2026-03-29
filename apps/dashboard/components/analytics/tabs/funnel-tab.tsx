'use client';

import * as React from 'react';
import { AlertTriangleIcon, ArrowDownIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@workspace/ui/components/badge';
import { Card, CardContent } from '@workspace/ui/components/card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FunnelTabProps {
  orgId: string;
  orgSlug: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FUNNEL_STAGES = [
  { name: 'Impressions',   count: 124800, dropOff: null,  color: '#3b82f6' },
  { name: 'Clicks',        count: 3744,   dropOff: 97.0,  color: '#6366f1' },
  { name: 'Product Views', count: 2808,   dropOff: 25.0,  color: '#8b5cf6' },
  { name: 'Add to Cart',   count: 842,    dropOff: 70.0,  color: '#a855f7' },
  { name: 'Checkout',      count: 337,    dropOff: 60.0,  color: '#ec4899' },
  { name: 'Purchase',      count: 253,    dropOff: 24.9,  color: '#f43f5e' },
];

const PLATFORM_FUNNEL_DATA = [
  { stage: 'Impressions',   Google: 58000, Meta: 42000, Bing: 15000, Organic: 9800  },
  { stage: 'Clicks',        Google: 1740,  Meta: 1260,  Bing: 450,   Organic: 294   },
  { stage: 'Product Views', Google: 1305,  Meta: 945,   Bing: 337,   Organic: 221   },
  { stage: 'Add to Cart',   Google: 391,   Meta: 284,   Bing: 101,   Organic: 66    },
  { stage: 'Checkout',      Google: 156,   Meta: 113,   Bing: 40,    Organic: 28    },
  { stage: 'Purchase',      Google: 117,   Meta: 85,    Bing: 30,    Organic: 21    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dropOffColor(dropOff: number): string {
  if (dropOff > 50) return 'bg-red-100 text-red-700 border-red-200';
  if (dropOff >= 30) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FunnelTab({ orgId: _orgId, orgSlug: _orgSlug, period: _period }: FunnelTabProps) {
  const maxCount = FUNNEL_STAGES[0].count;

  return (
    <div className="flex flex-col gap-6">
      {/* Overall conversion metric */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-xl shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Overall Conversion Rate</p>
            <p className="text-4xl font-bold text-foreground tabular-nums mt-1">0.20%</p>
            <p className="text-xs text-muted-foreground mt-1">Impressions → Purchase (124,800 → 253)</p>
          </CardContent>
        </Card>
        {/* Bottleneck alert */}
        <Card className="rounded-xl shadow-sm border-amber-200 bg-amber-50">
          <CardContent className="p-5 flex gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Bottleneck Detected</p>
              <p className="text-xs text-amber-700 mt-1">
                Add to Cart → Checkout has a 60% drop-off. Consider simplifying checkout, adding
                trust signals, or enabling cart abandonment recovery.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel visualization */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Conversion Funnel</p>
        </div>
        <CardContent className="p-5">
          <div className="flex flex-col gap-1.5">
            {FUNNEL_STAGES.map((stage, idx) => {
              const widthPct = (stage.count / maxCount) * 100;
              return (
                <React.Fragment key={stage.name}>
                  <div className="flex items-center gap-4">
                    {/* Stage label */}
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-medium text-foreground">{stage.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {stage.count.toLocaleString()}
                      </p>
                    </div>
                    {/* Bar */}
                    <div className="flex-1 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    {/* Drop-off badge */}
                    {stage.dropOff !== null && (
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 w-20 justify-center ${dropOffColor(stage.dropOff)}`}
                      >
                        -{stage.dropOff}%
                      </Badge>
                    )}
                    {stage.dropOff === null && <div className="w-20 shrink-0" />}
                  </div>
                  {/* Arrow between stages */}
                  {idx < FUNNEL_STAGES.length - 1 && (
                    <div className="flex items-center gap-4">
                      <div className="w-32 shrink-0" />
                      <ArrowDownIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Platform breakdown chart */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Platform Breakdown by Funnel Stage</p>
        </div>
        <CardContent className="p-5 pt-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={PLATFORM_FUNNEL_DATA}
              margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString()} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), undefined]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Google"  fill="#4285f4" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Meta"    fill="#1877f2" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Bing"    fill="#00809d" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Organic" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
