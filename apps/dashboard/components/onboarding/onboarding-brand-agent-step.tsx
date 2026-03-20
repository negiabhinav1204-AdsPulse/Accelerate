'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';

import { analyzeBrandUrl } from '~/actions/brand/analyze-brand-url';
import type { OnboardingStepProps } from '~/components/onboarding/onboarding-step-props';
import type { CompleteOnboardingSchema } from '~/schemas/onboarding/complete-onboarding-schema';

const MESSAGES = [
  'Scanning your website…',
  'Identifying your brand…',
  'Extracting business details…',
  'Almost ready…'
];

export function OnboardingBrandAgentStep({
  metadata,
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  const methods = useFormContext<CompleteOnboardingSchema>();
  const [messageIndex, setMessageIndex] = React.useState(0);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    // Cycle through status messages
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 1200);

    // Run brand analysis
    const run = async () => {
      const url = metadata?.user?.businessUrl;
      if (url) {
        try {
          const result = await analyzeBrandUrl(url);
          methods.setValue('businessStep.businessName', result.businessName);
          methods.setValue('businessStep.location', result.location);
          methods.setValue('businessStep.category', result.category);
          methods.setValue(
            'businessStep.contactEmail',
            metadata?.user?.email ?? ''
          );
        } catch {
          // Silent fail — user can fill manually
        }
      }
      setDone(true);
    };

    run();

    return () => clearInterval(interval);
  }, [metadata, methods, handleNext]);

  React.useEffect(() => {
    if (done) {
      handleNext();
    }
  }, [done, handleNext]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
            inmobi
          </span>
          <span className="text-3xl font-bold text-primary">accelerate</span>
        </div>

        {/* Spinner */}
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>

        {/* Cycling message */}
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">
            {MESSAGES[messageIndex]}
          </p>
          <p className="text-sm text-muted-foreground">
            Our Brand Analysis Agent is reading your website.
          </p>
        </div>
      </div>
    </div>
  );
}
