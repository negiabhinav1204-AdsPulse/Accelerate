'use client';

import * as React from 'react';
import { CheckCircle2Icon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import { AdAccountModal } from '~/components/onboarding/ad-account-modal';
import type { OnboardingStepProps } from '~/components/onboarding/onboarding-step-props';
import type { CompleteOnboardingSchema } from '~/schemas/onboarding/complete-onboarding-schema';

type Platform = {
  id: string;
  name: string;
  description: string;
  defaultConnected?: boolean;
};

const PLATFORMS: Platform[] = [
  {
    id: 'GOOGLE',
    name: 'Google',
    description: 'Google Ads',
    defaultConnected: true
  },
  { id: 'META', name: 'Meta', description: 'Facebook & Instagram Ads' },
  { id: 'MICROSOFT', name: 'Microsoft', description: 'Microsoft Advertising' },
  { id: 'SHOPIFY', name: 'Shopify', description: 'Shopify Store' }
];

export function OnboardingConnectorsStep({
  loading,
  isLastStep,
  handleNext
}: OnboardingStepProps): React.JSX.Element {
  const methods = useFormContext<CompleteOnboardingSchema>();

  const [connectedPlatforms, setConnectedPlatforms] = React.useState<string[]>(
    ['GOOGLE'] // Google is mock-connected by default
  );
  const [modalPlatform, setModalPlatform] = React.useState<string | null>(null);

  const handleConnect = (platformId: string) => {
    setModalPlatform(platformId);
  };

  const handleModalConfirm = (account: {
    id: string;
    name: string;
    accountId: string;
  }) => {
    if (modalPlatform) {
      setConnectedPlatforms((prev) => [...prev, modalPlatform]);
      methods.setValue('connectorsStep.connectedPlatforms', [
        ...connectedPlatforms,
        modalPlatform
      ]);
    }
    setModalPlatform(null);
  };

  const handleModalClose = () => {
    setModalPlatform(null);
  };

  return (
    <>
      {modalPlatform && (
        <AdAccountModal
          platform={
            PLATFORMS.find((p) => p.id === modalPlatform)?.name ?? modalPlatform
          }
          onConfirm={handleModalConfirm}
          onClose={handleModalClose}
        />
      )}

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
          Start Creating with Accelra →
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          You can connect more platforms later from your settings.
        </p>
      </div>
    </>
  );
}
