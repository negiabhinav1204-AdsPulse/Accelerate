'use client';

import * as React from 'react';
import { AlertTriangleIcon, GlobeIcon } from 'lucide-react';

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

interface GeographyTabProps {
  orgId: string;
  orgSlug: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const COUNTRIES = [
  { country: 'United States', code: 'US', flag: '🇺🇸', revenue: 28450, orders: 312, visitors: 8420,  cvr: 3.7 },
  { country: 'United Kingdom', code: 'GB', flag: '🇬🇧', revenue: 8121,  orders: 89,  visitors: 2140, cvr: 4.2 },
  { country: 'Canada',         code: 'CA', flag: '🇨🇦', revenue: 5231,  orders: 67,  visitors: 1890, cvr: 3.5 },
  { country: 'Germany',        code: 'DE', flag: '🇩🇪', revenue: 2840,  orders: 31,  visitors: 1340, cvr: 2.3 },
  { country: 'Australia',      code: 'AU', flag: '🇦🇺', revenue: 2180,  orders: 28,  visitors: 980,  cvr: 2.9 },
  { country: 'France',         code: 'FR', flag: '🇫🇷', revenue: 1499,  orders: 18,  visitors: 760,  cvr: 2.4 },
];

const CITIES = [
  { city: 'New York, US',    revenue: 5240 },
  { city: 'Los Angeles, US', revenue: 4180 },
  { city: 'London, UK',      revenue: 3420 },
  { city: 'Chicago, US',     revenue: 2940 },
  { city: 'Toronto, CA',     revenue: 2211 },
  { city: 'Sydney, AU',      revenue: 1840 },
];

const MAX_REVENUE = COUNTRIES[0].revenue;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeographyTab({ orgId: _orgId, orgSlug: _orgSlug, period: _period }: GeographyTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <GlobeIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Countries</p>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums mt-1">28</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Top Market</p>
            <p className="text-2xl font-bold text-foreground mt-1">United States</p>
            <p className="text-xs text-muted-foreground mt-1">58.9% of revenue</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Avg Conv. Rate</p>
            <p className="text-3xl font-bold text-foreground tabular-nums mt-1">3.6%</p>
          </CardContent>
        </Card>
      </div>

      {/* Countries table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Top Countries by Revenue</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium text-muted-foreground">Country</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Revenue</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Orders</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Visitors</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Conv. Rate</TableHead>
              <TableHead className="font-medium text-muted-foreground">Revenue Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COUNTRIES.map((row) => {
              const barWidth = (row.revenue / MAX_REVENUE) * 100;
              const cvrColor =
                row.cvr >= 3.5
                  ? 'text-green-600'
                  : row.cvr >= 2.5
                    ? 'text-amber-600'
                    : 'text-red-500';
              return (
                <TableRow key={row.code}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{row.flag}</span>
                      <span className="text-sm font-medium text-foreground">{row.country}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    ${row.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {row.orders.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {row.visitors.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-medium tabular-nums ${cvrColor}`}>
                      {row.cvr.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                        {((row.revenue / MAX_REVENUE) * 58.9).toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Opportunity alert */}
      <Card className="rounded-xl shadow-sm border-amber-200 bg-amber-50">
        <CardContent className="p-5 flex gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">International Opportunity</p>
            <p className="text-xs text-amber-700 mt-1">
              Germany, France, and Netherlands have significant traffic but below-average conversion
              rates (2.1–2.4%). Consider adding EUR currency support and EU shipping options to unlock
              this audience.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Top cities */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Top Cities</h3>
        <div className="grid grid-cols-2 gap-3">
          {CITIES.map((c) => (
            <Card key={c.city} className="rounded-xl shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <p className="text-sm font-medium text-foreground">{c.city}</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  ${c.revenue.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
