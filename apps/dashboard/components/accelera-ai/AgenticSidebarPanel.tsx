'use client'

import React from 'react'

interface AgenticSidebarPanelProps {
  blockType: string
  data: Record<string, unknown>
  onClose: () => void
  orgSlug?: string
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

const PLATFORM_COLORS: Record<string, string> = {
  GOOGLE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  META: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  BING: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

const TYPE_LABELS: Record<string, string> = {
  SEARCH: 'Search', DISPLAY: 'Display', PERFORMANCE_MAX: 'Performance Max',
  AWARENESS: 'Awareness', TRAFFIC: 'Traffic', ENGAGEMENT: 'Engagement',
  LEADS: 'Lead Gen', SALES: 'Sales',
}

function MediaPlanPanel({ data, onClose, orgSlug }: { data: Record<string, unknown>; onClose: () => void; orgSlug?: string }) {
  const planName = (data['plan_name'] ?? data['plan_id'] ?? 'Media Plan') as string
  const currencyTotals = data['currency_totals'] as Record<string, number> | undefined
  const totalDailyBudget = data['total_daily_budget'] as number | undefined
  const currency = data['currency'] as string | undefined
  const planId = data['plan_id'] as string | undefined
  const campaigns = (data['campaigns'] ?? []) as Array<{ name: string; platform: string; campaign_type: string; daily_budget: number; currency: string }>

  const campaignsUrl = orgSlug
    ? (planId ? `/organizations/${orgSlug}/campaigns/${planId}` : `/organizations/${orgSlug}/campaigns`)
    : '/campaigns'

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Media Plan Ready</span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{planName}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{campaigns.length || data['campaign_count']} campaigns built</p>
      </div>

      {/* Budget summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {currencyTotals && Object.entries(currencyTotals).map(([cur, total]) => (
          <div key={cur} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Total Daily Budget</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {cur} {Number(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {!currencyTotals && totalDailyBudget !== undefined && currency && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Total Daily Budget</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currency} {Number(totalDailyBudget).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Per-campaign list */}
      {campaigns.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Campaigns</h3>
          <div className="flex flex-col gap-2">
            {campaigns.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[c.campaign_type] ?? c.campaign_type}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PLATFORM_COLORS[c.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.platform}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                    {c.currency} {Number(c.daily_budget).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <a
        href={campaignsUrl}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        View in Campaign Manager
      </a>

      <button onClick={onClose} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        Close
      </button>
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
