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

function MediaPlanPanel({ data, onClose, orgSlug }: { data: Record<string, unknown>; onClose: () => void; orgSlug?: string }) {
  const planName = (data['plan_name'] ?? data['plan_id'] ?? 'Media Plan') as string
  const campaignCount = (data['campaign_count'] ?? data['count']) as number | undefined
  const platforms = data['platforms'] as string[] | undefined
  const currencyTotals = data['currency_totals'] as Record<string, number> | undefined
  const totalDailyBudget = data['total_daily_budget'] as number | undefined
  const currency = data['currency'] as string | undefined
  const planId = data['plan_id'] as string | undefined

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Media Plan Ready</span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{planName}</h2>
        {campaignCount !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">{campaignCount} campaign{campaignCount !== 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {currencyTotals && Object.entries(currencyTotals).map(([cur, total]) => (
          <div key={cur} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Daily Budget</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {cur} {Number(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {!currencyTotals && totalDailyBudget !== undefined && currency && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Daily Budget</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currency} {Number(totalDailyBudget).toLocaleString()}
            </span>
          </div>
        )}
        {platforms && platforms.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Platforms</span>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {platforms.map((p) => (
                <span key={p} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {orgSlug && (
        <a
          href={planId ? `/organizations/${orgSlug}/campaigns/${planId}` : `/organizations/${orgSlug}/campaigns`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          View in Campaign Manager
        </a>
      )}
      {!planId && (
        <p className="text-xs text-gray-400 text-center">Campaigns are built and ready to publish once your ad accounts are connected.</p>
      )}

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
