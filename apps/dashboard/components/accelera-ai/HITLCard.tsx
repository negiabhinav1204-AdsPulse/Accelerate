'use client'

import React, { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────

export type HITLType = 'confirmation' | 'form' | 'choice'
export type HITLStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type HITLActionStyle = 'primary' | 'danger' | 'default'

export interface HITLAction {
  action: string
  label: string
  style?: HITLActionStyle
}

export type HITLFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'date'
  | 'toggle'
  | 'select'
  | 'multiselect'
  | 'email'
  | 'url'
  | 'color'

export interface HITLFieldOption {
  value: string
  label: string
}

export interface HITLField {
  name: string
  label: string
  type: HITLFieldType
  required?: boolean
  default?: string | number | boolean | string[]
  placeholder?: string
  options?: HITLFieldOption[]
  min?: number
  max?: number
  step?: number
  rows?: number
}

export interface HITLChoice {
  value: string
  label: string
  description?: string
}

export interface HITLRequest {
  hitl_id: string
  type: HITLType
  title: string
  description?: string
  danger?: boolean
  payload?: Record<string, unknown>
  actions?: HITLAction[]
  fields?: HITLField[]
  choices?: HITLChoice[]
  status?: HITLStatus
  resolved_action?: string
}

export interface HITLDecision {
  hitl_id: string
  action: string
  reason?: string
  modifications?: Record<string, unknown>
  selected?: string
}

// ── Main Component ────────────────────────────────────────────────────

interface HITLCardProps {
  data: HITLRequest
  onAction?: (decision: HITLDecision) => void
}

export function HITLCard({ data, onAction }: HITLCardProps) {
  // Resolved HITL — don't render; workflow card shows progress
  if (data.status && data.status !== 'pending') {
    return null
  }

  switch (data.type) {
    case 'form':
      return <FormCard data={data} onAction={onAction} />
    case 'choice':
      return <ChoiceCard data={data} onAction={onAction} />
    default:
      return <ConfirmationCard data={data} onAction={onAction} />
  }
}

// ── Shared: Action Buttons ────────────────────────────────────────────

function ActionButtons({
  actions,
  hitlId,
  danger,
  onAction,
  extraPayload,
  disabledAction,
}: {
  actions: HITLAction[]
  hitlId: string
  danger?: boolean
  onAction?: (decision: HITLDecision) => void
  extraPayload?: Partial<HITLDecision>
  disabledAction?: string
}) {
  return (
    <div className="mt-3 flex gap-2">
      {actions.map((a) => {
        const isPrimary = a.style === 'primary'
        const isActionDanger = a.style === 'danger'
        const isDisabled = disabledAction === a.action

        let cls: string
        if (isPrimary) {
          cls = danger
            ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } else if (isActionDanger) {
          cls = 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
        } else {
          cls = 'border border-border text-foreground hover:bg-accent'
        }

        return (
          <button
            key={a.action}
            type="button"
            disabled={isDisabled}
            onClick={() =>
              onAction?.({ hitl_id: hitlId, action: a.action, ...extraPayload })
            }
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40',
              cls,
            )}
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Payload Table ─────────────────────────────────────────────────────

function PayloadTable({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload)
  if (entries.length === 0) return null

  const hasNested = entries.some(([, v]) => typeof v === 'object' && v !== null)

  if (hasNested) {
    return (
      <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between py-0.5">
          <span className="text-muted-foreground/70">{k}</span>
          <span className="font-medium">{String(v)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Confirmation Card ─────────────────────────────────────────────────

function ConfirmationCard({ data, onAction }: HITLCardProps) {
  const isDanger = !!data.danger
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        isDanger
          ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
          : 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10',
      )}
    >
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      {data.description && (
        <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
      )}
      {data.payload && <PayloadTable payload={data.payload} />}
      <ActionButtons
        actions={data.actions ?? []}
        hitlId={data.hitl_id}
        danger={isDanger}
        onAction={onAction}
      />
    </div>
  )
}

// ── Form Card ─────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none transition-colors placeholder:text-muted-foreground'

function FormCard({ data, onAction }: HITLCardProps) {
  // Campaign config form: fields=[] but payload has platform_campaign_types
  const isCampaignConfig =
    (data.fields ?? []).length === 0 &&
    !!data.payload &&
    typeof data.payload.platform_campaign_types === 'object' &&
    data.payload.platform_campaign_types !== null

  if (isCampaignConfig) {
    return <CampaignConfigForm data={data} onAction={onAction} />
  }

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {}
    for (const f of data.fields ?? []) {
      if (f.default !== undefined) {
        defaults[f.name] = f.default
      } else if (f.type === 'multiselect') {
        defaults[f.name] = []
      } else if (f.type === 'toggle') {
        defaults[f.name] = false
      }
    }
    return defaults
  })

  const update = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }))

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4 dark:border-primary/30">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      {data.description && (
        <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
      )}
      <div className="mt-3 space-y-3">
        {(data.fields ?? []).map((f) => (
          <FieldInput key={f.name} field={f} value={values[f.name]} onChange={update} />
        ))}
      </div>
      <ActionButtons
        actions={data.actions ?? []}
        hitlId={data.hitl_id}
        onAction={onAction}
        extraPayload={{ modifications: values }}
      />
    </div>
  )
}

