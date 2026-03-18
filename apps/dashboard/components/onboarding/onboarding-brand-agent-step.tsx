'use client';

import * as React from 'react';

import type { OnboardingStepProps } from '~/components/onboarding/onboarding-step-props';

export function OnboardingBrandAgentStep({
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleNext();
    }, 3000);
    return () => clearTimeout(timer);
  }, [handleNext]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        {/* Logo area */}
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

        {/* Message */}
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">
            We&apos;re analysing your website to prefill your business
            details&hellip;
          </p>
          <p className="text-sm text-muted-foreground">
            This will only take a moment.
          </p>
        </div>
      </div>
    </div>
  );
}
