'use client';

import * as React from 'react';
import { SparklesIcon, TrendingUpIcon, ShoppingCartIcon, ZapIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type CampaignPlan = {
  segment: string;
  label: string;
  strategy: string;
  product_count: number;
  revenue_60d?: number;
  suggested_budget_daily: string;
  priority: 'high' | 'medium' | 'low';
  campaign_type?: string;
  top_products?: { title: string; revenue?: number }[];
};

type Props = {
  title?: string;
  total_campaigns: number;
  total_daily_budget: string;
  total_monthly_estimate: string;
  campaigns: CampaignPlan[];
  currency?: string;
};

const PRIORITY_CONFIG = {
  high: { label: 'HIGH', className: 'border-red-500/30 bg-red-500/10 text-red-600' },
  medium: { label: 'MED', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  low: { label: 'LOW', className: 'border-muted/50 bg-muted/30 text-muted-foreground' },
};

const CAMPAIGN_TYPE_ICON: Record<string, React.ReactNode> = {
  shopping: <ShoppingCartIcon className="size-3.5 shrink-0 text-muted-foreground" />,
  performance_max: <ZapIcon className="size-3.5 shrink-0 text-muted-foreground" />,
  search: <TrendingUpIcon className="size-3.5 shrink-0 text-muted-foreground" />,
};

export function ChatStrategyCard({
  title,
  total_campaigns,
  total_daily_budget,
  total_monthly_estimate,
  campaigns,
  currency = 'USD',
}: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SparklesIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title ?? 'Suggested Campaign Strategy'}</span>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 divide-x border-b">
        <StatTile label="Campaigns" value={String(total_campaigns)} />
        <StatTile label="Daily Budget" value={total_daily_budget} />
        <StatTile label="Monthly Est." value={total_monthly_estimate} />
      </div>

      {/* Campaign rows */}
      {campaigns.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No campaigns suggested.
        </div>
      ) : (
        <div className="divide-y">
          {campaigns.map((c, i) => {
            const priorityCfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.low;
            const typeIcon =
              c.campaign_type ? (CAMPAIGN_TYPE_ICON[c.campaign_type] ?? <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" />) : null;

            return (
              <div key={`${c.segment}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeIcon}
                    <span className="text-sm font-medium truncate">{c.label}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${priorityCfg.className}`}>
                      {priorityCfg.label}
                    </Badge>
                    {c.campaign_type && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {c.campaign_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.strategy}</p>
                  {c.top_products && c.top_products.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Top: {c.top_products.slice(0, 2).map((p) => p.title).join(', ')}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-sm font-medium tabular-nums">{c.suggested_budget_daily}/day</p>
                  <p className="text-xs text-muted-foreground">{c.product_count} products</p>
                  {c.revenue_60d != null && (
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency,
                        minimumFractionDigits: 0,
                      }).format(c.revenue_60d)}{' '}
                      rev
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
