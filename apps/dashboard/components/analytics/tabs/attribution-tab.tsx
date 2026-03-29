'use client';

import * as React from 'react';
import { TrendingUpIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
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
// Props
// ---------------------------------------------------------------------------

interface AttributionTabProps {
  orgId: string;
  orgSlug: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PLATFORM_DATA = [
  { name: 'Google Ads', revenue: 18420, spend: 4200, roas: 4.39, pct: 38.1, color: '#4285f4' },
  { name: 'Meta Ads',   revenue: 9841,  spend: 2800, roas: 3.51, pct: 20.4, color: '#1877f2' },
  { name: 'Bing Ads',   revenue: 3148,  spend: 980,  roas: 3.21, pct: 6.5,  color: '#00809d' },
  { name: 'Organic',    revenue: 16912, spend: 0,    roas: null,  pct: 35.0, color: '#22c55e' },
];

const WATERFALL_DATA = [
  {
    name: 'Channel Mix',
    Google:  18420,
    Meta:    9841,
    Bing:    3148,
    Organic: 16912,
  },
];

// 30 days of mock daily revenue data
const DAILY_DATA = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 2, i + 1);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const adRevenue = Math.round(800 + Math.sin(i * 0.4) * 150 + Math.random() * 100);
  const organicRevenue = Math.round(450 + Math.cos(i * 0.3) * 80 + Math.random() * 60);
  return { date: label, 'Ad Revenue': adRevenue, 'Organic Revenue': organicRevenue };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  subColor = 'text-muted-foreground',
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground tabular-nums mt-1">{value}</p>
        {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttributionTab({ orgId: _orgId, orgSlug: _orgSlug, period: _period }: AttributionTabProps) {
  const totalRevenue = 48320;
  const adAttributed = 31408;
  const organic = 16912;

  return (
    <div className="flex flex-col gap-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value="$48,320"
          sub="↑ +12% vs prior period"
          subColor="text-green-600"
        />
        <StatCard label="Ad-Attributed" value="$31,408" sub="65% of total" />
        <StatCard label="Organic" value="$16,912" sub="35% of total" />
        <StatCard label="Blended ROAS" value="4.1x" />
      </div>

      {/* Attribution waterfall */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Revenue Attribution by Channel</p>
        </div>
        <CardContent className="p-5 pt-4">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={WATERFALL_DATA}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Google"  stackId="a" fill="#4285f4" />
              <Bar dataKey="Meta"    stackId="a" fill="#1877f2" />
              <Bar dataKey="Bing"    stackId="a" fill="#00809d" />
              <Bar dataKey="Organic" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform breakdown table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Platform Breakdown</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium text-muted-foreground">Platform</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Revenue</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Spend</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">ROAS</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLATFORM_DATA.map((row) => (
              <TableRow key={row.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  ${row.revenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {row.spend > 0 ? `$${row.spend.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {row.roas !== null ? `${row.roas.toFixed(2)}x` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 rounded-full bg-gray-100 w-16 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.revenue / totalRevenue) * 100}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                    <span className="text-sm tabular-nums w-10 text-right">{row.pct}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Daily trend chart */}
      <Card className="rounded-xl shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Daily Revenue Trend (30 days)</p>
        </div>
        <CardContent className="p-5 pt-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={DAILY_DATA} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={4}
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Ad Revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Organic Revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
