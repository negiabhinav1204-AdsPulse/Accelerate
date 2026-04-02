'use client'

import React, { useState } from 'react'
import type { Step, Artifact } from './types'

// ── Helpers ────────────────────────────────────────────────────────────────

function str(v: unknown): string { return v != null ? String(v) : '' }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? v as T[] : [] }
function toStrArr(v: unknown): string[] { return Array.isArray(v) ? (v as unknown[]).map(str) : typeof v === 'string' ? [v] : [] }

// ── Artifact Renderers ─────────────────────────────────────────────────────

function WebsiteSummaryRenderer({ data }: { data: Record<string, unknown> }) {
  const cleanUrl = str(data.url).replace(/^https?:\/\//, '').split('?')[0]
  return (
    <div className="space-y-2">
      {!!data.title && <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{str(data.title)}</p>}
      {!!cleanUrl && <p className="text-[11px] text-gray-400 font-mono">{cleanUrl}</p>}
      <div className="flex flex-wrap gap-1">
        {!!data.page_type && <span className="px-1.5 py-0.5 rounded text-[11px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300">{str(data.page_type)}</span>}
        {!!data.shopify_product && <span className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300">Shopify</span>}
      </div>
      {!!data.description && <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">{str(data.description)}</p>}
    </div>
  )
}

function MarketContextRenderer({ data }: { data: Record<string, unknown> }) {
  const trends: Array<Record<string, unknown>> = Array.isArray(data.trends)
    ? data.trends as Array<Record<string, unknown>>
    : Array.isArray(data.key_trends)
      ? (data.key_trends as string[]).map(t => ({ description: t }))
      : []
  return (
    <div className="space-y-3">
      {!!(data.market || data.industry) && (
        <div className="flex flex-wrap gap-1.5">
          {!!data.market && <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{str(data.market)}</span>}
          {!!data.industry && <span className="text-[12px] text-gray-400">· {str(data.industry)}</span>}
        </div>
      )}
      {trends.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Key Trends</p>
          {trends.map((trend, i) => {
            const relevance = str(trend['relevance']).toLowerCase()
            const badge =
              relevance === 'high' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
              relevance === 'medium' ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
              'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            return (
              <div key={i} className="flex items-start gap-2">
                {!!relevance && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${badge}`}>{relevance}</span>}
                <p className="text-[12px] text-gray-600 dark:text-gray-400">{str(trend['description'])}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BrandIdentityRenderer({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {!!data.name && <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{str(data.name)}</p>}
      {!!data.positioning && <p className="text-[12px] text-gray-500 dark:text-gray-400 italic">{str(data.positioning)}</p>}
      {!!data.tone_of_voice && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tone</p>
          <p className="text-[12px] text-gray-600 dark:text-gray-400">{str(data.tone_of_voice)}</p>
        </div>
      )}
      {!!data.value_proposition && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Value Proposition</p>
          <p className="text-[12px] text-gray-600 dark:text-gray-400">{str(data.value_proposition)}</p>
        </div>
      )}
      {toStrArr(data.social_proof).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Social Proof</p>
          <ul className="space-y-0.5">
            {toStrArr(data.social_proof).map((s, i) => (
              <li key={i} className="text-[12px] text-gray-600 dark:text-gray-400">· {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AudiencePersonasRenderer({ data }: { data: Record<string, unknown> }) {
  const personas = arr<Record<string, unknown>>(data.personas)
  const [expanded, setExpanded] = useState(0)
  if (personas.length === 0) return <FallbackRenderer data={data} />
  return (
    <div className="space-y-2">
      {personas.map((p, i) => (
        <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? -1 : i)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
              {str(p['name'] ?? p['persona_name']) || `Persona ${i + 1}`}
            </span>
            <svg className={`h-3 w-3 text-gray-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l4 4 4-4" /></svg>
          </button>
          {expanded === i && (
            <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-800">
              {!!(p['gender'] || p['age'] || p['location']) && (
                <p className="text-[11px] text-gray-400 pt-2">{[p['gender'], p['age'], p['location']].filter(Boolean).map(str).join(' · ')}</p>
              )}
              {arr<string>(p['pain_points']).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Pain Points</p>
                  <div className="flex flex-wrap gap-1">
                    {arr<string>(p['pain_points']).map((pp, j) => (
                      <span key={j} className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300">{pp}</span>
                    ))}
                  </div>
                </div>
              )}
              {arr<string>(p['motivations']).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Motivations</p>
                  <ul>{arr<string>(p['motivations']).map((m, j) => <li key={j} className="text-[11px] text-gray-600 dark:text-gray-400">· {m}</li>)}</ul>
                </div>
              )}
              {arr<string>(p['search_queries']).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Search Queries</p>
                  <ul>{arr<string>(p['search_queries']).slice(0, 3).map((q, j) => <li key={j} className="text-[11px] font-mono text-blue-500 dark:text-blue-400">"{q}"</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ProductCatalogRenderer({ data }: { data: Record<string, unknown> }) {
  const products = arr<Record<string, unknown>>(data.products)
  if (products.length === 0) return <FallbackRenderer data={data} />
  return (
    <div className="space-y-3">
      {products.map((prod, i) => (
        <div key={i} className={i < products.length - 1 ? 'pb-3 border-b border-gray-100 dark:border-gray-800' : ''}>
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 mb-1">
            {str(prod['name'] ?? prod['title'])}
          </p>
          {!!prod['price_range'] && <p className="text-[11px] text-gray-400">{str(prod['price_range'])}</p>}
          {arr<string>(prod['key_features']).length > 0 && (
            <ul className="mt-1">
              {arr<string>(prod['key_features']).map((f, j) => <li key={j} className="text-[11px] text-gray-600 dark:text-gray-400">· {f}</li>)}
            </ul>
          )}
          {arr<string>(prod['benefits']).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {arr<string>(prod['benefits']).map((b, j) => (
                <span key={j} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{b}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CompetitorsRenderer({ data }: { data: Record<string, unknown> }) {
  const competitors = arr<Record<string, unknown>>(data.competitors)
  if (competitors.length === 0) return <FallbackRenderer data={data} />
  return (
    <div className="space-y-2">
      {competitors.map((comp, i) => (
        <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{str(comp['name'])}</p>
          {!!comp['domain'] && <p className="text-[11px] text-gray-400 font-mono">{str(comp['domain'])}</p>}
          {!!comp['differentiator'] && <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">{str(comp['differentiator'])}</p>}
        </div>
      ))}
    </div>
  )
}

function BudgetAllocationRenderer({ data }: { data: Record<string, unknown> }) {
  // Backend emits: { currency_totals: { "USD": 76.0 }, campaigns: [{ name, platform, daily_budget, currency, percentage }] }
  const campaigns = arr<Record<string, unknown>>(data.campaigns)
  const currencyTotals = (data.currency_totals ?? {}) as Record<string, number>
  const totalEntries = Object.entries(currencyTotals)
  return (
    <div className="space-y-2">
      {totalEntries.map(([cur, total]) => (
        <div key={cur} className="flex items-center justify-between py-1">
          <span className="text-[12px] text-gray-400">Total Daily Budget</span>
          <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            {cur} {Number(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
      {campaigns.map((c, i) => {
        const platform = str(c['platform'])
        const platformColor =
          platform === 'GOOGLE' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300' :
          platform === 'META' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300' :
          platform === 'BING' ? 'bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-300' :
          'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
        return (
          <div key={i} className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformColor}`}>{platform}</span>
              <span className="text-[12px] text-gray-600 dark:text-gray-400 truncate max-w-[120px]">{str(c['name'])}</span>
            </div>
            <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 shrink-0 ml-2">
              {str(c['currency'])} {Number(c['daily_budget'] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              {c['percentage'] != null ? ` (${Number(c['percentage']).toFixed(0)}%)` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CampaignStrategyRenderer({ data }: { data: Record<string, unknown> }) {
  const campaigns = arr<Record<string, unknown>>(data.campaigns)
  const currency = str(data.currency)
  return (
    <div className="space-y-2">
      {campaigns.map((c, i) => {
        const platform = str(c['platform'])
        const platformColor =
          platform === 'GOOGLE' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300' :
          platform === 'META' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300' :
          platform === 'BING' ? 'bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-300' :
          'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
        return (
          <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformColor}`}>{platform}</span>
              <span className="text-[11px] text-gray-400">{str(c['campaign_type'])}</span>
            </div>
            <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
              {str(c['audience_name'] ?? c['name'])}
            </p>
            {c['daily_budget'] != null && (
              <p className="text-[11px] text-gray-400">{currency} {Number(c['daily_budget']).toLocaleString()}/day</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FallbackRenderer({ data }: { data: Record<string, unknown> }) {
  const primitives = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object'
  )
  if (primitives.length === 0) {
    return (
      <pre className="text-[11px] text-gray-500 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    )
  }
  return (
    <div className="space-y-1.5">
      {primitives.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-[11px] text-gray-400 capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
          <span className="text-[11px] text-gray-700 dark:text-gray-300">{str(v)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Registry + Display Order ───────────────────────────────────────────────

const ARTIFACT_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, unknown> }>> = {
  website_summary: WebsiteSummaryRenderer,
  market_context: MarketContextRenderer,
  brand_identity: BrandIdentityRenderer,
  audience_personas: AudiencePersonasRenderer,
  product_catalog: ProductCatalogRenderer,
  competitors: CompetitorsRenderer,
  budget_allocation: BudgetAllocationRenderer,
  campaign_strategy: CampaignStrategyRenderer,
}

const DISPLAY_ORDER: Record<string, number> = {
  website_summary: 0,
  brand_identity: 1,
  market_context: 2,
  competitors: 3,
  product_catalog: 4,
  audience_personas: 5,
  campaign_strategy: 6,
  budget_allocation: 7,
}

function artifactSummary(artifact: Artifact): string {
  const d = artifact.data
  if (artifact.type === 'website_summary') return str(d['title'] ?? d['url'])
  if (artifact.type === 'brand_identity') return str(d['name'] ?? d['positioning'])
  if (artifact.type === 'market_context') return str(d['market'] ?? d['industry'])
  if (artifact.type === 'audience_personas') {
    const count = arr(d['personas']).length
    return count > 0 ? `${count} persona${count > 1 ? 's' : ''}` : ''
  }
  if (artifact.type === 'product_catalog') {
    const count = arr(d['products']).length
    return count > 0 ? `${count} product${count > 1 ? 's' : ''}` : ''
  }
  if (artifact.type === 'competitors') {
    const count = arr(d['competitors']).length
    return count > 0 ? `${count} competitor${count > 1 ? 's' : ''}` : ''
  }
  if (artifact.type === 'campaign_strategy') {
    const count = arr(d['campaigns']).length
    return count > 0 ? `${count} campaign${count > 1 ? 's' : ''}` : ''
  }
  return ''
}

// ── StepArtifactPanel ──────────────────────────────────────────────────────

export function StepArtifactPanel({ step, onClose }: { step: Step; onClose?: () => void }) {
  const sortedArtifacts = [...(step.artifacts ?? [])].sort(
    (a, b) => (DISPLAY_ORDER[a.type] ?? 99) - (DISPLAY_ORDER[b.type] ?? 99)
  )
  const [openIndex, setOpenIndex] = useState(0)
  const substeps = step.children ?? []

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Step Details</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{step.name}</h2>
        {!!step.result && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{step.result}</p>
        )}
      </div>

      {/* Substeps checklist */}
      {substeps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Completed ({substeps.filter(s => s.status === 'complete').length}/{substeps.length})
          </p>
          <div className="space-y-1">
            {substeps.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                  sub.status === 'complete' ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {sub.status === 'complete' && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">✓</span>
                  )}
                </div>
                <span className="text-[12px] text-gray-600 dark:text-gray-400">{sub.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artifact accordion cards */}
      {sortedArtifacts.length > 0 && (
        <div className="space-y-2">
          {sortedArtifacts.map((artifact, i) => {
            const Renderer = ARTIFACT_RENDERERS[artifact.type] ?? FallbackRenderer
            const summary = artifactSummary(artifact)
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                      {artifact.title}
                    </span>
                    {!isOpen && !!summary && (
                      <span className="text-[11px] text-gray-400 truncate">{summary}</span>
                    )}
                  </div>
                  <svg
                    className={`h-4 w-4 text-gray-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="pt-3">
                      <Renderer data={artifact.data} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {sortedArtifacts.length === 0 && substeps.length === 0 && (
        <p className="text-[13px] text-gray-400">No details available for this step.</p>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Close
        </button>
      )}
    </div>
  )
}
