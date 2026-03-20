'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2Icon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import type { OnboardingStepProps } from '~/components/onboarding/onboarding-step-props';
import type { CompleteOnboardingSchema } from '~/schemas/onboarding/complete-onboarding-schema';

type Platform = {
  id: string;
  name: string;
  description: string;
};

const PLATFORMS: Platform[] = [
  { id: 'google', name: 'Google', description: 'Google Ads' },
  { id: 'meta', name: 'Meta', description: 'Facebook & Instagram Ads' },
  { id: 'bing', name: 'Microsoft', description: 'Microsoft Advertising' },
  { id: 'shopify', name: 'Shopify', description: 'Shopify Store' }
];

export function OnboardingConnectorsStep({
  loading,
  isLastStep,
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  const methods = useFormContext<CompleteOnboardingSchema>();
  const searchParams = useSearchParams();

  const [connectedPlatforms, setConnectedPlatforms] = React.useState<
    string[]
  >(() => methods.getValues('connectorsStep.connectedPlatforms') ?? []);

  // Pick up ?connected=platform from OAuth callback redirects
  React.useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected && !connectedPlatforms.includes(connected)) {
      setConnectedPlatforms((prev) => {
        const updated = [...prev, connected];
        methods.setValue('connectorsStep.connectedPlatforms', updated);
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = (platformId: string) => {
    if (platformId === 'shopify') {
      return;
    }
    // Save current form state so the wizard can restore it after the OAuth round-trip
    try {
      const currentValues = methods.getValues();
      sessionStorage.setItem(
        'onboarding_oauth_draft',
        JSON.stringify({
          businessStep: currentValues.businessStep,
          connectedPlatforms: connectedPlatforms
        })
      );
    } catch {
      // sessionStorage not available — state will be lost, which is acceptable
    }
    window.location.href = `/api/connectors/${platformId}/authorize?return=/onboarding`;
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Step 2 of 2
        </p>
        <h2 className="text-2xl font-semibold text-foreground">
          Almost there
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect your advertising platforms to get started. You can always
          connect more later.
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        {/* Business Profile always checked */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
          <CheckCircle2Icon className="size-5 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Business Profile
            </p>
            <p className="text-xs text-muted-foreground">
              Your business details are set up
            </p>
          </div>
          <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-full px-2 py-0.5">
            Done
          </span>
        </div>

        {/* Platform connectors */}
        {PLATFORMS.map((platform) => {
          const isConnected = connectedPlatforms.includes(platform.id);
          const isShopify = platform.id === 'shopify';
          return (
            <div
              key={platform.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border px-5 py-4 transition-all',
                isConnected
                  ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                  : 'border-border bg-card'
              )}
            >
              {isConnected ? (
                <CheckCircle2Icon className="size-5 text-green-500 shrink-0" />
              ) : (
                <div className="size-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {platform.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {platform.description}
                </p>
              </div>
              {isConnected ? (
                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-full px-2 py-0.5">
                  ✓ Connected
                </span>
              ) : isShopify ? (
                <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={loading}
                  onClick={() => handleConnect(platform.id)}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <Button
        type="button"
        className="w-full"
        loading={loading}
        onClick={handleNext}
      >
        {isLastStep
          ? 'Start Creating with Accelera AI →'
          : 'Continue →'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You can connect more platforms later from your settings.
      </p>
    </div>
  );
}
