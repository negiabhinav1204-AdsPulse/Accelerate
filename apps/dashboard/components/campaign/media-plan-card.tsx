'use client';

import * as React from 'react';
import { RocketIcon } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

import type { MediaPlan, PlatformPlan } from './types';

// ── Platform icons (small, inline) ───────────────────────────────────────────

function GoogleIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-4 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MetaIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-4 shrink-0">
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-4 shrink-0">
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function platformLabel(platform: string): string {
  switch (platform) {
    case 'google': return 'Google Ads';
    case 'meta': return 'Meta Ads';
    case 'bing': return 'Microsoft Ads';
    default: return platform;
  }
}

function PlatformIcon({ platform }: { platform: string }): React.JSX.Element {
  if (platform === 'google') return <GoogleIconSm />;
  if (platform === 'meta') return <MetaIconSm />;
  if (platform === 'bing') return <MicrosoftIconSm />;
  return <span className="size-4 rounded-full bg-muted shrink-0" />;
}

function formatBudget(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

// ── Props ─────────────────────────────────────────────────────────────────────

type MediaPlanCardProps = {
  plan: MediaPlan;
  onPreview: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MediaPlanCard({ plan, onPreview }: MediaPlanCardProps): React.JSX.Element {
  const totalAds = plan.platforms.reduce(
    (sum, p) => sum + p.adTypes.reduce((s, at) => s + at.ads.length, 0),
    0
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 max-w-sm w-full">
      {/* Top section — dark blue gradient */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 px-4 py-4 space-y-3">
        {/* Campaign name */}
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0 mt-0.5">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              {plan.campaignName}
            </p>
            <p className="text-xs text-blue-200 mt-0.5">
              {plan.objective} • {plan.summary.tagline || 'Brand Campaign'} • {plan.duration} days
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-white">
              {formatBudget(plan.totalBudget, plan.currency)}
            </p>
            <p className="text-xs text-blue-200">
              {formatBudget(plan.dailyBudget, plan.currency)}/day
            </p>
          </div>
        </div>

        {/* Target audience */}
        <div className="flex items-center gap-2 flex-wrap">
          {plan.targetAudience.gender && plan.targetAudience.ageRange && (
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-blue-100">
              👥 {plan.targetAudience.gender} {plan.targetAudience.ageRange}
            </span>
          )}
          {plan.targetAudience.locations.slice(0, 2).map((loc) => (
            <span key={loc} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-blue-100">
              📍 {loc}
            </span>
          ))}
          {plan.targetAudience.locations.length > 2 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-blue-100">
              +{plan.targetAudience.locations.length - 2} more
            </span>
          )}
        </div>

        {/* Platform chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {plan.platforms.map((p) => (
            <span
              key={p.platform}
              className="rounded-full bg-white/15 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-white"
            >
              {platformLabel(p.platform)}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom section — white */}
      <div className="bg-white dark:bg-card px-4 py-3 space-y-3">
        {/* Platforms heading */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Platforms
          </p>
        </div>

        {/* Per-platform rows */}
        <div className="space-y-2">
          {plan.platforms.map((p) => {
            const adCount = p.adTypes.reduce((sum, at) => sum + at.ads.length, 0);
            return (
              <div key={p.platform} className="flex items-center gap-2">
                <PlatformIcon platform={p.platform} />
                <span className="text-xs font-medium text-foreground flex-1">
                  {platformLabel(p.platform)}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {formatBudget(p.budget, plan.currency)}
                </span>
              </div>
            );
          })}
          {plan.platforms.map((p) => {
            const adCount = p.adTypes.reduce((sum, at) => sum + at.ads.length, 0);
            return (
              <div key={`${p.platform}-meta`} className="flex items-center text-xs text-muted-foreground pl-6 -mt-1.5">
                <span>
                  {p.budgetPercent}% of total • {p.adTypes.length} ad type{p.adTypes.length !== 1 ? 's' : ''} • {adCount} ad{adCount !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  className="ml-2 text-primary hover:underline text-xs"
                >
                  View Ad types ({p.adTypes.length}) &gt;
                </button>
              </div>
            );
          })}
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={onPreview}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        >
          Preview Campaign
          <RocketIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
