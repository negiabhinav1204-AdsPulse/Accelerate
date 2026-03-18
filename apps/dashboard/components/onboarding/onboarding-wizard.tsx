'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { type SubmitHandler } from 'react-hook-form';

import { routes } from '@workspace/routes';
import { FormProvider } from '@workspace/ui/components/form';
import { toast } from '@workspace/ui/components/sonner';
import { useTheme, type Theme } from '@workspace/ui/hooks/use-theme';
import { cn } from '@workspace/ui/lib/utils';

import { completeOnboarding } from '~/actions/onboarding/complete-onboarding';
import { OnboardingBrandAgentStep } from '~/components/onboarding/onboarding-brand-agent-step';
import { OnboardingBusinessStep } from '~/components/onboarding/onboarding-business-step';
import { OnboardingConnectorsStep } from '~/components/onboarding/onboarding-connectors-step';
import { OnboardingInviteTeamStep } from '~/components/onboarding/onboarding-invite-team-step';
import { OnboardingOrganizationStep } from '~/components/onboarding/onboarding-organization-step';
import { OnboardingPendingInvitationsStep } from '~/components/onboarding/onboarding-pending-invitations-step';
import { OnboardingProfileStep } from '~/components/onboarding/onboarding-profile-step';
import type { OnboardingMetadata } from '~/components/onboarding/onboarding-step-props';
import { OnboardingThemeStep } from '~/components/onboarding/onboarding-theme-step';
import { useZodForm } from '~/hooks/use-zod-form';
import { FileUploadAction } from '~/lib/file-upload';
import {
  businessOnboardingSchema,
  completeOnboardingSchema,
  connectorsOnboardingSchema,
  inviteTeamOnboardingSchema,
  OnboardingStep,
  organizationOnboardingSchema,
  pendingInvitationsOnboardingSchema,
  profileOnboardingSchema,
  themeOnboardingSchema,
  type CompleteOnboardingSchema
} from '~/schemas/onboarding/complete-onboarding-schema';

const components = {
  [OnboardingStep.Profile]: OnboardingProfileStep,
  [OnboardingStep.Theme]: OnboardingThemeStep,
  [OnboardingStep.Organization]: OnboardingOrganizationStep,
  [OnboardingStep.InviteTeam]: OnboardingInviteTeamStep,
  [OnboardingStep.PendingInvitations]: OnboardingPendingInvitationsStep,
  // Accelerate custom steps
  [OnboardingStep.BrandAgentLoading]: OnboardingBrandAgentStep,
  [OnboardingStep.Business]: OnboardingBusinessStep,
  [OnboardingStep.Connectors]: OnboardingConnectorsStep
} as const;

function validateStep(
  step: OnboardingStep,
  values: CompleteOnboardingSchema
): boolean {
  switch (step) {
    case OnboardingStep.Profile:
      return profileOnboardingSchema.safeParse(values.profileStep).success;
    case OnboardingStep.Theme:
      return themeOnboardingSchema.safeParse(values.themeStep).success;
    case OnboardingStep.Organization:
      return organizationOnboardingSchema.safeParse(values.organizationStep)
        .success;
    case OnboardingStep.InviteTeam:
      return inviteTeamOnboardingSchema.safeParse(values.inviteTeamStep)
        .success;
    case OnboardingStep.PendingInvitations:
      return pendingInvitationsOnboardingSchema.safeParse(
        values.pendingInvitationsStep
      ).success;
    // Accelerate steps — always valid (auto-advance or skippable)
    case OnboardingStep.BrandAgentLoading:
      return true;
    case OnboardingStep.Business:
      return businessOnboardingSchema.safeParse(values.businessStep).success;
    case OnboardingStep.Connectors:
      return connectorsOnboardingSchema.safeParse(values.connectorsStep)
        .success;
  }
}

function handleScrollToTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo(0, 0);
  }
}

export type OnboardingWizardProps =
  React.HtmlHTMLAttributes<HTMLFormElement> & {
    activeSteps: OnboardingStep[];
    metadata: OnboardingMetadata;
  };

