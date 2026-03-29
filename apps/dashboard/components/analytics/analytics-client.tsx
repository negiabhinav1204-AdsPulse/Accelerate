'use client';

import * as React from 'react';
import { BarChart2Icon } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';

import { AttributionTab } from './tabs/attribution-tab';
import { FunnelTab } from './tabs/funnel-tab';
import { GeographyTab } from './tabs/geography-tab';
import { InsightsTab } from './tabs/insights-tab';
import { LlmTrafficTab } from './tabs/llm-traffic-tab';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsClientProps {
  orgId: string;
  orgSlug: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsClient({ orgId, orgSlug }: AnalyticsClientProps) {
  const [period, setPeriod] = React.useState<string>('30d');
  const [activeTab, setActiveTab] = React.useState<string>('attribution');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BarChart2Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Analytics</h2>
            <p className="text-sm text-muted-foreground">Revenue attribution, funnel, and AI traffic intelligence</p>
          </div>
        </div>

        {/* Period selector */}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="llm_traffic">LLM Traffic</TabsTrigger>
        </TabsList>

        <TabsContent value="attribution" className="mt-6">
          <AttributionTab orgId={orgId} orgSlug={orgSlug} period={period} />
        </TabsContent>

        <TabsContent value="funnel" className="mt-6">
          <FunnelTab orgId={orgId} orgSlug={orgSlug} period={period} />
        </TabsContent>

        <TabsContent value="geography" className="mt-6">
          <GeographyTab orgId={orgId} orgSlug={orgSlug} period={period} />
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <InsightsTab orgId={orgId} orgSlug={orgSlug} onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="llm_traffic" className="mt-6">
          <LlmTrafficTab orgId={orgId} orgSlug={orgSlug} period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
