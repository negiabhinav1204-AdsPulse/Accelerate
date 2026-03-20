import * as React from 'react';
import type { Metadata } from 'next';
import { MegaphoneIcon, PlusCircleIcon } from 'lucide-react';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Campaigns')
};

const PLACEHOLDER_CAMPAIGNS = [
  { name: 'Summer Sale 2026', platform: 'Google', status: 'Active', spend: '$1,240', impressions: '84,200', clicks: '3,100', roas: '4.2x' },
  { name: 'Brand Awareness Q1', platform: 'Meta', status: 'Active', spend: '$890', impressions: '210,000', clicks: '5,400', roas: '2.8x' },
  { name: 'Retargeting — Cart Abandoners', platform: 'Google', status: 'Paused', spend: '$340', impressions: '12,000', clicks: '980', roas: '6.1x' },
  { name: 'New Customer Acquisition', platform: 'Microsoft', status: 'Draft', spend: '—', impressions: '—', clicks: '—', roas: '—' }
];

const STATUS_STYLES: Record<string, string> = {
  Active: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  Paused: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  Draft: 'bg-muted text-muted-foreground'
};

export default async function CampaignsPage(): Promise<React.JSX.Element> {
  await getAuthOrganizationContext();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center justify-between w-full">
            <h1 className="text-lg font-semibold text-foreground">Campaigns</h1>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <PlusCircleIcon className="size-3.5" />
              New Campaign
            </button>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6 space-y-4">
          {/* Filter row */}
          <div className="flex items-center gap-2">
            {['All', 'Active', 'Paused', 'Draft'].map((f) => (
              <button
                key={f}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  f === 'All'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PLACEHOLDER_CAMPAIGNS.map((c) => (
                  <tr key={c.name} className="hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.platform}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.spend}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.impressions}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.clicks}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.roas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state hint */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <MegaphoneIcon className="size-4 shrink-0" />
            <span>Live campaign data will appear here once connectors are syncing. Showing placeholder data for layout preview.</span>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
