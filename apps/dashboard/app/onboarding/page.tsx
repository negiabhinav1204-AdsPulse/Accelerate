import * as React from 'react';
import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getAuthContext } from '@workspace/auth/context';
import { InvitationStatus } from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { routes } from '@workspace/routes';

import { OnboardingWizard } from '~/components/onboarding/onboarding-wizard';
import { createTitle } from '~/lib/formatters';
import { OnboardingStep } from '~/schemas/onboarding/complete-onboarding-schema';

export const metadata: Metadata = {
  title: createTitle('Onboarding')
};

export default async function OnboardingFullPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthContext();
  if (ctx.session.user.completedOnboarding) {
    return redirect(routes.dashboard.organizations.Index);
  }

  // Check for pending invitations
  const pendingInvitationCount = await prisma.invitation.count({
    where: {
      email: ctx.session.user.email,
      status: InvitationStatus.PENDING
    }
  });

  if (
    ctx.session.user.memberships.length > 0 ||
    pendingInvitationCount > 0
  ) {
    return redirect(routes.dashboard.onboarding.User);
  }

  // Accelerate custom onboarding flow:
  // 1. Brand Agent Loading (auto-advances after 3s)
  // 2. Business details (org setup)
  // 3. Ad account connectors
  return (
    <div className="relative min-h-screen bg-background">
      <OnboardingWizard
        activeSteps={[
          OnboardingStep.BrandAgentLoading,
          OnboardingStep.Business,
          OnboardingStep.Connectors
        ]}
        metadata={{ user: ctx.session.user }}
      />
    </div>
  );
}
