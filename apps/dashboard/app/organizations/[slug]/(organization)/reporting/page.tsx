import * as React from 'react';
import type { Metadata } from 'next';
import {
  BarChart3Icon,
  DownloadIcon,
  TrendingUpIcon,
  TrendingDownIcon
} from 'lucide-react';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Reporting')
};

const DATE_FILTERS = [
  { label: 'Today', value: '1d' },
  { label: '7 days', value: '7d' },
  { label: '15 days', value: '15d' },
  { label: '30 days', value: '30d' },
  { label: 'Yearly', value: '1y' },
  { label: 'Custom', value: 'custom' }
];

const REPORT_ROWS = [
  { metric: 'Total Spend', google: '$1,240', meta: '$890', bing: '$—', total: '$2,130', trend: 'up' },
  { metric: 'Impressions', google: '84,200', meta: '210,000', bing: '—', total: '294,200', trend: 'up' },
  { metric: 'Clicks', google: '3,100', meta: '5,400', bing: '—', total: '8,500', trend: 'up' },
  { metric: 'CTR', google: '3.68%', meta: '2.57%', bing: '—', total: '2.89%', trend: 'down' },
  { metric: 'Avg. CPC', google: '$0.40', meta: '$0.16', bing: '—', total: '$0.25', trend: 'down' },
  { metric: 'Conversions', google: '142', meta: '89', bing: '—', total: '231', trend: 'up' },
  { metric: 'ROAS', google: '4.2x', meta: '2.8x', bing: '—', total: '3.6x', trend: 'up' }
];

export default async function ReportingPage(): Promise<React.JSX.Element> {
  await getAuthOrganizationContext();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center justify-between w-full">
            <h1 className="text-lg font-semibold text-foreground">Reporting</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      f.value === '30d'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <DownloadIcon className="size-3.5" />
                Export
              </button>
            </div>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6 space-y-6">
          {/* Cross-platform table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Cross-Platform Performance</h3>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">Last 30 days · Placeholder data</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Metric</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Google Ads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Meta Ads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Microsoft Ads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider font-semibold">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">vs. Prior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {REPORT_ROWS.map((row) => (
                  <tr key={row.metric} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{row.metric}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.google}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.meta}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.bing}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{row.total}</td>
                    <td className="px-5 py-3 text-right">
                      {row.trend === 'up' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <TrendingUpIcon className="size-3" /> +—%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                          <TrendingDownIcon className="size-3" /> −—%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart placeholder */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Spend & ROAS Trend</h3>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">Coming soon</span>
            </div>
            <div className="h-56 rounded-lg bg-muted/40 flex items-center justify-center">
              <div className="text-center space-y-2">
                <BarChart3Icon className="size-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">Time-series chart will render once data pipeline syncs</p>
              </div>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
