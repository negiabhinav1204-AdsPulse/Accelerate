'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import {
  ChevronDownIcon,
  GlobeIcon,
  ImageIcon,
  LockIcon,
  MinimizeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RocketIcon,
  RotateCcwIcon,
  SparklesIcon,
  Undo2Icon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import type { AdCreative, AdTypePlan, MediaPlan, PlatformPlan } from './types';

// ── Platform icons (same as preview panel) ────────────────────────────────────

function GoogleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-4', className)}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MetaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-4', className)}>
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
    case 'google': return 'Google';
    case 'meta': return 'Meta';
    case 'bing': return 'Microsoft';
    default: return platform;
  }
}

function adTypeLabel(adType: string): string {
  const map: Record<string, string> = {
    search: 'Search', display: 'Display', pmax: 'P Max',
    performance_max: 'P Max', shopping: 'Shopping',
    demand_gen: 'Demand Gen', feed: 'Feed', stories: 'Stories',
    reels: 'Reels', video: 'Video'
  };
  return map[adType.toLowerCase()] ?? adType;
}

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDER_OPTIONS = ['All genders', 'Women', 'Men', 'Non-binary'];

// ── Form types ────────────────────────────────────────────────────────────────

type BudgetAllocationMode = 'balanced' | 'performance' | 'equal';

type PlatformBudgetRow = {
  platform: string;
  budget: number;
  locked: boolean;
};

type EditFormValues = {
  campaignName: string;
  budgetMode: BudgetAllocationMode;
  platformBudgets: PlatformBudgetRow[];
  startDate: string;
  endDate: string;
  ageRanges: string[];
  gender: string;
  negativeAgeGender: boolean;
  locations: string[];
  negativeLocations: boolean;
  languages: string[];
};

// ── Props ─────────────────────────────────────────────────────────────────────

