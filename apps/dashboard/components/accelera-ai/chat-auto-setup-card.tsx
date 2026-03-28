'use client';

import * as React from 'react';
import { ZapIcon, CheckCircle2Icon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type SetupResult = {
  title: string;
  badge: string;
  suggested_strategy: string;
  suggested_platforms: string[];
  daily_budget: string;
  monthly_estimate: string;
  status: string;
};

type Props = {
  products_configured: number;
  results: SetupResult[];
  total_daily_budget: string;
  total_monthly_estimate: string;
  message?: string;
  next_step?: string;
};

const PLATFORM_CONFIG: Record<string, { label: string; className: string }> = {
  google: { label: 'Google', className: 'border-blue-500/30 bg-blue-500/10 text-blue-700' },
  meta: { label: 'Meta', className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700' },
  facebook: { label: 'Facebook', className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700' },
  instagram: { label: 'Instagram', className: 'border-pink-500/30 bg-pink-500/10 text-pink-700' },
  bing: { label: 'Bing', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700' },
  tiktok: { label: 'TikTok', className: 'border-slate-500/30 bg-slate-500/10 text-slate-700' },
};

function getPlatformCfg(platform: string) {
  return (
    PLATFORM_CONFIG[platform.toLowerCase()] ?? {
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      className: 'border-muted/50 bg-muted/30 text-muted-foreground',
    }
  );
}

function isReadyStatus(status: string): boolean {
  return status.toLowerCase().includes('ready') || status.toLowerCase().includes('configured');
}

export function ChatAutoSetupCard({
  products_configured,
  results,
  total_daily_budget,
  total_monthly_estimate,
  message,
  next_step,
}: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ZapIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Auto Campaign Setup</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-muted-foreground">Products</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{products_configured}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-muted-foreground">Daily Budget</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{total_daily_budget}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-muted-foreground">Monthly Est.</p>
          <p className="text-sm font-semibold tabular-nums mt-0.5">{total_monthly_estimate}</p>
        </div>
      </div>

      {/* Product rows */}
      {results.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No products configured.
        </div>
      ) : (
        <div className="divide-y">
          {results.map((r, i) => {
            const ready = isReadyStatus(r.status);
            return (
              <div key={`${r.title}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{r.title}</span>
                    {r.badge && (
                      <Badge variant="outline" className="text-xs shrink-0 border-muted/50 bg-muted/30 text-muted-foreground">
                        {r.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.suggested_strategy}</p>
                  {r.suggested_platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.suggested_platforms.map((p) => {
                        const cfg = getPlatformCfg(p);
                        return (
                          <Badge
                            key={p}
                            variant="outline"
                            className={`text-xs ${cfg.className}`}
                          >
                            {cfg.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-medium tabular-nums">{r.daily_budget}/day</p>
                  <p className="text-xs text-muted-foreground">{r.monthly_estimate}/mo</p>
                  {ready ? (
                    <Badge
                      variant="outline"
                      className="border-green-500/30 bg-green-500/10 text-green-700 text-xs"
                    >
                      <CheckCircle2Icon className="size-3 mr-1" />
                      Ready to Activate
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-muted/50 bg-muted/30 text-muted-foreground text-xs">
                      {r.status}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer message / next step */}
      {(message || next_step) && (
        <div className="border-t px-4 py-3 space-y-1">
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
          {next_step && (
            <p className="text-xs font-medium text-foreground">
              Next: {next_step}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