export function OnboardingWizard({
  activeSteps,
  metadata,
  className,
  ...other
}: OnboardingWizardProps): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>(
    activeSteps[0]
  );
  const methods = useZodForm({
    schema: completeOnboardingSchema,
    mode: 'all',
    defaultValues: {
      activeSteps,
      profileStep: activeSteps.includes(OnboardingStep.Profile)
        ? {
            action: FileUploadAction.None,
            image: metadata?.user?.image ?? undefined,
            name: metadata?.user?.name ?? 'Unknown',
            phone: metadata?.user?.phone ?? '',
            email: metadata?.user?.email ?? ''
          }
        : undefined,
      themeStep: activeSteps.includes(OnboardingStep.Theme)
        ? {
            theme: (theme as Theme) ?? 'system'
          }
        : undefined,
      organizationStep: activeSteps.includes(OnboardingStep.Organization)
        ? {
            logo: metadata?.organization?.logo ?? undefined,
            name: metadata?.organization?.name ?? '',
            slug: metadata?.organization?.slug ?? '',
            addExampleData: true
          }
        : undefined,
      inviteTeamStep: activeSteps.includes(OnboardingStep.InviteTeam)
        ? {
            invitations: [
              { email: '', role: 'marketer' },
              { email: '', role: 'marketer' },
              { email: '', role: 'marketer' }
            ]
          }
        : undefined,
      pendingInvitationsStep: activeSteps.includes(
        OnboardingStep.PendingInvitations
      )
        ? {
            invitationIds:
              metadata?.invitations?.map((invitation) => invitation.id) ?? []
          }
        : undefined,
      // Accelerate custom steps (pre-filled with mock Brand Agent data)
      businessStep: activeSteps.includes(OnboardingStep.Business)
        ? {
            businessName: 'Acme Corp',
            contactEmail: metadata?.user?.email ?? '',
            location: 'Mumbai, India',
            category: 'Technology / SaaS'
          }
        : undefined,
      connectorsStep: activeSteps.includes(OnboardingStep.Connectors)
        ? {
            connectedPlatforms: []
          }
        : undefined
    }
  });
  const Component = components[currentStep];
  const currentStepIndex = activeSteps.indexOf(currentStep);
  const isLastStep = currentStepIndex === activeSteps.length - 1;
  const formValues = methods.getValues();
  const isCurrentStepValid = validateStep(currentStep, formValues);
  const canSubmit =
    !methods.formState.isSubmitting && methods.formState.isValid;
  const onSubmit: SubmitHandler<CompleteOnboardingSchema> = async (values) => {
    if (!canSubmit || !isCurrentStepValid || !isLastStep) {
      return;
    }

    const result = await completeOnboarding(values);
    if (!result?.serverError && !result?.validationErrors) {
      toast.success('Completed and ready to go!');
      router.push(
        result?.data?.redirect ?? routes.dashboard.organizations.Index
      );
    } else {
      toast.error("Couldn't complete request");
    }
  };
  const handleNext = async (): Promise<void> => {
    if (!isCurrentStepValid) {
      return;
    }
    if (isLastStep) {
      methods.handleSubmit(onSubmit)();
      return;
    }
    setCurrentStep(activeSteps[currentStepIndex + 1]);
    handleScrollToTop();
  };

  // For BrandAgentLoading step, render full-screen (no wrapper)
  if (currentStep === OnboardingStep.BrandAgentLoading) {
    return (
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <OnboardingBrandAgentStep
            metadata={metadata}
            canNext={true}
            loading={methods.formState.isSubmitting}
            isLastStep={isLastStep}
            handleNext={handleNext}
          />
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn(
          'mx-auto w-full min-w-80 max-w-lg space-y-4 p-4 pt-24',
          className
        )}
        {...other}
      >
        <Component
          metadata={metadata}
          canNext={isCurrentStepValid && !methods.formState.isSubmitting}
          loading={methods.formState.isSubmitting}
          isLastStep={isLastStep}
          handleNext={handleNext}
        />
      </form>
    </FormProvider>
  );
}
