'use client';

import * as React from 'react';
import {
  AlertTriangleIcon,
  BotIcon,
  GlobeIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InsightsTabProps {
  orgId: string;
  orgSlug: string;
  onTabChange?: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Types & mock data
// ---------------------------------------------------------------------------

type Priority = 'high' | 'medium' | 'low';

interface Insight {
  id: string;
  type: string;
  priority: Priority;
  iconKey: 'bot' | 'alert' | 'globe' | 'trending';
  title: string;
  description: string;
  metric: string;
  metricPositive: boolean;
  actionLabel: string;
  actionTab: string;
}

const INSIGHTS: Insight[] = [
  {
    id: '1',
    type: 'high_llm_traffic',
    priority: 'medium',
    iconKey: 'bot',
    title: '14% of visitors arriving from AI platforms',
    description:
      'ChatGPT (8.2%), Claude (3.1%), and Perplexity (2.7%) are sending qualified traffic. Consider creating LLM-optimised landing pages.',
    metric: '+14%',
    metricPositive: true,
    actionLabel: 'View LLM Traffic',
    actionTab: 'llm_traffic',
  },
  {
    id: '2',
    type: 'funnel_bottleneck',
    priority: 'high',
    iconKey: 'alert',
    title: '61% of cart additions don\'t reach checkout',
    description:
      'Your add-to-cart → checkout conversion is 39%, below the 65% e-commerce benchmark. Simplify checkout or add cart abandonment recovery.',
    metric: '-61%',
    metricPositive: false,
    actionLabel: 'View Funnel',
    actionTab: 'funnel',
  },
  {
    id: '3',
    type: 'geo_opportunity',
    priority: 'medium',
    iconKey: 'globe',
    title: 'Germany drives traffic but low conversions',
    description:
      'Germany sends 11% of your traffic but only 2.1% of conversions. Currency or shipping friction may be the cause.',
    metric: '2.1% CVR',
    metricPositive: false,
    actionLabel: 'View Geography',
    actionTab: 'geography',
  },
  {
    id: '4',
    type: 'conversion_trend',
    priority: 'low',
    iconKey: 'trending',
    title: 'Conversion rate up 18% this week',
    description:
      'Your conversion rate of 4.2% is 18% above your 30-day average of 3.6%. Google Ads campaign appears to be driving qualified traffic.',
    metric: '+18%',
    metricPositive: true,
    actionLabel: 'View Attribution',
    actionTab: 'attribution',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBorderColor(priority: Priority): string {
  switch (priority) {
    case 'high':   return 'border-l-red-500';
    case 'medium': return 'border-l-amber-500';
    case 'low':    return 'border-l-blue-500';
  }
}

function priorityBadgeClass(priority: Priority): string {
  switch (priority) {
    case 'high':   return 'bg-red-100 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low':    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

function InsightIcon({ iconKey }: { iconKey: Insight['iconKey'] }) {
  const cls = 'h-5 w-5';
  switch (iconKey) {
    case 'bot':      return <BotIcon className={cls} />;
    case 'alert':    return <AlertTriangleIcon className={cls} />;
    case 'globe':    return <GlobeIcon className={cls} />;
    case 'trending': return <TrendingUpIcon className={cls} />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightsTab({ orgId: _orgId, orgSlug: _orgSlug, onTabChange }: InsightsTabProps) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [refreshed, setRefreshed] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshed(true);
      setDismissed(new Set());
    }, 1200);
  }

  const visible = INSIGHTS.filter((i) => !dismissed.has(i.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Smart Insights</h3>
            <p className="text-xs text-muted-foreground">
              {refreshed ? 'Refreshed just now' : 'Generated just now'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCwIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Insight cards */}
      {visible.length === 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <SparklesIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">All insights dismissed</p>
            <p className="text-xs text-muted-foreground">Click Refresh to generate new insights.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {visible.map((insight) => (
          <Card
            key={insight.id}
            className={`rounded-xl shadow-sm border-l-4 ${priorityBorderColor(insight.priority)} transition-all duration-300`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <InsightIcon iconKey={insight.iconKey} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold uppercase tracking-wide ${priorityBadgeClass(insight.priority)}`}
                    >
                      {insight.priority}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold tabular-nums ${
                        insight.metricPositive
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      {insight.metric}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {insight.description}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {onTabChange && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-3"
                        onClick={() => onTabChange(insight.actionTab)}
                      >
                        {insight.actionLabel}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dismiss */}
                <button
                  className="shrink-0 p-1 rounded hover:bg-gray-100 text-muted-foreground transition-colors"
                  onClick={() =>
                    setDismissed((prev) => new Set([...prev, insight.id]))
                  }
                  aria-label="Dismiss insight"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