type CampaignEditPanelProps = {
  mediaPlan: MediaPlan;
  onSave: (updated: MediaPlan) => void;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignEditPanel({
  mediaPlan,
  onSave,
  onClose
}: CampaignEditPanelProps): React.JSX.Element {
  const [selectedPlatformIdx, setSelectedPlatformIdx] = React.useState(0);
  const [selectedAdTypeIdx, setSelectedAdTypeIdx] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'targeting' | 'creatives'>('targeting');
  const [negativeTargetingOpen, setNegativeTargetingOpen] = React.useState(false);
  const [locationInput, setLocationInput] = React.useState('');
  const [languageInput, setLanguageInput] = React.useState('');

  const selectedPlatform: PlatformPlan | undefined = mediaPlan.platforms[selectedPlatformIdx];
  const selectedAdType: AdTypePlan | undefined = selectedPlatform?.adTypes[selectedAdTypeIdx];

  const totalCreatives = selectedPlatform?.adTypes.reduce(
    (sum, at) => sum + at.ads.length, 0
  ) ?? 0;

  const { register, handleSubmit, watch, setValue, control, reset } = useForm<EditFormValues>({
    defaultValues: {
      campaignName: mediaPlan.campaignName,
      budgetMode: 'balanced',
      platformBudgets: mediaPlan.platforms.map((p) => ({
        platform: p.platform,
        budget: p.budget,
        locked: false
      })),
      startDate: mediaPlan.startDate,
      endDate: mediaPlan.endDate,
      ageRanges: [mediaPlan.targetAudience.ageRange],
      gender: mediaPlan.targetAudience.gender,
      negativeAgeGender: false,
      locations: [...mediaPlan.targetAudience.locations],
      negativeLocations: false,
      languages: [...mediaPlan.targetAudience.languages]
    }
  });

  const { fields: platformBudgets } = useFieldArray({
    control,
    name: 'platformBudgets'
  });

  const watchedBudgets = watch('platformBudgets');
  const totalBudget = watchedBudgets.reduce((sum, b) => sum + (Number(b.budget) || 0), 0);
  const totalAllocatedPercent = mediaPlan.totalBudget > 0
    ? Math.round((totalBudget / mediaPlan.totalBudget) * 100)
    : 100;

  const watchLocations = watch('locations');
  const watchLanguages = watch('languages');
  const watchGender = watch('gender');
  const watchAgeRanges = watch('ageRanges');
  const watchBudgetMode = watch('budgetMode');

  const onSubmit = (values: EditFormValues) => {
    const updated: MediaPlan = {
      ...mediaPlan,
      campaignName: values.campaignName,
      startDate: values.startDate,
      endDate: values.endDate,
      targetAudience: {
        ...mediaPlan.targetAudience,
        locations: values.locations,
        ageRange: values.ageRanges.join(', '),
        gender: values.gender,
        languages: values.languages
      },
      platforms: mediaPlan.platforms.map((p, i) => ({
        ...p,
        budget: values.platformBudgets[i]?.budget ?? p.budget
      }))
    };
    onSave(updated);
  };

  const handleAddLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    const current = watchLocations ?? [];
    if (!current.includes(trimmed)) {
      setValue('locations', [...current, trimmed]);
    }
    setLocationInput('');
  };

  const handleRemoveLocation = (loc: string) => {
    setValue('locations', (watchLocations ?? []).filter((l) => l !== loc));
  };

  const handleAddLanguage = () => {
    const trimmed = languageInput.trim();
    if (!trimmed) return;
    const current = watchLanguages ?? [];
    if (!current.includes(trimmed)) {
      setValue('languages', [...current, trimmed]);
    }
    setLanguageInput('');
  };

  const handleRemoveLanguage = (lang: string) => {
    setValue('languages', (watchLanguages ?? []).filter((l) => l !== lang));
  };

  const toggleAgeRange = (range: string) => {
    const current = watchAgeRanges ?? [];
    if (current.includes(range)) {
      setValue('ageRanges', current.filter((r) => r !== range));
    } else {
      setValue('ageRanges', [...current, range]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Campaign Preview — Editing</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <MinimizeIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="shrink-0 px-4 pt-3 pb-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {mediaPlan.platforms.map((p, i) => (
            <button
              key={p.platform}
              type="button"
              onClick={() => {
                setSelectedPlatformIdx(i);
                setSelectedAdTypeIdx(0);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors shrink-0',
                i === selectedPlatformIdx
                  ? 'border-primary text-foreground bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {p.platform === 'google' && <GoogleIcon />}
              {p.platform === 'meta' && <MetaIcon />}
              {p.platform === 'bing' && <MicrosoftIcon />}
              {platformLabel(p.platform)}
            </button>
          ))}
        </div>
        <div className="h-px bg-border" />
      </div>

      {/* Ad type chips */}
      {selectedPlatform && (
        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 overflow-x-auto border-b border-border">
          {selectedPlatform.adTypes.map((at, i) => (
            <button
              key={at.adType}
              type="button"
              onClick={() => setSelectedAdTypeIdx(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors shrink-0',
                i === selectedAdTypeIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {adTypeLabel(at.adType)}
            </button>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('targeting')}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'targeting'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          Targeting
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('creatives')}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'creatives'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          Creatives ({totalCreatives})
        </button>
      </div>

      {/* Form content */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'targeting' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Campaign Name */}
              <FormSection title="Campaign Name">
                <input
                  {...register('campaignName', { required: true })}
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="Enter campaign name"
                />
              </FormSection>

              {/* Budget Allocation */}
              <FormSection title="Budget Allocation">
                {/* Mode tabs */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit mb-4">
                  {(['balanced', 'performance', 'equal'] as BudgetAllocationMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setValue('budgetMode', mode)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                        watchBudgetMode === mode
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {mode === 'performance' ? '↑ Performance' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Platform rows */}
                <div className="space-y-2">
                  {platformBudgets.map((field, i) => (
                    <div key={field.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        {field.platform === 'google' && <GoogleIcon />}
                        {field.platform === 'meta' && <MetaIcon />}
                        {field.platform === 'bing' && <MicrosoftIcon />}
                        <span className="text-xs font-medium text-foreground">
                          {platformLabel(field.platform)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <LockIcon className="size-3.5" />
                      </button>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                          {...register(`platformBudgets.${i}.budget`, { valueAsNumber: true })}
                          type="number"
                          min={0}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                        {mediaPlan.totalBudget > 0
                          ? `${Math.round(((watchedBudgets[i]?.budget ?? 0) / mediaPlan.totalBudget) * 100)}% of total`
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 mt-2">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                    Total Allocation
                  </span>
                  <span className="text-xs font-bold text-green-700 dark:text-green-400">
                    {totalAllocatedPercent}%
                  </span>
                </div>
              </FormSection>

              {/* Dates */}
              <FormSection title="Schedule">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      Start Date
                      <span className="text-[10px] text-destructive font-semibold uppercase tracking-wide">
                        Required
                      </span>
                    </label>
                    <input
                      {...register('startDate', { required: true })}
                      type="date"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      End Date
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Optional
                      </span>
                    </label>
                    <input
                      {...register('endDate')}
                      type="date"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </FormSection>

              {/* Age & Gender */}
              <FormSection
                title="Age & Gender"
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enable negative targeting</span>
                    <Controller
                      control={control}
                      name="negativeAgeGender"
                      render={({ field }) => (
                        <Toggle checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                }
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Age Range</p>
                    <div className="flex flex-wrap gap-2">
                      {AGE_RANGES.map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => toggleAgeRange(range)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            (watchAgeRanges ?? []).includes(range)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          )}
                        >
                          {(watchAgeRanges ?? []).includes(range) && (
                            <span className="size-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Gender</p>
                    <div className="flex flex-wrap gap-2">
                      {GENDER_OPTIONS.map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => setValue('gender', gender)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            watchGender === gender
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          )}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </FormSection>

              {/* Location Targets */}
              <FormSection
                title="Location Targets"
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enable negative targeting</span>
                    <Controller
                      control={control}
                      name="negativeLocations"
                      render={({ field }) => (
                        <Toggle checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                }
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {(watchLocations ?? []).map((loc) => (
                      <span
                        key={loc}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {loc}
                        <button
                          type="button"
                          onClick={() => handleRemoveLocation(loc)}
                          className="ml-0.5 hover:text-primary/70 transition-colors"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLocation();
                        }
                      }}
                      placeholder="Add location..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLocation}
                      className="shrink-0"
                    >
                      <PlusIcon className="size-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </FormSection>

              {/* Languages */}
              <FormSection title="Languages">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {(watchLanguages ?? []).map((lang) => (
                      <span
                        key={lang}
                        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => handleRemoveLanguage(lang)}
                          className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLanguage();
                        }
                      }}
                      placeholder="Add language..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLanguage}
                      className="shrink-0"
                    >
                      <PlusIcon className="size-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </FormSection>

              {/* About Negative Targeting collapsible */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNegativeTargetingOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                >
                  About Negative Targeting
                  <ChevronDownIcon
                    className={cn(
                      'size-4 text-muted-foreground transition-transform',
                      negativeTargetingOpen && 'rotate-180'
                    )}
                  />
                </button>
                {negativeTargetingOpen && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Negative targeting allows you to exclude certain audiences, locations, or demographics from seeing your ads. This helps you avoid spending budget on users who are unlikely to convert, improving your overall campaign efficiency.
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li className="text-xs text-muted-foreground">• <strong>Negative locations</strong> — exclude specific cities, regions, or countries</li>
                      <li className="text-xs text-muted-foreground">• <strong>Negative age/gender</strong> — exclude demographic segments</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'creatives' && selectedAdType && (
            <div className="max-w-2xl mx-auto space-y-4">
              {selectedAdType.ads.map((ad) => (
                <EditableCreativeCard key={ad.id} ad={ad} />
              ))}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <PlusIcon className="size-4" />
                Upload new creative
              </button>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex items-center gap-2 justify-between px-4 py-3 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {/* undo */}}
            >
              <Undo2Icon className="size-3.5" />
              Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => reset()}
            >
              <RotateCcwIcon className="size-3.5" />
              Reset
            </Button>
          </div>
          <Button type="submit" size="sm" className="gap-1.5 text-xs">
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Form Section ──────────────────────────────────────────────────────────────

function FormSection({
  title,
  right,
  children
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {title}
        </h3>
        {right && <div>{right}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ── Editable Creative Card ────────────────────────────────────────────────────

function EditableCreativeCard({ ad }: { ad: AdCreative }): React.JSX.Element {
  const headline = ad.headlines[0] ?? 'No headline';
  const description = ad.descriptions[0] ?? 'No description';
  const imageUrl = ad.imageUrls[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="relative h-32 bg-muted group cursor-pointer hover:bg-muted/80 transition-colors">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={headline} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white text-xs font-medium bg-black/60 rounded-full px-3 py-1.5">
            Click to upload image
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <input
          type="text"
          defaultValue={headline}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="Headline"
        />
        <textarea
          defaultValue={description}
          rows={2}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="Description"
        />
        <div className="flex gap-2">
          <input
            type="text"
            defaultValue={ad.ctaText}
            className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="CTA text"
          />
          <input
            type="url"
            defaultValue={ad.destinationUrl}
            className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="Destination URL"
          />
        </div>
      </div>
    </div>
  );
}
