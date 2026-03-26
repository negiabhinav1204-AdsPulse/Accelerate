'use client';

import * as React from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  Loader2Icon,
  PlusIcon,
  XIcon
} from 'lucide-react';

import { toast } from '@workspace/ui/components/sonner';
import { cn } from '@workspace/ui/lib/utils';

import type { CampaignEditPayload, EditOperation } from '~/lib/campaign-edit-types';
import { setByPath } from '~/lib/campaign-edit-types';

// ── Field module types ────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
};

// ── Field modules ─────────────────────────────────────────────────────────────

function FieldWrapper({ label, hint, error, children }: FieldProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

function TextField({ label, hint, value, onChange, placeholder }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <FieldWrapper label={label} hint={hint}>
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FieldWrapper>
  );
}

function URLField({ label, hint, value, onChange }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  const isValid = !value || value.startsWith('http://') || value.startsWith('https://');
  return (
    <FieldWrapper label={label} hint={hint} error={!isValid ? 'Must start with http:// or https://' : undefined}>
      <input
        type="url"
        className={cn(inputClass, !isValid && 'border-red-400 focus:border-red-400 focus:ring-red-200')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://"
      />
    </FieldWrapper>
  );
}

function NumberField({ label, hint, value, onChange, min, max, prefix }: FieldProps & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
}): React.JSX.Element {
  return (
    <FieldWrapper label={label} hint={hint}>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">{prefix}</span>
        )}
        <input
          type="number"
          className={cn(inputClass, prefix && 'pl-8')}
          value={value === 0 ? '' : value}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    </FieldWrapper>
  );
}

function DateField({ label, hint, value, onChange }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <FieldWrapper label={label} hint={hint}>
      <input
        type="date"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrapper>
  );
}

function SelectField({ label, hint, value, options, onChange }: FieldProps & {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <FieldWrapper label={label} hint={hint}>
      <select
        className={cn(inputClass, 'cursor-pointer')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FieldWrapper>
  );
}

function TagsInput({ label, hint, values, onChange, placeholder }: FieldProps & {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}): React.JSX.Element {
  const [input, setInput] = React.useState('');

  function add(): void {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  }

  function remove(tag: string): void {
    onChange(values.filter((v) => v !== tag));
  }

  return (
    <FieldWrapper label={label} hint={hint}>
      <div className="rounded-lg border border-border bg-background p-2 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {values.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {tag}
              <button type="button" onClick={() => remove(tag)} className="hover:text-red-500 transition-colors">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder ?? 'Type and press Enter'}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button
            type="button"
            onClick={add}
            className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </FieldWrapper>
  );
}