// ── Campaign Config Form ──────────────────────────────────────────────

interface PlatformCampaignTypeOption { value: string; label: string }
interface PlatformCampaignTypes { label: string; types: PlatformCampaignTypeOption[] }

function CampaignConfigForm({ data, onAction }: HITLCardProps) {
  const payload = data.payload as {
    url?: string
    website?: string
    currency?: string
    platform_campaign_types: Record<string, PlatformCampaignTypes>
    defaults?: {
      start_date?: string
      end_date?: string
      total_budget?: number | null
      selected_types?: Record<string, string[]>
      goal?: string | null
    }
  }
  const defaults = payload.defaults ?? {}
  const platforms = Object.keys(payload.platform_campaign_types)

  // Which platforms are enabled (at least one type selected)
  const [enabledPlatforms, setEnabledPlatforms] = useState<Set<string>>(() => {
    const selected = defaults.selected_types ?? {}
    const enabled = new Set<string>()
    for (const p of platforms) {
      if ((selected[p]?.length ?? 0) > 0) enabled.add(p)
    }
    if (enabled.size === 0) platforms.forEach(p => enabled.add(p))
    return enabled
  })

  // Selected campaign types per platform
  const [selectedTypes, setSelectedTypes] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {}
    for (const p of platforms) {
      init[p] = new Set(defaults.selected_types?.[p] ?? [])
    }
    return init
  })

  const [totalBudget, setTotalBudget] = useState<string>(
    defaults.total_budget != null ? String(defaults.total_budget) : ''
  )
  const [startDate, setStartDate] = useState(defaults.start_date ?? '')
  const [endDate, setEndDate] = useState(defaults.end_date ?? '')
  const [goal, setGoal] = useState(defaults.goal ?? '')

  const togglePlatform = (platform: string) => {
    setEnabledPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  const toggleType = (platform: string, type: string) => {
    setSelectedTypes(prev => {
      const next = { ...prev }
      const set = new Set(next[platform])
      if (set.has(type)) set.delete(type)
      else set.add(type)
      next[platform] = set
      return next
    })
  }

  const handleSubmit = (action: string) => {
    const platformSelections: Record<string, string[]> = {}
    const activePlatforms: string[] = []
    for (const p of platforms) {
      if (enabledPlatforms.has(p)) {
        activePlatforms.push(p)
        platformSelections[p] = Array.from(selectedTypes[p] ?? [])
      }
    }
    onAction?.({
      hitl_id: data.hitl_id,
      action,
      modifications: {
        platforms: activePlatforms,
        platform_selections: platformSelections,
        total_budget: totalBudget ? Number(totalBudget) : null,
        start_date: startDate,
        end_date: endDate,
        goal: goal || null,
      },
    })
  }

  const PLATFORM_COLORS: Record<string, string> = {
    GOOGLE: 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950',
    BING: 'text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950',
    META: 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950',
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4 dark:border-primary/30">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      {data.description && (
        <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
      )}

      <div className="mt-4 space-y-4">
        {/* Platform + campaign type selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platforms & Campaign Types</label>
          {platforms.map(platform => {
            const info = payload.platform_campaign_types[platform]!
            const isEnabled = enabledPlatforms.has(platform)
            const color = PLATFORM_COLORS[platform] ?? 'text-gray-600 border-gray-200 bg-gray-50'
            return (
              <div key={platform} className={cn('rounded-lg border p-3 transition-colors', isEnabled ? color : 'border-border bg-muted/20 opacity-60')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{info.label}</span>
                  <button
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      isEnabled ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      isEnabled ? 'translate-x-4' : 'translate-x-0',
                    )} />
                  </button>
                </div>
                {isEnabled && info.types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {info.types.map(t => {
                      const checked = selectedTypes[platform]?.has(t.value) ?? false
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => toggleType(platform, t.value)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                            checked
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-muted-foreground border-border hover:border-foreground/40',
                          )}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Budget */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Daily Budget {payload.currency ? `(${payload.currency}/day)` : '(/day)'}
          </label>
          <input
            type="number"
            value={totalBudget}
            placeholder="e.g. 5000"
            min={0}
            onChange={e => setTotalBudget(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Goal */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Campaign Goal <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
          <input
            type="text"
            value={goal}
            placeholder="e.g. Increase product sales"
            onChange={e => setGoal(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {(data.actions ?? []).map(a => {
          const isPrimary = a.style === 'primary'
          return (
            <button
              key={a.action}
              type="button"
              onClick={() => handleSubmit(a.action)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isPrimary
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-border text-foreground hover:bg-accent',
              )}
            >
              {a.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: HITLField
  value: unknown
  onChange: (name: string, value: unknown) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {field.label}{' '}
        {field.required && <span className="text-red-400">*</span>}
      </label>
      {renderField(field, value, onChange)}
    </div>
  )
}

function renderField(
  field: HITLField,
  value: unknown,
  onChange: (name: string, value: unknown) => void,
) {
  const strValue = String(value ?? '')
  const arrValue = Array.isArray(value) ? (value as string[]) : []

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={strValue}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={inputCls}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={strValue}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(field.name, Number(e.target.value))}
          className={inputCls}
        />
      )

    case 'slider': {
      const num = Number(strValue || (field.min ?? 0))
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            value={num}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(e) => onChange(field.name, Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="min-w-[3rem] text-right text-sm font-medium text-foreground">
            {num}
          </span>
        </div>
      )
    }

    case 'toggle':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(field.name, !value)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            value ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
              value ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      )

    case 'select':
      return (
        <select
          value={strValue}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={inputCls}
        >
          <option value="">{field.placeholder ?? 'Select...'}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )

    case 'multiselect':
      return (
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => {
            const checked = arrValue.includes(o.value)
            return (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? arrValue.filter((v) => v !== o.value)
                      : [...arrValue, o.value]
                    onChange(field.name, next)
                  }}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-sm text-foreground">{o.label}</span>
              </label>
            )
          })}
        </div>
      )

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strValue || '#6b21a8'}
            onChange={(e) => onChange(field.name, e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-lg border border-border p-0.5 bg-background"
          />
          <span className="text-xs font-mono text-muted-foreground">
            {strValue || '#6b21a8'}
          </span>
        </div>
      )

    case 'email':
    case 'url':
      return (
        <input
          type={field.type}
          value={strValue}
          placeholder={
            field.placeholder ??
            (field.type === 'email' ? 'name@example.com' : 'https://')
          }
          onChange={(e) => onChange(field.name, e.target.value)}
          className={inputCls}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          value={strValue}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={inputCls}
        />
      )

    default:
      return (
        <input
          type="text"
          value={strValue}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={inputCls}
        />
      )
  }
}

