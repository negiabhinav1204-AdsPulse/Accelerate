'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { MapPin, Users, Monitor, Globe, Search, Image as ImageIcon, Layers } from 'lucide-react'

interface AgenticSidebarPanelProps {
  blockType: string
  data: Record<string, unknown>
  onClose: () => void
  orgSlug?: string
}

interface CampaignTargeting {
  locations: string[]
  languages: string[]
  age_ranges: string[]
  genders: string[]
  keywords: string[]
}

interface CampaignCreatives {
  headlines: string[]
  descriptions: string[]
  long_headlines: string[]
  images: string[]
  business_name: string
  call_to_action: string
}

interface MediaPlanCampaign {
  name: string
  platform: string
  campaign_type: string
  daily_budget: number
  currency: string
  targeting?: CampaignTargeting
  creatives?: CampaignCreatives
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function MetricGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
  return (
    <div className="grid grid-cols-2 gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs text-gray-400 mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
          <div className="text-sm font-semibold text-gray-900 truncate">{formatValue(value)}</div>
        </div>
      ))}
    </div>
  )
}

function CampaignDetailPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const status = data.status as string | undefined
  const statusColor = status === 'active' ? 'bg-emerald-500' : status === 'paused' ? 'bg-amber-500' : 'bg-gray-400'
  const platform = data.platform as string | undefined
  const name = (data.campaign_name ?? data.name) as string | undefined
  const dailyMetrics = data.daily_metrics as Array<Record<string, unknown>> | undefined

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        {(platform || status) && (
          <div className="flex items-center gap-2 mb-1">
            {status && <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />}
            <span className="text-xs font-medium text-gray-400 uppercase">
              {[platform, status].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
        {name && <h2 className="text-xl font-bold text-gray-900">{name}</h2>}
      </div>

      <MetricGrid data={data} />

      {dailyMetrics && dailyMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Daily Breakdown</h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Spend</th>
                  <th className="px-3 py-2 text-right font-medium">Clicks</th>
                  <th className="px-3 py-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {dailyMetrics.map((day, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-600">{String(day.date ?? '')}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatValue(day.spend)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatValue(day.clicks)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatValue(day.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Done
      </button>
    </div>
  )
}

function BudgetApprovalPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Budget Approval</h2>
        {!!data.description && (
          <p className="text-sm text-gray-500 mt-1">{String(data.description)}</p>
        )}
      </div>

      <MetricGrid data={data} />

      {Array.isArray(data.line_items) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Budget Breakdown</h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-right font-medium">Budget</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {(data.line_items as Array<Record<string, unknown>>).map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-600">{String(item.channel ?? item.name ?? '')}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatValue(item.budget ?? item.amount)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatValue(item.percent ?? item.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Close
      </button>
    </div>
  )
}

function FallbackPanel({ blockType, data, onClose }: { blockType: string; data: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <span className="text-xs font-medium text-gray-400 uppercase">{blockType.replace(/_/g, ' ')}</span>
      </div>

      {/* Try MetricGrid for flat data, fall back to raw JSON */}
      {Object.values(data).some(v => typeof v !== 'object' || v === null) && (
        <MetricGrid data={data} />
      )}

      {Object.entries(data).some(([, v]) => v !== null && typeof v === 'object') && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Details</h3>
          <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      <button
        onClick={onClose}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Close
      </button>
    </div>
  )
}

const PLATFORM_META: Record<string, { label: string; pill: string; dot: string }> = {
  GOOGLE: { label: 'Google', pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  BING:   { label: 'Microsoft', pill: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  META:   { label: 'Meta', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  SEARCH:          { label: 'Search',          icon: <Search className="w-3 h-3" /> },
  DISPLAY:         { label: 'Display',         icon: <ImageIcon className="w-3 h-3" /> },
  PERFORMANCE_MAX: { label: 'Performance Max', icon: <Layers className="w-3 h-3" /> },
}

function extractDomain(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return url }
}

function SearchAdPreview({ creatives, url }: { creatives: CampaignCreatives; url: string }) {
  const headlines = creatives.headlines.slice(0, 3)
  const description = creatives.descriptions[0] ?? ''
  const domain = extractDomain(url)
  if (!headlines.length && !description) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <p className="text-[11px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Ad Preview</p>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Ad</span>
        <span className="text-[12px] text-gray-500 truncate">{domain}</span>
      </div>
      <p className="text-[14px] text-blue-600 font-medium leading-snug mb-1 line-clamp-2">
        {headlines.join(' · ')}
      </p>
      <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-2">{description}</p>
    </div>
  )
}

function DisplayAdPreview({ creatives }: { creatives: CampaignCreatives }) {
  const image = creatives.images[0]
  const headline = creatives.headlines[0] ?? creatives.long_headlines[0] ?? ''
  const description = creatives.descriptions[0] ?? ''
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden text-sm">
      <p className="text-[11px] text-gray-400 px-4 pt-3 pb-1 font-medium uppercase tracking-wide">Ad Preview</p>
      {image && (
        <div className="mx-4 mb-3 rounded-lg overflow-hidden bg-gray-100 h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      )}
      <div className="px-4 pb-4">
        {headline && <p className="text-[14px] font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">{headline}</p>}
        {description && <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-2">{description}</p>}
      </div>
    </div>
  )
}

function PMaxPreview({ creatives }: { creatives: CampaignCreatives }) {
  return (
    <div className="space-y-3">
      {creatives.headlines.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Headlines ({creatives.headlines.length})</p>
          <div className="space-y-1.5">
            {creatives.headlines.slice(0, 5).map((h, i) => (
              <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{h}</div>
            ))}
          </div>
        </div>
      )}
      {creatives.long_headlines.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Long Headlines ({creatives.long_headlines.length})</p>
          <div className="space-y-1.5">
            {creatives.long_headlines.slice(0, 3).map((h, i) => (
              <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{h}</div>
            ))}
          </div>
        </div>
      )}
      {creatives.descriptions.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Descriptions ({creatives.descriptions.length})</p>
          <div className="space-y-1.5">
            {creatives.descriptions.map((d, i) => (
              <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{d}</div>
            ))}
          </div>
        </div>
      )}
      {creatives.images.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Images</p>
          <div className="flex gap-2 flex-wrap">
            {creatives.images.slice(0, 3).map((img, i) => (
              <div key={i} className="rounded-lg overflow-hidden bg-gray-100 w-24 h-24 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TargetingView({ targeting, campaignType }: { targeting: CampaignTargeting; campaignType: string }) {
  const [expandedKw, setExpandedKw] = useState(false)
  const items = [
    targeting.locations.length > 0 && {
      icon: <MapPin className="w-4 h-4 text-gray-400" />, label: 'LOCATION', value: targeting.locations,
    },
    targeting.languages.length > 0 && {
      icon: <Globe className="w-4 h-4 text-gray-400" />, label: 'LANGUAGE', value: targeting.languages,
    },
    (targeting.age_ranges.length > 0 || targeting.genders.length > 0) && {
      icon: <Users className="w-4 h-4 text-gray-400" />, label: 'AGE & GENDER',
      value: [...targeting.age_ranges, ...targeting.genders].filter(Boolean),
    },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string[] }>

  return (
    <div className="space-y-1 pb-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 px-1 py-3 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
            <p className="text-[13px] text-gray-800 leading-relaxed">{item.value.join(' · ')}</p>
          </div>
        </div>
      ))}

      {targeting.keywords.length > 0 && campaignType === 'SEARCH' && (
        <div className="flex items-start gap-3 px-1 py-3 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="mt-0.5 flex-shrink-0"><Search className="w-4 h-4 text-gray-400" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              KEYWORDS ({targeting.keywords.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(expandedKw ? targeting.keywords : targeting.keywords.slice(0, 12)).map((kw, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[12px] text-gray-700">{kw}</span>
              ))}
            </div>
            {targeting.keywords.length > 12 && (
              <button
                onClick={() => setExpandedKw(v => !v)}
                className="mt-2 text-[12px] font-medium text-blue-600 hover:underline"
              >
                {expandedKw ? 'Show less' : `+${targeting.keywords.length - 12} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {items.length === 0 && targeting.keywords.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No targeting data available</p>
      )}
    </div>
  )
}

function MediaPlanPanel({ data, onClose, orgSlug }: { data: Record<string, unknown>; onClose: () => void; orgSlug?: string }) {
  const planName = (data['plan_name'] ?? data['plan_id'] ?? 'Media Plan') as string
  const currencyTotals = data['currency_totals'] as Record<string, number> | undefined
  const totalDailyBudget = data['total_daily_budget'] as number | undefined
  const currency = data['currency'] as string | undefined
  const planId = data['plan_id'] as string | undefined
  const siteUrl = (data['url'] as string | undefined) ?? ''
  const campaigns = (data['campaigns'] ?? []) as MediaPlanCampaign[]

  const campaignsUrl = orgSlug
    ? (planId ? `/organizations/${orgSlug}/campaigns` : `/organizations/${orgSlug}/campaigns`)
    : '/campaigns'

  // Derive unique platforms and ad types
  const platforms = useMemo(() => Array.from(new Set(campaigns.map(c => c.platform))), [campaigns])
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'targeting' | 'creatives'>('targeting')

  useEffect(() => { if (platforms.length && !selectedPlatform) setSelectedPlatform(platforms[0]) }, [platforms, selectedPlatform])

  const adTypes = useMemo(() => (
    Array.from(new Set(campaigns.filter(c => c.platform === selectedPlatform).map(c => c.campaign_type)))
  ), [campaigns, selectedPlatform])

  useEffect(() => { setSelectedType(adTypes[0] ?? null) }, [adTypes])

  const selectedCampaign = useMemo(() => (
    campaigns.find(c => c.platform === selectedPlatform && c.campaign_type === selectedType)
  ), [campaigns, selectedPlatform, selectedType])

  const hasRichData = campaigns.some(c => c.targeting || c.creatives)

  // Fallback: basic list for old block data without targeting/creatives
  if (!hasRichData) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Media Plan Ready</span>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{planName}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length || Number(data['campaign_count'] ?? 0)} campaigns built</p>
        </div>
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {currencyTotals && Object.entries(currencyTotals).map(([cur, total]) => (
            <div key={cur} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Total Daily Budget</span>
              <span className="text-sm font-semibold text-gray-900">{cur} {Number(total).toLocaleString()}</span>
            </div>
          ))}
          {!currencyTotals && totalDailyBudget !== undefined && currency && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Total Daily Budget</span>
              <span className="text-sm font-semibold text-gray-900">{currency} {Number(totalDailyBudget).toLocaleString()}</span>
            </div>
          )}
        </div>
        <a href={campaignsUrl} className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          View in Campaign Manager
        </a>
        <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Close</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Media Plan Ready</span>
        <h2 className="text-lg font-bold text-gray-900 mt-0.5 leading-snug">{planName}</h2>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-gray-500">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
          {currencyTotals
            ? Object.entries(currencyTotals).map(([cur, total]) => (
              <span key={cur} className="text-xs font-semibold text-gray-700">{cur} {Number(total).toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</span>
            ))
            : totalDailyBudget !== undefined && currency && (
              <span className="text-xs font-semibold text-gray-700">{currency} {Number(totalDailyBudget).toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</span>
            )
          }
        </div>
      </div>

      {/* Platform pills */}
      <div className="flex gap-2 px-5 pt-3 pb-2 flex-wrap">
        {platforms.map(p => {
          const meta = PLATFORM_META[p] ?? { label: p, pill: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-400' }
          const isSelected = p === selectedPlatform
          return (
            <button
              key={p}
              onClick={() => setSelectedPlatform(p)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-all ${isSelected ? `${meta.pill} shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              <span className={`w-2 h-2 rounded-full ${isSelected ? meta.dot : 'bg-gray-300'}`} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Ad type pills */}
      {adTypes.length > 1 && (
        <div className="flex gap-2 px-5 pb-2 flex-wrap">
          {adTypes.map(t => {
            const meta = TYPE_META[t] ?? { label: t, icon: null }
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${t === selectedType ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                {meta.icon}
                {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-5">
        {(['targeting', 'creatives'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative mr-8 pb-2.5 pt-2 text-[13px] font-semibold capitalize transition-colors ${activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab}
            {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab content — parent SidebarPanel handles outer scroll */}
      <div className="px-5 pt-4">
        {selectedCampaign ? (
          activeTab === 'targeting' ? (
            selectedCampaign.targeting
              ? <TargetingView targeting={selectedCampaign.targeting} campaignType={selectedCampaign.campaign_type} />
              : <p className="text-sm text-gray-400 text-center py-8">No targeting data available</p>
          ) : (
            selectedCampaign.creatives ? (
              selectedCampaign.campaign_type === 'SEARCH'
                ? <div className="space-y-4 pb-4"><SearchAdPreview creatives={selectedCampaign.creatives} url={siteUrl} />{selectedCampaign.creatives.headlines.length > 3 && <div><p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">All Headlines ({selectedCampaign.creatives.headlines.length})</p><div className="space-y-1.5">{selectedCampaign.creatives.headlines.map((h, i) => <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{h}</div>)}</div></div>}{selectedCampaign.creatives.descriptions.length > 0 && <div><p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">All Descriptions</p><div className="space-y-1.5">{selectedCampaign.creatives.descriptions.map((d, i) => <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{d}</div>)}</div></div>}</div>
                : selectedCampaign.campaign_type === 'DISPLAY'
                ? <div className="pb-4"><DisplayAdPreview creatives={selectedCampaign.creatives} /></div>
                : <div className="pb-4"><PMaxPreview creatives={selectedCampaign.creatives} /></div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No creative data available</p>
            )
          )
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Select a platform to preview</p>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100 mt-4">
        <a href={campaignsUrl} className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          View in Campaign Manager
        </a>
      </div>
    </div>
  )
}

/**
 * AgenticSidebarPanel — routes block data to the right panel component
 * based on blockType. Used by openSidebar() and openModal() in accelera-ai-home.
 */
export function AgenticSidebarPanel({ blockType, data, onClose, orgSlug }: AgenticSidebarPanelProps) {
  switch (blockType) {
    case 'campaign_details':
      return <CampaignDetailPanel data={data} onClose={onClose} />
    case 'budget_approval':
      return <BudgetApprovalPanel data={data} onClose={onClose} />
    case 'media_plan':
      return <MediaPlanPanel data={data} onClose={onClose} orgSlug={orgSlug} />
    default:
      return <FallbackPanel blockType={blockType} data={data} onClose={onClose} />
  }
}
