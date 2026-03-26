'use client';

import * as React from 'react';
import {
  BrainIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  Loader2Icon,
  SparklesIcon,
  TrendingUpIcon,
  ZapIcon
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type BrandOutput = {
  brandName: string;
  industry: string;
  iabCategory: string;
  tone: string;
  brandScale: string;
  valuePropositions: string[];
  targetAudience: string;
  brandGuidelinesSummary: string;
  country: string;
  confidenceScore: number;
  colors: string[];
};

type LpuOutput = {
  pageType: string;
  products: string[];
  offers: string[];
  callToAction: string;
  conversionGoal: string;
  trustSignals: string[];
  existingPixels: string[];
  heroHeadline: string;
  confidenceScore: number;
};

type IntentOutput = {
  primaryIntent: string;
  actionType: string;
  funnelStage: string;
  keywords: string[];
  audienceSignals: string[];
  kpiTargets: { primaryKpi: string; primaryTarget: string; secondaryKpi: string; secondaryTarget: string };
  multiPhaseRecommended: boolean;
  confidenceScore: number;
};

type CompetitorOutput = {
  competitors: string[];
  dominantPlatform: string;
  dominantFormat: string;
  marketSaturation: string;
  pricingTier: string;
  differentiators: string[];
  messagingThemes: string[];
};

type TrendOutput = {
  trends: string[];
  seasonalFactors: string[];
  opportunities: string[];
};

type CreativeOutput = {
  headlines: string[];
  descriptions: string[];
  adVariations: { headline: string; description: string; cta: string; messagingAngle: string }[];
  concepts: { conceptId: string; messagingAngle: string; headline: string; bodyText: string; cta: string; brandAlignmentScore: number }[];
};

type BudgetOutput = {
  recommendedTotal: number;
  platformAllocation: Record<string, number>;
  dailyBudget: number;
  duration: number;
};

type StoredAgentOutputs = {
  brand?: BrandOutput;
  lpu?: LpuOutput;
  intent?: IntentOutput;
  competitor?: CompetitorOutput;
  trend?: TrendOutput;
  creative?: CreativeOutput;
  budget?: BudgetOutput;
};

type AgentData = {
  campaign: {
    id: string;
    name: string;
    sourceUrl: string | null;
    objective: string | null;
    acceId: string | null;
    totalBudget: number | null;
    currency: string | null;
    createdAt: string;
  };
  agentOutputs: StoredAgentOutputs;
};

// ── Agent section component ────────────────────────────────────────────────────

function AgentSection({
  icon,
  label,
  badge,
  badgeVariant = 'default',
  children
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'green' | 'blue' | 'purple';
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(true);

  const badgeClass = {
    default: 'bg-muted text-muted-foreground',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
  }[badgeVariant];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
            {icon}
          </div>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {badge && (
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badgeClass)}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUpIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'blue' | 'green' | 'orange' }): React.JSX.Element {
  const cls = {
    default: 'bg-muted text-muted-foreground',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
  }[variant];
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cls)}>{children}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground w-32">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignAgentsView({
  campaignId,
  orgId
}: {
  campaignId: string;
  orgId: string;
}): React.JSX.Element {
  const [data, setData] = React.useState<AgentData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/agents?orgId=${orgId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setError(body.error ?? 'Failed to load agent analysis');
          return;
        }
        const json = await res.json() as AgentData;
        setData(json);
      } catch {
        setError('Failed to load agent analysis');
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-sm">Loading agent analysis…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <BrainIcon className="size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No agent analysis available</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {error ?? 'Agent analysis is only available for campaigns created through Accelera AI.'}
        </p>
      </div>
    );
  }

  const { agentOutputs: ao } = data;

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <SparklesIcon className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Agent Analysis</p>
          <p className="text-xs text-muted-foreground">
            Powered by Gemini — {new Date(data.campaign.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {data.campaign.sourceUrl && (
          <a
            href={data.campaign.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLinkIcon className="size-3" />
            Source URL
          </a>
        )}
      </div>

      {/* Brand Agent */}
      {ao.brand && (
        <AgentSection icon="🎨" label="Brand Analysis" badge={`${Math.round(ao.brand.confidenceScore * 100)}% confidence`} badgeVariant="green">
          <div className="space-y-2">
            <Row label="Brand" value={<span className="font-medium">{ao.brand.brandName}</span>} />
            <Row label="Industry" value={ao.brand.industry} />
            <Row label="IAB Category" value={ao.brand.iabCategory} />
            <Row label="Tone" value={<Tag variant="blue">{ao.brand.tone}</Tag>} />
            <Row label="Scale" value={<Tag variant="orange">{ao.brand.brandScale}</Tag>} />
            <Row label="Country" value={ao.brand.country} />
            {ao.brand.colors.length > 0 && (
              <Row
                label="Brand colors"
                value={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ao.brand.colors.slice(0, 6).map((c) => (
                      <span key={c} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="inline-block size-4 rounded-sm border border-border"
                          style={{ backgroundColor: c.startsWith('#') ? c : `#${c}` }}
                        />
                        {c}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
            {ao.brand.valuePropositions.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Value propositions</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.brand.valuePropositions.map((vp) => <Tag key={vp}>{vp}</Tag>)}
                </div>
              </div>
            )}
            {ao.brand.brandGuidelinesSummary && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                {ao.brand.brandGuidelinesSummary}
              </p>
            )}
          </div>
        </AgentSection>
      )}

      {/* Landing Page Agent */}
      {ao.lpu && (
        <AgentSection icon="📄" label="Landing Page Analysis" badge={`${Math.round(ao.lpu.confidenceScore * 100)}% confidence`} badgeVariant="green">
          <div className="space-y-2">
            <Row label="Page type" value={<Tag variant="blue">{ao.lpu.pageType}</Tag>} />
            <Row label="Hero headline" value={<span className="italic">&ldquo;{ao.lpu.heroHeadline}&rdquo;</span>} />
            <Row label="CTA" value={ao.lpu.callToAction} />
            <Row label="Goal" value={ao.lpu.conversionGoal} />
            {ao.lpu.existingPixels.length > 0 && (
              <Row
                label="Pixels detected"
                value={
                  <div className="flex flex-wrap gap-1">
                    {ao.lpu.existingPixels.map((p) => <Tag key={p} variant="green">{p}</Tag>)}
                  </div>
                }
              />
            )}
            {ao.lpu.products.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Products / offers</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.lpu.products.slice(0, 8).map((p) => <Tag key={p}>{p}</Tag>)}
                </div>
              </div>
            )}
            {ao.lpu.trustSignals.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Trust signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.lpu.trustSignals.slice(0, 6).map((s) => <Tag key={s} variant="green">{s}</Tag>)}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}

      {/* Intent Agent */}
      {ao.intent && (
        <AgentSection icon="🎯" label="Intent Analysis" badge={ao.intent.funnelStage + ' funnel'} badgeVariant="blue">
          <div className="space-y-2">
            <Row label="Primary intent" value={<Tag variant="blue">{ao.intent.primaryIntent}</Tag>} />
            <Row label="Action type" value={ao.intent.actionType} />
            <Row label="Multi-phase" value={ao.intent.multiPhaseRecommended ? 'Recommended' : 'Not needed'} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Primary KPI</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{ao.intent.kpiTargets.primaryKpi}</p>
                <p className="text-xs text-muted-foreground">{ao.intent.kpiTargets.primaryTarget}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Secondary KPI</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{ao.intent.kpiTargets.secondaryKpi}</p>
                <p className="text-xs text-muted-foreground">{ao.intent.kpiTargets.secondaryTarget}</p>
              </div>
            </div>
            {ao.intent.keywords.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Top keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.intent.keywords.slice(0, 12).map((k) => <Tag key={k} variant="blue">{k}</Tag>)}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}

      {/* Competitor Agent */}
      {ao.competitor && (
        <AgentSection icon="🔍" label="Competitor Analysis" badge={ao.competitor.marketSaturation + ' saturation'} badgeVariant="orange">
          <div className="space-y-2">
            <Row label="Dominant platform" value={ao.competitor.dominantPlatform} />
            <Row label="Dominant format" value={ao.competitor.dominantFormat} />
            <Row label="Pricing tier" value={<Tag variant="orange">{ao.competitor.pricingTier}</Tag>} />
            {ao.competitor.competitors.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Identified competitors</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.competitor.competitors.map((c) => <Tag key={c}>{c}</Tag>)}
                </div>
              </div>
            )}
            {ao.competitor.differentiators.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Your differentiators</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.competitor.differentiators.map((d) => <Tag key={d} variant="green">{d}</Tag>)}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}

      {/* Trend Agent */}
      {ao.trend && (
        <AgentSection icon="📈" label="Trend Analysis">
          <div className="space-y-3">
            {ao.trend.trends.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Market trends</p>
                <ul className="space-y-1">
                  {ao.trend.trends.slice(0, 4).map((t) => (
                    <li key={t} className="flex items-start gap-2 text-xs text-foreground">
                      <TrendingUpIcon className="size-3 mt-0.5 shrink-0 text-blue-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ao.trend.opportunities.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Opportunities</p>
                <ul className="space-y-1">
                  {ao.trend.opportunities.slice(0, 3).map((o) => (
                    <li key={o} className="flex items-start gap-2 text-xs text-foreground">
                      <ZapIcon className="size-3 mt-0.5 shrink-0 text-green-500" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ao.trend.seasonalFactors.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Seasonal factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.trend.seasonalFactors.map((s) => <Tag key={s} variant="orange">{s}</Tag>)}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}

      {/* Budget Agent */}
      {ao.budget && (
        <AgentSection icon="💰" label="Budget Recommendation">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total budget</p>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {data.campaign.currency ?? ''} {ao.budget.recommendedTotal.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Daily budget</p>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {data.campaign.currency ?? ''} {ao.budget.dailyBudget.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-base font-bold text-foreground mt-0.5">{ao.budget.duration} days</p>
              </div>
            </div>
            {Object.entries(ao.budget.platformAllocation).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Platform split</p>
                <div className="space-y-1.5">
                  {Object.entries(ao.budget.platformAllocation).map(([platform, pct]) => (
                    <div key={platform} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize w-20 shrink-0">{platform}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-foreground w-8 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}

      {/* Creative Agent */}
      {ao.creative && (
        <AgentSection icon="✨" label="Creative Concepts" badge={`${ao.creative.concepts?.length ?? 0} concepts`} badgeVariant="purple">
          <div className="space-y-3">
            {ao.creative.concepts?.slice(0, 3).map((concept, i) => (
              <div key={concept.conceptId ?? i} className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Tag variant="blue">{concept.messagingAngle.replace(/_/g, ' ')}</Tag>
                  <span className="text-xs text-muted-foreground ml-auto">Brand fit: {concept.brandAlignmentScore}/10</span>
                </div>
                <p className="text-sm font-semibold text-foreground">&ldquo;{concept.headline}&rdquo;</p>
                <p className="text-xs text-muted-foreground">{concept.bodyText}</p>
                <span className="inline-block text-xs font-medium text-primary">{concept.cta}</span>
              </div>
            ))}
            {ao.creative.headlines.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Headlines pool ({ao.creative.headlines.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {ao.creative.headlines.slice(0, 8).map((h) => <Tag key={h}>{h}</Tag>)}
                </div>
              </div>
            )}
          </div>
        </AgentSection>
      )}
    </div>
  );
}
