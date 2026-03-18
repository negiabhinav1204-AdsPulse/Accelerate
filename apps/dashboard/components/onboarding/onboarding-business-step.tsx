'use client';

import * as React from 'react';
import { BuildingIcon, MailIcon, MapPinIcon, TagIcon } from 'lucide-react';
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
import type { CompleteOnboardingSchema } from '~/schemas/onboarding/complete-onboarding-schema';

const LOCATIONS = [
  'Mumbai, India',
  'Delhi, India',
  'Bengaluru, India',
  'Hyderabad, India',
  'Chennai, India',
  'Pune, India',
  'Kolkata, India',
  'Ahmedabad, India',
  'Jaipur, India',
  'Surat, India',
  'New York, USA',
  'San Francisco, USA',
  'London, UK',
  'Singapore',
  'Dubai, UAE',
  'Sydney, Australia',
  'Toronto, Canada',
  'Berlin, Germany',
  'Paris, France',
  'Tokyo, Japan'
];

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

// Mock data from Brand Agent
const MOCK_AGENT_DATA = {
  businessName: 'Acme Corp',
  contactEmail: '',
  location: 'Mumbai, India',
  category: 'Technology / SaaS'
};

export function OnboardingBusinessStep({
  metadata,
  canNext,
  loading,
  isLastStep,
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  const methods = useFormContext<CompleteOnboardingSchema>();
  const [saved, setSaved] = React.useState(false);

  // Pre-fill with mock agent data on mount
  React.useEffect(() => {
    const current = methods.getValues('businessStep');
    if (!current?.businessName) {
      methods.setValue('businessStep', {
        businessName: MOCK_AGENT_DATA.businessName,
        contactEmail:
          metadata?.user?.email ?? MOCK_AGENT_DATA.contactEmail,
        location: MOCK_AGENT_DATA.location,
        category: MOCK_AGENT_DATA.category
      });
    }
  }, [methods, metadata]);

  const handleSave = () => {
    setSaved(true);
  };

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
          confirm.
        </p>
      </div>

      {/* Org card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo placeholder */}
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <BuildingIcon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">New Business</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  ✏ Auto-filled
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Review and edit your details below
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={handleSave}
          >
            {saved ? '✓ Saved' : 'Save'}
          </Button>
        </div>

        <div className="space-y-4">
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
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 z-10" />
                    <select
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">Select location...</option>
                      {LOCATIONS.map((loc) => (
                        <option
                          key={loc}
                          value={loc}
                        >
                          {loc}
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
                        <option
                          key={cat}
                          value={cat}
                        >
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

      {/* Add another business */}
      <button
        type="button"
        className="text-sm text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        onClick={() => {
          /* future: add more businesses */
        }}
      >
        + Add another business
      </button>

      {/* CTA */}
      <Button
        type="button"
        className="w-full"
        disabled={!saved || loading}
        loading={loading}
        onClick={handleNext}
      >
        Looks good? Let&apos;s connect your ad accounts →
      </Button>
    </div>
  );
}
