'use client';

import * as React from 'react';
import {
  ActivityIcon,
  FlaskConicalIcon,
  GlobeIcon,
  PlusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react';
import Link from 'next/link';

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
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExperimentStatus = 'running' | 'paused' | 'ended' | 'draft';

interface Experiment {
  id: string;
  name: string;
  page: string;
  page_url: string;
  status: ExperimentStatus;
  days_running: number;
  confidence: number;
  lift: number;
  visitors: number;
  conversions: number;
}

// ---------------------------------------------------------------------------
// Mock data — TODO: replace with real API call to /api/personalization/experiments?orgId=
// ---------------------------------------------------------------------------

const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp1',
    name: 'Hero Headline Test',
    page: 'Homepage',
    page_url: 'https://example.com',
    status: 'running',
    days_running: 12,
    confidence: 87.3,
    lift: 14.2,
    visitors: 4820,
    conversions: 312,
  },
  {
    id: 'exp2',
    name: 'CTA Button Color',
    page: 'Product Page',
    page_url: 'https://example.com/products/shoes',
    status: 'running',
    days_running: 6,
    confidence: 61.4,
    lift: 5.8,
    visitors: 1930,
    conversions: 89,
  },
  {
    id: 'exp3',
    name: 'Checkout Trust Badge',
    page: 'Checkout',
    page_url: 'https://example.com/checkout',
    status: 'ended',
    days_running: 21,
    confidence: 97.8,
    lift: 22.1,
    visitors: 8104,
    conversions: 1024,
  },
  {
    id: 'exp4',
    name: 'Price Display Format',
    page: 'Product Page',
    page_url: 'https://example.com/products/shoes',
    status: 'paused',
    days_running: 3,
    confidence: 34.1,
    lift: -2.1,
    visitors: 820,
    conversions: 31,
  },
];

// Summary mock
const SUMMARY = { pages_tracked: 3, zones_defined: 8 };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExperimentsClientProps {
  orgId: string;
  orgSlug: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ExperimentStatus,
  { label: string; className: string }
> = {
  running: {
    label: 'Running',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  ended: {
    label: 'Ended',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  draft: {
    label: 'Draft',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 95
      ? 'bg-green-500'
      : value >= 50
        ? 'bg-yellow-400'
        : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-foreground">{value.toFixed(1)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExperimentsClient({ orgId, orgSlug }: ExperimentsClientProps) {
  // TODO: replace mock data with real API call to /api/personalization/experiments?orgId=${orgId}
  const [experiments] = React.useState<Experiment[]>(MOCK_EXPERIMENTS);
  const [activeTab, setActiveTab] = React.useState<'all' | ExperimentStatus>('all');

  const filtered =
    activeTab === 'all'
      ? experiments
      : experiments.filter((e) => e.status === activeTab);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">A/B Experiments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor and manage all personalization experiments.
          </p>
        </div>
        <Button className="gap-2 bg-blue-500 hover:bg-blue-600 text-white">
          <PlusIcon className="h-4 w-4" />
          New Experiment
        </Button>
      </div>

      {/* Summary banner */}
      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GlobeIcon className="h-4 w-4 text-blue-500" />
          <span>
            Pages tracked:{' '}
            <span className="font-semibold text-foreground">{SUMMARY.pages_tracked}</span>
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ZapIcon className="h-4 w-4 text-purple-500" />
          <span>
            Zones defined:{' '}
            <span className="font-semibold text-foreground">{SUMMARY.zones_defined}</span>
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ActivityIcon className="h-4 w-4 text-green-500" />
          <span>
            Running:{' '}
            <span className="font-semibold text-foreground">
              {experiments.filter((e) => e.status === 'running').length}
            </span>
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="ended">Ended</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <FlaskConicalIcon className="h-7 w-7 text-blue-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">No experiments found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an experiment from the Personalization editor.
            </p>
          </div>
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-medium text-muted-foreground">Experiment</TableHead>
                <TableHead className="font-medium text-muted-foreground">Page</TableHead>
                <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">Runtime</TableHead>
                <TableHead className="font-medium text-muted-foreground">Confidence</TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">Lift</TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">Visitors</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((exp) => {
                const statusCfg = STATUS_CONFIG[exp.status];
                return (
                  <TableRow key={exp.id} className="hover:bg-gray-50/50">
                    {/* Name */}
                    <TableCell>
                      <span className="font-medium text-foreground">{exp.name}</span>
                    </TableCell>

                    {/* Page */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-foreground">{exp.page}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {exp.page_url.replace(/^https?:\/\//, '')}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </Badge>
                    </TableCell>

                    {/* Runtime */}
                    <TableCell className="text-center text-sm text-foreground tabular-nums">
                      {exp.days_running}d
                    </TableCell>

                    {/* Confidence */}
                    <TableCell>
                      <ConfidenceBar value={exp.confidence} />
                    </TableCell>

                    {/* Lift */}
                    <TableCell className="text-center">
                      {exp.lift > 0 ? (
                        <span className="flex items-center justify-center gap-1 text-sm font-medium text-green-600">
                          <TrendingUpIcon className="h-3.5 w-3.5" />+{exp.lift.toFixed(1)}%
                        </span>
                      ) : exp.lift < 0 ? (
                        <span className="flex items-center justify-center gap-1 text-sm font-medium text-red-500">
                          <TrendingDownIcon className="h-3.5 w-3.5" />{exp.lift.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Visitors */}
                    <TableCell className="text-center text-sm text-foreground tabular-nums">
                      {exp.visitors.toLocaleString()}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <Link href={`/organizations/${orgSlug}/experiments/${exp.id}/live`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <ActivityIcon className="h-3.5 w-3.5" />
                          Live View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
