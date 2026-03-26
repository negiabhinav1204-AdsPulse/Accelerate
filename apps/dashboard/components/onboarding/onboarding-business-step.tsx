'use client';

import * as React from 'react';
import { BuildingIcon, DollarSignIcon, GlobeIcon, MailIcon, MapPinIcon, TagIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@workspace/ui/components/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@workspace/ui/components/form';
import { InputWithAdornments } from '@workspace/ui/components/input-with-adornments';

import type { OnboardingStepProps } from '~/components/onboarding/onboarding-step-props';
import { COUNTRIES, CURRENCIES } from '~/lib/constants/org-options';
import type { CompleteOnboardingSchema } from '~/schemas/onboarding/complete-onboarding-schema';

const CATEGORIES = [
  'E-Commerce / Retail',
  'Technology / SaaS',
  'Finance / Fintech',
  'Healthcare / Pharma',
  'Education / EdTech',
  'Travel / Hospitality',
  'Food & Beverage',
  'Media / Entertainment',
  'Real Estate',
  'Automotive',
  'Fashion / Apparel',
  'Consumer Goods / FMCG'
];

export function OnboardingBusinessStep({
  metadata,
  canNext,
  loading,
  isLastStep,
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  const methods = useFormContext<CompleteOnboardingSchema>();

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Step 1 of 2
        </p>
        <h2 className="text-2xl font-semibold text-foreground">
          Tell us about your business
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ve auto-prefilled some details from your website. Review and
          confirm before continuing.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <BuildingIcon className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Your Organisation</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                ✦ Auto-filled
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              All fields are editable except your Business URL
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Business URL — read-only */}
          {metadata?.user?.businessUrl && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Business URL
              </label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                <GlobeIcon className="size-4 shrink-0" />
                <span className="truncate">{metadata.user.businessUrl}</span>
                <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  Locked
                </span>
              </div>
            </div>
          )}

          <FormField
            control={methods.control}
            name="businessStep.businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <InputWithAdornments
                    type="text"
                    maxLength={255}
                    disabled={loading}
                    startAdornment={
                      <BuildingIcon className="size-4 shrink-0" />
                    }
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={methods.control}
            name="businessStep.contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <InputWithAdornments
                    type="email"
                    maxLength={255}
                    disabled={loading}
                    startAdornment={<MailIcon className="size-4 shrink-0" />}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={methods.control}
            name="businessStep.location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 z-10" />
                    <select
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">Select country...</option>
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={methods.control}
            name="businessStep.currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Currency</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 z-10" />
                    <select
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">Select currency...</option>
                      {CURRENCIES.map(({ code, name }) => (
                        <option key={code} value={code}>
                          {code} — {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={methods.control}
            name="businessStep.category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <div className="relative">
                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 z-10" />
                    <select
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">Select category...</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!canNext || loading}
        loading={loading}
        onClick={handleNext}
      >
        Looks good? Let&apos;s connect your ad accounts →
      </Button>
    </div>
  );
}