function MultiInput({ label, hint, values, onChange, placeholder, maxItems }: FieldProps & {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}): React.JSX.Element {
  function update(index: number, value: string): void {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function remove(index: number): void {
    onChange(values.filter((_, i) => i !== index));
  }

  function add(): void {
    if (maxItems && values.length >= maxItems) return;
    onChange([...values, '']);
  }

  return (
    <FieldWrapper label={label} hint={hint}>
      <div className="space-y-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              className={cn(inputClass, 'flex-1')}
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`${placeholder ?? 'Line'} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="flex items-center justify-center size-9 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
        {(!maxItems || values.length < maxItems) && (
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <PlusIcon className="size-3.5" />
            Add {placeholder ?? 'item'}
            {maxItems && <span className="text-muted-foreground font-normal">({values.length}/{maxItems})</span>}
          </button>
        )}
      </div>
    </FieldWrapper>
  );
}

// ── Budget allocation card (amber bg, per-platform) ───────────────────────────

function BudgetAllocationCard({ platform, currency, budget, onChange }: {
  platform: string;
  currency: string;
  budget: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  const [isLocked, setIsLocked] = React.useState(false);
  const PLATFORM_LABELS: Record<string, string> = {
    google: 'Google Ads', meta: 'Meta Ads', bing: 'Microsoft Ads'
  };
  const label = PLATFORM_LABELS[platform] ?? platform;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          type="button"
          onClick={() => setIsLocked((l) => !l)}
          className={cn('p-1 rounded transition-colors', isLocked ? 'text-amber-600' : 'text-gray-400 hover:text-gray-600')}
          title={isLocked ? 'Unlock budget' : 'Lock budget'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isLocked
              ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
              : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
            }
          </svg>
        </button>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">{currency}</span>
        <input
          type="number"
          min={0}
          value={budget === 0 ? '' : budget}
          disabled={isLocked}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-border bg-white pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        />
      </div>
    </div>
  );
}

// ── Tags with Include/Exclude toggle ──────────────────────────────────────────

function TagsInputWithToggle({ label, hint, values, onChange, placeholder, mode, onModeChange }: FieldProps & {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  mode?: 'include' | 'exclude';
  onModeChange?: (m: 'include' | 'exclude') => void;
}): React.JSX.Element {
  const [input, setInput] = React.useState('');
  const activeMode = mode ?? 'include';

  function add(): void {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  }

  return (
    <FieldWrapper label={label} hint={hint}>
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        {onModeChange && (
          <div className="flex border-b border-border">
            {(['include', 'exclude'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium transition-colors',
                  activeMode === m
                    ? m === 'include' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    : 'bg-background text-muted-foreground hover:bg-muted/50'
                )}
              >
                {m === 'include' ? '+ Include' : '− Exclude'}
              </button>
            ))}
          </div>
        )}
        <div className="p-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {values.map((tag) => (
              <span
                key={tag}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  activeMode === 'exclude'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {tag}
                <button type="button" onClick={() => onChange(values.filter((v) => v !== tag))} className="hover:opacity-70">
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder ?? 'Type and press Enter'}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            />
            <button
              type="button"
              onClick={add}
              className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </FieldWrapper>
  );
}

// ── Age/gender checkboxes ─────────────────────────────────────────────────────

const AGE_BRACKETS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDER_VALUES = ['Male', 'Female', 'All'];

function AgeGenderPicker({ ageRange, gender, onAgeChange, onGenderChange }: {
  ageRange: string;
  gender: string;
  onAgeChange: (v: string) => void;
  onGenderChange: (v: string) => void;
}): React.JSX.Element {
  const selectedAges = ageRange === 'All' || !ageRange
    ? AGE_BRACKETS
    : ageRange.split(',').map((s) => s.trim()).filter(Boolean);

  function toggleAge(age: string): void {
    const current = selectedAges.includes(age)
      ? selectedAges.filter((a) => a !== age)
      : [...selectedAges, age];
    if (current.length === 0) return;
    if (current.length === AGE_BRACKETS.length) {
      onAgeChange('All');
    } else {
      onAgeChange(current.join(', '));
    }
  }

  return (
    <FieldWrapper label="Age &amp; Gender">
      <div className="rounded-lg border border-border bg-background p-3 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Age ranges</p>
          <div className="flex flex-wrap gap-2">
            {AGE_BRACKETS.map((age) => {
              const checked = selectedAges.includes(age);
              return (
                <label key={age} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAge(age)}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary/20"
                  />
                  <span className="text-xs text-foreground">{age}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Gender</p>
          <div className="flex flex-wrap gap-3">
            {GENDER_VALUES.map((g) => (
              <label key={g} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="gender-picker"
                  checked={gender === g}
                  onChange={() => onGenderChange(g)}
                  className="size-3.5 border-border text-primary focus:ring-primary/20"
                />
                <span className="text-xs text-foreground">{g}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </FieldWrapper>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">{title}</h3>
      {children}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OBJECTIVE_OPTIONS = [
  { value: 'conversions', label: 'Conversions' },
  { value: 'awareness', label: 'Brand Awareness' },
  { value: 'traffic', label: 'Website Traffic' },
  { value: 'leads', label: 'Lead Generation' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'app_install', label: 'App Install' }
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' }
];

const AGE_RANGE_OPTIONS = [
  { value: 'All', label: 'All ages' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '25-44', label: '25–44' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55+', label: '55+' }
];

const GENDER_OPTIONS = [
  { value: 'All', label: 'All genders' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' }
];

const GOOGLE_BID_OPTIONS = [
  { value: 'maximize_conversions', label: 'Maximize conversions' },
  { value: 'target_cpa', label: 'Target CPA' },
  { value: 'target_roas', label: 'Target ROAS' },
  { value: 'maximize_clicks', label: 'Maximize clicks' },
  { value: 'manual_cpc', label: 'Manual CPC' },
  { value: 'enhanced_cpc', label: 'Enhanced CPC' }
];

const META_BID_OPTIONS = [
  { value: 'lowest cost', label: 'Lowest cost' },
  { value: 'cost cap', label: 'Cost cap' },
  { value: 'bid cap', label: 'Bid cap' },
  { value: 'minimum roas', label: 'Minimum ROAS' }
];

const BING_BID_OPTIONS = [
  { value: 'maximize_conversions', label: 'Maximize conversions' },
  { value: 'target_cpa', label: 'Target CPA' },
  { value: 'maximize_clicks', label: 'Maximize clicks' },
  { value: 'manual_cpc', label: 'Manual CPC' },
  { value: 'enhanced_cpc', label: 'Enhanced CPC' }
];

function getBidOptions(platform: string): { value: string; label: string }[] {
  if (platform === 'google') return GOOGLE_BID_OPTIONS;
  if (platform === 'bing') return BING_BID_OPTIONS;
  return META_BID_OPTIONS;
}

const AD_TYPE_LABELS: Record<string, string> = {
  search: 'Search Ads (RSA)',
  rsa: 'Responsive Search Ads',
  display: 'Display Ads',
  feed: 'Feed / Social Ads',
  stories: 'Stories Ads',
  reels: 'Reels Ads',
  pmax: 'Performance Max',
  shopping: 'Shopping Ads'
};

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  bing: 'Microsoft Ads'
};

const MAX_HEADLINES: Record<string, number> = {
  search: 15, rsa: 15, display: 5, feed: 5, stories: 3, reels: 3, pmax: 15, shopping: 3
};

const MAX_DESCRIPTIONS: Record<string, number> = {
  search: 4, rsa: 4, display: 4, feed: 4, stories: 2, reels: 2, pmax: 4, shopping: 2
};

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-7 w-64 rounded bg-muted" />
      <div className="flex gap-2 border-b border-border pb-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 rounded bg-muted" />)}
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-9 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Platform icons (inline) ───────────────────────────────────────────────────

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

function PlatformIconSm({ platform }: { platform: string }): React.JSX.Element {
  if (platform === 'google') return <GoogleIconSm />;
  if (platform === 'meta') return <MetaIconSm />;
  if (platform === 'bing') return <MicrosoftIconSm />;
  return <span className="size-4 rounded-full bg-muted" />;
}

function adTypeEmojiEdit(adType: string): string {
  const map: Record<string, string> = {
    search: '🔍', rsa: '🔍', display: '🖼️', pmax: '🎯', performance_max: '🎯',
    shopping: '🛍️', demand_gen: '✨', feed: '📰', stories: '📱',
    reels: '🎬', video: '▶️',
  };
  return map[adType.toLowerCase()] ?? '📋';
}

// ── Main component ────────────────────────────────────────────────────────────

type Section = 'campaign' | string; // 'campaign' or platform key

export function CampaignEditClient({
  orgSlug,
  orgId,
  campaignId
}: {
  orgSlug: string;
  orgId: string;
  campaignId: string;
}): React.JSX.Element {
  const [draft, setDraft] = React.useState<CampaignEditPayload | null>(null);
  const [ops, setOps] = React.useState<Map<string, EditOperation>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<Section>('campaign');
  const [activeAdTypeIdx, setActiveAdTypeIdx] = React.useState(0);
  const [locationMode, setLocationMode] = React.useState<'include' | 'exclude'>('include');
  const [languageMode, setLanguageMode] = React.useState<'include' | 'exclude'>('include');
  // Keep activeTab for backwards compat with audience sub-section
  const [campaignSubTab, setCampaignSubTab] = React.useState<'settings' | 'audience'>('settings');

  // Load the campaign edit payload on mount
  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/edit?orgId=${orgId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setFetchError(body.error ?? 'Failed to load campaign');
          return;
        }
        const data = await res.json() as CampaignEditPayload;
        setDraft(data);
      } catch {
        setFetchError('Failed to load campaign');
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, orgId]);

  // Record a field change as an EditOperation and update the draft
  function recordOp(path: string, value: unknown): void {
    if (!draft) return;

    // Update local draft immediately for responsive UI
    const nextDraft = JSON.parse(JSON.stringify(draft)) as CampaignEditPayload;

    if (path === 'name') {
      nextDraft.name = String(value);
      nextDraft.mediaPlan.campaignName = String(value);
    } else if (path === 'objective') {
      nextDraft.objective = String(value);
      nextDraft.mediaPlan.objective = String(value);
    } else if (path === 'totalBudget') {
      nextDraft.totalBudget = Number(value);
      nextDraft.mediaPlan.totalBudget = Number(value);
    } else if (path === 'currency') {
      nextDraft.currency = String(value);
      nextDraft.mediaPlan.currency = String(value);
    } else if (path === 'startDate') {
      nextDraft.startDate = String(value);
      nextDraft.mediaPlan.startDate = String(value);
    } else if (path === 'endDate') {
      nextDraft.endDate = String(value);
      nextDraft.mediaPlan.endDate = String(value);
    } else {
      // Deep patch into mediaPlan
      setByPath(nextDraft.mediaPlan as unknown as Record<string, unknown>, path, value);
    }

    setDraft(nextDraft);
    setOps((prev) => {
      const next = new Map(prev);
      next.set(path, { op: 'set', path, value });
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (!draft || ops.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/edit?orgId=${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: Array.from(ops.values()), orgId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        toast.error(body.error ?? 'Failed to save campaign');
        return;
      }
      toast.success('Campaign saved');
      setOps(new Map()); // clear dirty state
      // Navigate back to campaign detail
      window.location.href = `/organizations/${orgSlug}/campaigns/${campaignId}?source=accelerate`;
    } catch {
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(): void {
    window.location.href = `/organizations/${orgSlug}/campaigns/${campaignId}?source=accelerate`;
  }

  if (loading) return <LoadingSkeleton />;

  if (fetchError || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 p-6">
        <AlertCircleIcon className="size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">{fetchError ?? 'Campaign not found'}</p>
        <a
          href={`/organizations/${orgSlug}/campaigns`}
          className="text-xs text-primary hover:underline"
        >
          Back to campaigns
        </a>
      </div>
    );
  }

  const mp = draft.mediaPlan;
  const platforms = mp.platforms ?? [];
  const isDirty = ops.size > 0;

  const activePlatformData = activeSection === 'campaign'
    ? null
    : platforms.find((p) => p.platform === activeSection) ?? null;
  const activePlatformIdx = activePlatformData ? platforms.indexOf(activePlatformData) : -1;
  const activeAdType = activePlatformData?.adTypes[activeAdTypeIdx] ?? null;
  const activeAdTypeRealIdx = activeAdTypeIdx < (activePlatformData?.adTypes.length ?? 0) ? activeAdTypeIdx : 0;

  return (
    <div className="flex flex-col bg-white" style={{ minHeight: '100dvh' }}>
      {/* Compact header — campaign name only */}
      <div className="shrink-0 px-6 py-3 border-b border-[#e5e7eb] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center justify-center size-7 rounded-md text-[#6a7282] hover:bg-gray-100 hover:text-[#364153] transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <p className="text-sm font-semibold text-[#101828] truncate flex-1">{draft.name}</p>
        {isDirty && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-amber-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unsaved
          </span>
        )}
      </div>

      {/* Platform pills (amber) — primary navigation */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-[#e5e7eb] bg-white overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* Campaign (general) pill */}
          <button
            type="button"
            onClick={() => setActiveSection('campaign')}
            className={cn(
              'flex items-center gap-1.5 h-9 rounded-[50px] border px-[13px] pr-3 text-sm font-medium transition-all shrink-0',
              activeSection === 'campaign'
                ? 'bg-[#fef3c7] border-[#1677ff] text-[#1677ff]'
                : 'bg-white border-[#e5e7eb] text-[#364153] hover:bg-gray-50 hover:border-[#9ca3af]'
            )}
          >
            ⚙️ Campaign
          </button>
          {/* Per-platform pills */}
          {platforms.map((p) => (
            <button
              key={p.platform}
              type="button"
              onClick={() => { setActiveSection(p.platform); setActiveAdTypeIdx(0); }}
              className={cn(
                'flex items-center gap-1.5 h-9 rounded-[50px] border pl-[13px] pr-3 text-sm font-medium transition-all shrink-0',
                activeSection === p.platform
                  ? 'bg-[#fef3c7] border-[#1677ff] text-[#1677ff]'
                  : 'bg-white border-[#e5e7eb] text-[#364153] hover:bg-gray-50 hover:border-[#9ca3af]'
              )}
            >
              <PlatformIconSm platform={p.platform} />
              {PLATFORM_LABELS[p.platform] ?? p.platform}
            </button>
          ))}
        </div>
      </div>

      {/* Ad type pills (blue) — only when on a platform */}
      {activePlatformData && (
        <div className="shrink-0 px-6 py-2 border-b border-[#e5e7eb] bg-white overflow-x-auto">
          <div className="flex items-center gap-2">
            {activePlatformData.adTypes.map((at, i) => (
              <button
                key={at.adType}
                type="button"
                onClick={() => setActiveAdTypeIdx(i)}
                className={cn(
                  'flex items-center gap-1.5 h-8 rounded-2xl border pl-[11px] pr-3 text-xs font-medium transition-all shrink-0',
                  i === activeAdTypeRealIdx
                    ? 'bg-[#eff6ff] border-[#1677ff] text-[#1677ff]'
                    : 'bg-white border-[#e5e7eb] text-[#4a5565] hover:bg-gray-50 hover:border-[#9ca3af]'
                )}
              >
                <span className="text-base leading-none">{adTypeEmojiEdit(at.adType)}</span>
                {AD_TYPE_LABELS[at.adType] ?? at.adType}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* ── Campaign section: Settings + Audience ── */}
        {activeSection === 'campaign' && (
          <>
            {/* Sub-tab bar */}
            <div className="flex border-b border-[#e5e7eb] -mt-2">
              {(['settings', 'audience'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCampaignSubTab(t)}
                  className={cn(
                    'relative mr-8 pb-2 text-sm font-medium transition-colors',
                    campaignSubTab === t ? 'text-[#1677ff]' : 'text-[#4a5565] hover:text-[#364153]'
                  )}
                >
                  {t === 'settings' ? 'Campaign Settings' : 'Audience'}
                  {campaignSubTab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1677ff]" />
                  )}
                </button>
              ))}
            </div>

            {/* Settings sub-tab */}
            {campaignSubTab === 'settings' && (
              <>
                <Section title="Campaign Details">
                  <TextField
                    label="Campaign name"
                    value={draft.name}
                    onChange={(v) => recordOp('name', v)}
                    placeholder="Enter campaign name"
                  />
                  <SelectField
                    label="Objective"
                    value={draft.objective}
                    options={OBJECTIVE_OPTIONS}
                    onChange={(v) => recordOp('objective', v)}
                  />
                </Section>

                <Section title="Budget Allocation">
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label="Total budget"
                      value={draft.totalBudget}
                      onChange={(v) => recordOp('totalBudget', v)}
                      min={1}
                      prefix={draft.currency}
                      hint="Total spend across all platforms"
                    />
                    <SelectField
                      label="Currency"
                      value={draft.currency}
                      options={CURRENCY_OPTIONS}
                      onChange={(v) => recordOp('currency', v)}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    Daily budget: <span className="font-semibold text-foreground">{draft.currency} {mp.dailyBudget?.toLocaleString() ?? '—'}</span>
                    {' '}over <span className="font-semibold text-foreground">{mp.duration ?? '—'} days</span>
                  </div>
                  <div className="space-y-3">
                    {platforms.map((platformData, pIdx) => (
                      <BudgetAllocationCard
                        key={platformData.platform}
                        platform={platformData.platform}
                        currency={draft.currency}
                        budget={platformData.budget}
                        onChange={(v) => recordOp(`platforms[${pIdx}].budget`, v)}
                      />
                    ))}
                  </div>
                </Section>

                <Section title="Schedule">
                  <div className="grid grid-cols-2 gap-4">
                    <DateField
                      label="Start date"
                      value={draft.startDate}
                      onChange={(v) => recordOp('startDate', v)}
                    />
                    <DateField
                      label="End date"
                      value={draft.endDate}
                      onChange={(v) => recordOp('endDate', v)}
                    />
                  </div>
                </Section>

                {mp.executiveSummary && (
                  <Section title="Campaign Summary">
                    <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                      {mp.executiveSummary}
                    </div>
                  </Section>
                )}
              </>
            )}

            {/* Audience sub-tab */}
            {campaignSubTab === 'audience' && (
              <>
                <Section title="Location Targeting">
                  <TagsInputWithToggle
                    label="Target locations"
                    values={mp.targetAudience.locations ?? []}
                    onChange={(v) => recordOp('targetAudience.locations', v)}
                    placeholder="Country or city (e.g. IN, Mumbai)"
                    hint="Enter country codes or city names"
                    mode={locationMode}
                    onModeChange={setLocationMode}
                  />
                </Section>

                <Section title="Demographics">
                  <AgeGenderPicker
                    ageRange={mp.targetAudience.ageRange ?? 'All'}
                    gender={mp.targetAudience.gender ?? 'All'}
                    onAgeChange={(v) => recordOp('targetAudience.ageRange', v)}
                    onGenderChange={(v) => recordOp('targetAudience.gender', v)}
                  />
                </Section>

                <Section title="Interests &amp; Languages">
                  <TagsInput
                    label="Interests"
                    values={mp.targetAudience.interests ?? []}
                    onChange={(v) => recordOp('targetAudience.interests', v)}
                    placeholder="e.g. fashion, fitness"
                  />
                  <TagsInputWithToggle
                    label="Languages"
                    values={mp.targetAudience.languages ?? []}
                    onChange={(v) => recordOp('targetAudience.languages', v)}
                    placeholder="e.g. English, Hindi"
                    mode={languageMode}
                    onModeChange={setLanguageMode}
                  />
                </Section>
              </>
            )}
          </>
        )}

        {/* ── Platform section: budget + selected ad type ── */}
        {activePlatformData && activePlatformIdx >= 0 && activeAdType && (() => {
          const pIdx = activePlatformIdx;
          const atIdx = activeAdTypeRealIdx;
          const adTypeData = activeAdType;
          const bidOptions = getBidOptions(activePlatformData.platform);
          const adTypeLabelStr = AD_TYPE_LABELS[adTypeData.adType] ?? adTypeData.adType;
          const isSearch = ['search', 'rsa'].includes(adTypeData.adType);
          const maxHeadlines = MAX_HEADLINES[adTypeData.adType] ?? 5;
          const maxDescriptions = MAX_DESCRIPTIONS[adTypeData.adType] ?? 4;

          return (
            <>
              <Section title="Platform Budget">
                <div className="grid grid-cols-2 gap-4">
                  <NumberField
                    label="Platform budget"
                    value={activePlatformData.budget}
                    onChange={(v) => recordOp(`platforms[${pIdx}].budget`, v)}
                    min={0}
                    prefix={draft.currency}
                  />
                  <NumberField
                    label="Allocation %"
                    value={activePlatformData.budgetPercent}
                    onChange={(v) => recordOp(`platforms[${pIdx}].budgetPercent`, v)}
                    min={0}
                    max={100}
                    prefix="%"
                    hint="% of total campaign budget"
                  />
                </div>
              </Section>

              <Section title={adTypeLabelStr}>
                <SelectField
                  label="Bid strategy"
                  value={adTypeData.targeting?.bidStrategy ?? ''}
                  options={bidOptions}
                  onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].targeting.bidStrategy`, v)}
                />

                {isSearch && (
                  <TagsInput
                    label="Keywords"
                    values={adTypeData.targeting?.keywords ?? []}
                    onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].targeting.keywords`, v)}
                    placeholder="e.g. buy shoes online"
                    hint="Add keywords separated by Enter"
                  />
                )}

                {adTypeData.ads?.map((ad, adIdx) => (
                  <div key={ad.id ?? adIdx} className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ad {adIdx + 1}
                    </p>

                    <MultiInput
                      label="Headlines"
                      values={ad.headlines ?? []}
                      onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].ads[${adIdx}].headlines`, v)}
                      placeholder="Headline"
                      maxItems={maxHeadlines}
                      hint={isSearch ? `Up to ${maxHeadlines} headlines for RSA rotation` : undefined}
                    />

                    <MultiInput
                      label="Descriptions"
                      values={ad.descriptions ?? []}
                      onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].ads[${adIdx}].descriptions`, v)}
                      placeholder="Description"
                      maxItems={maxDescriptions}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="CTA text"
                        value={ad.ctaText ?? ''}
                        onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].ads[${adIdx}].ctaText`, v)}
                        placeholder="Shop Now"
                      />
                      <URLField
                        label="Destination URL"
                        value={ad.destinationUrl ?? ''}
                        onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].ads[${adIdx}].destinationUrl`, v)}
                      />
                    </div>

                    {!isSearch && (
                      <TagsInput
                        label="Image URLs"
                        values={ad.imageUrls ?? []}
                        onChange={(v) => recordOp(`platforms[${pIdx}].adTypes[${atIdx}].ads[${adIdx}].imageUrls`, v)}
                        placeholder="https://..."
                        hint="Paste image URLs (one per Enter)"
                      />
                    )}
                  </div>
                ))}
              </Section>
            </>
          );
        })()}

      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#4a5565] hover:text-[#101828] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Campaign
          </button>
          {isDirty && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {saving ? 'Saving...' : isDirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  );
}