// ── Choice Card ───────────────────────────────────────────────────────

function ChoiceCard({ data, onAction }: HITLCardProps) {
  const [selected, setSelected] = useState<string>('')

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 dark:border-teal-800 dark:bg-teal-900/10">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      {data.description && (
        <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
      )}
      <div className="mt-3 space-y-2">
        {(data.choices ?? []).map((c) => (
          <ChoiceOption
            key={c.value}
            choice={c}
            hitlId={data.hitl_id}
            selected={selected === c.value}
            onSelect={() => setSelected(c.value)}
          />
        ))}
      </div>
      <ActionButtons
        actions={data.actions ?? []}
        hitlId={data.hitl_id}
        onAction={onAction}
        extraPayload={{ selected }}
        disabledAction={!selected ? 'select' : undefined}
      />
    </div>
  )
}

function ChoiceOption({
  choice,
  hitlId,
  selected,
  onSelect,
}: {
  choice: HITLChoice
  hitlId: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
        selected
          ? 'border-teal-400 bg-teal-50 dark:border-teal-600 dark:bg-teal-900/20'
          : 'border-border hover:border-teal-300 dark:hover:border-teal-700',
      )}
    >
      <input
        type="radio"
        name={`hitl-choice-${hitlId}`}
        value={choice.value}
        checked={selected}
        onChange={onSelect}
        className="accent-teal-600"
      />
      <div>
        <div className="text-sm font-medium text-foreground">{choice.label}</div>
        {choice.description && (
          <div className="text-xs text-muted-foreground">{choice.description}</div>
        )}
      </div>
    </label>
  )
}
