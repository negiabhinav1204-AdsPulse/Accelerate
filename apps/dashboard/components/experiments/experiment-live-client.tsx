'use client';

import * as React from 'react';
import {
  ActivityIcon,
  PauseIcon,
  TrophyIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VariantData {
  id: string;
  name: string;
  impressions: number;
  conversions: number;
  is_control: boolean;
}

interface ExperimentData {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'ended';
  days_running: number;
  confidence: number;
  variants: VariantData[];
}

// ---------------------------------------------------------------------------
// Mock data — TODO: replace with real API call to /api/personalization/experiments/{experimentId}
// ---------------------------------------------------------------------------

const MOCK_EXPERIMENT: ExperimentData = {
  id: 'exp1',
  name: 'Hero Headline Test',
  status: 'running',
  days_running: 12,
  confidence: 87.3,
  variants: [
    {
      id: 'v1',
      name: 'Control — Welcome to our store',
      impressions: 2410,
      conversions: 145,
      is_control: true,
    },
    {
      id: 'v2',
      name: 'Urgency — Limited Time: Free Shipping Today',
      impressions: 2410,
      conversions: 167,
      is_control: false,
    },
  ],
};

// Mock time-series data for timeline chart
const MOCK_TIMELINE = Array.from({ length: 12 }, (_, i) => ({
  day: `Day ${i + 1}`,
  Control: Math.round(180 + i * 18 + Math.random() * 20),
  Variant: Math.round(185 + i * 19 + Math.random() * 20),
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExperimentLiveClientProps {
  orgId: string;
  experimentId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcConvRate(conversions: number, impressions: number): string {
  if (impressions === 0) return '0.00%';
  return ((conversions / impressions) * 100).toFixed(2) + '%';
}

function calcLift(variant: VariantData, control: VariantData): string {
  if (control.impressions === 0) return '—';
  const controlRate = control.conversions / control.impressions;
  const variantRate = variant.conversions / variant.impressions;
  if (controlRate === 0) return '—';
  const lift = ((variantRate - controlRate) / controlRate) * 100;
  return (lift >= 0 ? '+' : '') + lift.toFixed(1) + '%';
}

function calcBayesianProb(variant: VariantData, control: VariantData): string {
  // Simplified approximation based on conversion rates
  const cR = control.impressions > 0 ? control.conversions / control.impressions : 0;
  const vR = variant.impressions > 0 ? variant.conversions / variant.impressions : 0;
  if (vR > cR) {
    return (50 + ((vR - cR) / Math.max(cR, 0.001)) * 30).toFixed(1) + '%';
  }
  return (50 - ((cR - vR) / Math.max(cR, 0.001)) * 30).toFixed(1) + '%';
}

function ConfidenceMeter({ value }: { value: number }) {
  const color =
    value >= 95
      ? 'bg-green-500'
      : value >= 80
        ? 'bg-yellow-400'
        : value >= 50
          ? 'bg-orange-400'
          : 'bg-red-400';

  const textColor =
    value >= 95
      ? 'text-green-600'
      : value >= 80
        ? 'text-yellow-600'
        : value >= 50
          ? 'text-orange-600'
          : 'text-red-600';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Statistical Confidence</p>
          <p className={`text-4xl font-bold tabular-nums ${textColor}`}>{value.toFixed(1)}%</p>
        </div>
        <p className="text-xs text-muted-foreground pb-1">Target: 95%</p>
      </div>
      <div className="relative h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
        {/* Threshold line at 95% */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-800 opacity-40"
          style={{ left: '95%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span className="absolute" style={{ left: '95%', transform: 'translateX(-50%)' }}>
          95%
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExperimentLiveClient({ orgId, experimentId }: ExperimentLiveClientProps) {
  // TODO: fetch from /api/personalization/experiments/${experimentId}
  const [experiment] = React.useState<ExperimentData>(MOCK_EXPERIMENT);
  const [paused, setPaused] = React.useState(experiment.status === 'paused');
  const [winnerDeclared, setWinnerDeclared] = React.useState<string | null>(null);

  const control = experiment.variants.find((v) => v.is_control);
  const nonControl = experiment.variants.filter((v) => !v.is_control);

  const totalVisitors = experiment.variants.reduce((s, v) => s + v.impressions, 0);
  const totalConversions = experiment.variants.reduce((s, v) => s + v.conversions, 0);

  const bestVariant =
    control && nonControl.length > 0
      ? nonControl.reduce((best, v) =>
          v.conversions / v.impressions > best.conversions / best.impressions ? v : best
        )
      : null;

  const bestLift =
    control && bestVariant
      ? (
          ((bestVariant.conversions / bestVariant.impressions -
            control.conversions / control.impressions) /
            (control.conversions / control.impressions)) *
          100
        ).toFixed(1)
      : null;

  const STATUS_CONFIG: Record<ExperimentData['status'], { label: string; className: string }> = {
    running: { label: 'Running', className: 'bg-green-100 text-green-700 border-green-200' },
    paused: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    ended: { label: 'Ended', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  const currentStatus = paused ? 'paused' : experiment.status;
  const statusCfg = STATUS_CONFIG[currentStatus];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Experiment header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-semibold text-foreground">{experiment.name}</h2>
              <Badge variant="outline" className={`text-xs font-medium ${statusCfg.className}`}>
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Running for {experiment.days_running} days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setPaused((p) => !p)}
          >
            <PauseIcon className="h-4 w-4" />
            {paused ? 'Resume' : 'Pause'}
          </Button>
          {bestVariant && !winnerDeclared && (
            <Button
              className="gap-2 bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => setWinnerDeclared(bestVariant.name)}
            >
              <TrophyIcon className="h-4 w-4" />
              Declare Winner
            </Button>
          )}
        </div>
      </div>

      {/* Winner banner */}
      {winnerDeclared && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <TrophyIcon className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">
            Winner declared: <span className="font-semibold">"{winnerDeclared}"</span> — experiment
            ended.
          </p>
        </div>
      )}

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<UsersIcon className="h-5 w-5" />}
          label="Total Visitors"
          value={totalVisitors.toLocaleString()}
        />
        <MetricCard
          icon={<ActivityIcon className="h-5 w-5" />}
          label="Total Conversions"
          value={totalConversions.toLocaleString()}
        />
        <MetricCard
          icon={<ActivityIcon className="h-5 w-5" />}
          label="Confidence"
          value={`${experiment.confidence.toFixed(1)}%`}
          subtext={experiment.confidence >= 95 ? 'Statistically significant' : 'Not yet significant'}
        />
        <MetricCard
          icon={<TrendingUpIcon className="h-5 w-5" />}
          label="Best Lift"
          value={bestLift ? `+${bestLift}%` : '—'}
          subtext={bestVariant?.name ?? undefined}
        />
      </div>

      {/* Confidence meter */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="relative p-6">
          <ConfidenceMeter value={experiment.confidence} />
        </CardContent>
      </Card>

      {/* Variant comparison table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Variant Comparison</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium text-muted-foreground">Variant</TableHead>
              <TableHead className="font-medium text-muted-foreground text-center tabular-nums">
                Impressions
              </TableHead>
              <TableHead className="font-medium text-muted-foreground text-center tabular-nums">
                Conversions
              </TableHead>
              <TableHead className="font-medium text-muted-foreground text-center">Conv. Rate</TableHead>
              <TableHead className="font-medium text-muted-foreground text-center">Lift vs Control</TableHead>
              <TableHead className="font-medium text-muted-foreground text-center">Bayesian Prob</TableHead>
              <TableHead className="font-medium text-muted-foreground text-center">Status</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experiment.variants.map((variant) => {
              const isWinner = bestVariant?.id === variant.id && !variant.is_control;
              const liftStr = variant.is_control
                ? '—'
                : control
                  ? calcLift(variant, control)
                  : '—';
              const liftPositive = liftStr.startsWith('+');
              const bayesProb = variant.is_control
                ? '—'
                : control
                  ? calcBayesianProb(variant, control)
                  : '—';

              return (
                <TableRow
                  key={variant.id}
                  className={`${
                    variant.is_control
                      ? 'bg-gray-50/60'
                      : isWinner
                        ? 'bg-green-50/40'
                        : 'hover:bg-gray-50/50'
                  }`}
                >
                  {/* Variant name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isWinner && <TrophyIcon className="h-4 w-4 text-yellow-500 shrink-0" />}
                      <span className="text-sm font-medium text-foreground max-w-[200px] truncate">
                        {variant.name}
                      </span>
                      {variant.is_control && (
                        <Badge variant="outline" className="text-xs border-gray-300 text-muted-foreground shrink-0">
                          Control
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Impressions */}
                  <TableCell className="text-center text-sm tabular-nums">
                    {variant.impressions.toLocaleString()}
                  </TableCell>

                  {/* Conversions */}
                  <TableCell className="text-center text-sm tabular-nums">
                    {variant.conversions.toLocaleString()}
                  </TableCell>

                  {/* Conv. rate */}
                  <TableCell className="text-center text-sm tabular-nums">
                    {calcConvRate(variant.conversions, variant.impressions)}
                  </TableCell>

                  {/* Lift */}
                  <TableCell className="text-center">
                    {liftStr === '—' ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={`text-sm font-medium tabular-nums ${liftPositive ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {liftStr}
                      </span>
                    )}
                  </TableCell>

                  {/* Bayesian prob */}
                  <TableCell className="text-center text-sm tabular-nums text-foreground">
                    {bayesProb}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    {isWinner ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        Winning
                      </Badge>
                    ) : variant.is_control ? (
                      <Badge variant="outline" className="text-xs border-gray-200 text-muted-foreground">
                        Baseline
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
                        Challenger
                      </Badge>
                    )}
                  </TableCell>

                  {/* Action */}
                  <TableCell className="text-right">
                    {!variant.is_control && !winnerDeclared ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => setWinnerDeclared(variant.name)}
                      >
                        <TrophyIcon className="h-3.5 w-3.5 text-yellow-500" />
                        Declare Winner
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Timeline chart */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Cumulative Impressions Over Time</p>
        </div>
        <CardContent className="p-5 pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_TIMELINE} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Control"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Variant"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Statistical note */}
      <p className="text-xs text-muted-foreground px-1">
        Using two-proportion z-test with 95% confidence threshold. Minimum 100 impressions required
        per variant.
      </p>
    </div>
  );
}
