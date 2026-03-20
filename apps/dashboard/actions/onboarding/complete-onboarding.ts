'use server';

import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { v4 } from 'uuid';

import {
  checkIfCanInvite,
  createInvitation,
  sendInvitationRequest
} from '@workspace/auth/invitations';
import { symmetricDecrypt } from '@workspace/auth/encryption';
import { BillingProvider } from '@workspace/billing/provider';
import { adjustSeats } from '@workspace/billing/seats';
import { decodeBase64Image, resizeImage } from '@workspace/common/image';
import type { Maybe } from '@workspace/common/maybe';
import {
  DayOfWeek,
  InvitationStatus,
  Role,
  type Prisma
} from '@workspace/database';
// Role enum updated for Accelerate: ADMIN, MARKETER, ANALYST, FINANCE, DEVELOPER
import { prisma } from '@workspace/database/client';
import {
  getOrganizationLogoUrl,
  getUserImageUrl,
  replaceOrgSlug,
  routes
} from '@workspace/routes';

import { addExampleData } from '~/actions/onboarding/_add-example';
import { authActionClient } from '~/actions/safe-action';
import { Caching, OrganizationCacheKey, UserCacheKey } from '~/data/caching';
import { FileUploadAction } from '~/lib/file-upload';
import { getTimeSlot } from '~/lib/formatters';
import {
  completeOnboardingSchema,
  OnboardingStep,
  type CompleteOnboardingSchema
} from '~/schemas/onboarding/complete-onboarding-schema';

type Transaction = Prisma.PrismaPromise<unknown>;

export const completeOnboarding = authActionClient
  .metadata({ actionName: 'completeOnboarding' })
  .inputSchema(completeOnboardingSchema)
  .action(async ({ parsedInput, ctx }) => {
    const transactions: Transaction[] = [];
    const organizationId = v4();
    const userId = ctx.session.user.id;
    const userEmail = ctx.session.user.email.toLowerCase();

    // Handle profile step
    if (parsedInput.activeSteps.includes(OnboardingStep.Profile)) {
      await handleProfileStep(parsedInput.profileStep, userId, transactions);
    }

    // Handle theme step
    // No action required for theme step

    // Handle organization step
    if (parsedInput.activeSteps.includes(OnboardingStep.Organization)) {
      await handleOrganizationStep(
        parsedInput.organizationStep,
        organizationId,
        userEmail,
        userId,
        transactions
      );
    }

    // Handle pending invitations step
    if (parsedInput.activeSteps.includes(OnboardingStep.PendingInvitations)) {
      await handlePendingInvitationsStep(
        parsedInput.pendingInvitationsStep,
        userId,
        userEmail,
        transactions
      );
    }

    // Handle Accelerate Business step (creates org from business details)
    if (parsedInput.activeSteps.includes(OnboardingStep.Business)) {
      await handleAccelerateBusinessStep(
        parsedInput.businessStep,
        organizationId,
        userEmail,
        userId,
        transactions
      );
    }

    if (transactions.length) {
      await prisma.$transaction(transactions);
    }

    // Persist any OAuth connector tokens collected during onboarding
    await saveConnectorTokens(organizationId);

    revalidateTag(Caching.createUserTag(UserCacheKey.PersonalDetails, userId));
    revalidateTag(Caching.createUserTag(UserCacheKey.Preferences, userId));
    revalidateTag(Caching.createUserTag(UserCacheKey.Organizations, userId));

    // Ideally we would execute these in a background job
    if (
      parsedInput.activeSteps.includes(OnboardingStep.Organization) &&
      parsedInput.organizationStep
    ) {
      // Handle invite team step
      if (parsedInput.activeSteps.includes(OnboardingStep.InviteTeam)) {
        await handleInviteTeamStep(
          parsedInput.inviteTeamStep,
          organizationId,
          parsedInput.organizationStep.name,
          ctx.session.user.name,
          ctx.session.user.email
        );
      }

      // Handle add example data
      if (parsedInput.organizationStep?.addExampleData) {
        try {
          await addExampleData(organizationId, ctx.session.user.id);
        } catch (e) {
          console.error(e);
        }
      }
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: ctx.session.user.id },
      select: { organization: { select: { id: true, slug: true } } }
    });

    for (const membership of memberships) {
      try {
        await adjustSeats(membership.organization.id);
      } catch (e) {
        console.error(e);
      }

      revalidateTag(
        Caching.createOrganizationTag(
          OrganizationCacheKey.Members,
          membership.organization.id
        )
      );
      revalidateTag(
        Caching.createOrganizationTag(
          OrganizationCacheKey.Invitations,
          membership.organization.id
        )
      );
    }

    let redirect: string = routes.dashboard.organizations.Index;

    // Accelerate Business step: redirect to Accelera AI page
    if (parsedInput.activeSteps.includes(OnboardingStep.Business)) {
      const updatedMemberships = await prisma.membership.findMany({
        where: { userId: ctx.session.user.id },
        select: { organization: { select: { id: true, slug: true } } }
      });
      if (updatedMemberships.length === 1) {
        redirect = replaceOrgSlug(
          routes.dashboard.organizations.slug.AcceleraAi,
          updatedMemberships[0].organization.slug
        );
      }
    }
    // Newly created organization
    else if (
      parsedInput.activeSteps.includes(OnboardingStep.Organization) &&
      parsedInput.organizationStep?.slug
    ) {
      redirect = replaceOrgSlug(
        routes.dashboard.organizations.slug.AcceleraAi,
        parsedInput.organizationStep.slug
      );
    }
    // Has only one organization
    else if (memberships.length === 1) {
      redirect = replaceOrgSlug(
        routes.dashboard.organizations.slug.AcceleraAi,
        memberships[0].organization.slug
      );
    }

    return { redirect };
  });

async function handleProfileStep(
  step: CompleteOnboardingSchema['profileStep'],
  userId: string,
  transactions: Transaction[]
) {
  if (!step) {
    return;
  }

  let imageUrl: Maybe<string> = undefined;
  if (step.action === FileUploadAction.Update && step.image) {
    const { buffer, mimeType } = decodeBase64Image(step.image);
    const data = await resizeImage(buffer, mimeType);
    const hash = createHash('sha256').update(data).digest('hex');

    transactions.push(
      prisma.userImage.deleteMany({ where: { userId } }),
      prisma.userImage.create({
        data: { userId, data, contentType: mimeType, hash }
      })
    );

    imageUrl = getUserImageUrl(userId, hash);
  }
  if (step.action === FileUploadAction.Delete) {
    transactions.push(prisma.userImage.deleteMany({ where: { userId } }));
    imageUrl = null;
  }

  // Update user profile
  transactions.push(
    prisma.user.update({
      where: { id: userId },
      data: {
        image: imageUrl,
        name: step.name,
        phone: step.phone,
        completedOnboarding: true
      }
    })
  );
}

async function handleOrganizationStep(
  step: CompleteOnboardingSchema['organizationStep'],
  organizationId: string,
  userEmail: string,
  userId: string,
  transactions: Transaction[]
) {
  if (!step) {
    return;
  }

  let logoUrl: Maybe<string> = undefined;
  if (step.logo) {
    const { buffer, mimeType } = decodeBase64Image(step.logo);
    const data = await resizeImage(buffer, mimeType);
    const hash = createHash('sha256').update(data).digest('hex');
    transactions.push(
      prisma.organizationLogo.create({
        data: {
          organizationId,
          data,
          contentType: mimeType,
          hash
        },
        select: {
          id: true // SELECT NONE
        }
      })
    );

    logoUrl = getOrganizationLogoUrl(organizationId, hash);
  }

  let billingCustomerId: string | undefined = undefined;
  try {
    billingCustomerId = await BillingProvider.createCustomer({
      organizationId: organizationId,
      name: step.name,
      email: userEmail
    });
  } catch (e) {
    console.error(e);
  }

  transactions.push(
    prisma.organization.create({
      data: {
        id: organizationId,
        logo: logoUrl,
        name: step.name,
        slug: step.slug,
        businessHours: createDefaultBusinessHours(),
        billingCustomerId,
        billingEmail: billingCustomerId ? userEmail : undefined,
        memberships: {
          create: {
            userId,
            role: Role.ADMIN,
            isOwner: true
          }
        }
      }
    })
  );
}

async function handlePendingInvitationsStep(
  step: CompleteOnboardingSchema['pendingInvitationsStep'],
  userId: string,
  userEmail: string,
  transactions: Transaction[]
): Promise<void> {
  if (!step || !step.invitationIds) {
    return;
  }

  for (const invitationId of step.invitationIds) {
    const pendingInvitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        email: userEmail,
        status: InvitationStatus.PENDING
      },
      select: {
        organizationId: true,
        role: true
      }
    });
    if (!pendingInvitation) {
      continue;
    }

    transactions.push(
      prisma.membership.create({
        data: {
          userId,
          organizationId: pendingInvitation.organizationId,
          role: pendingInvitation.role
        }
      }),
      prisma.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.ACCEPTED }
      })
    );
  }
}

async function handleInviteTeamStep(
  step: CompleteOnboardingSchema['inviteTeamStep'],
  organizationId: string,
  organizationName: string,
  userName: string,
  userEmail: string
): Promise<void> {
  if (!step || !step.invitations) {
    return;
  }

  for (const invitation of step.invitations) {
    if (!invitation.email) {
      continue;
    }

    const canInvite = await checkIfCanInvite(invitation.email, organizationId);
    if (!canInvite) {
      continue;
    }

    try {
      const newInvitation = await createInvitation(
        invitation.email,
        invitation.role as Role,
        organizationId
      );
      await sendInvitationRequest({
        email: newInvitation.email,
        organizationName,
        invitedByEmail: userEmail,
        invitedByName: userName,
        token: newInvitation.token,
        invitationId: newInvitation.id,
        organizationId
      });
    } catch (e) {
      console.error(e);
    }
  }
}

async function handleAccelerateBusinessStep(
  step: CompleteOnboardingSchema['businessStep'],
  organizationId: string,
  userEmail: string,
  userId: string,
  transactions: Transaction[]
) {
  if (!step) {
    return;
  }

  const businessName = step.businessName || 'My Business';
  // Derive slug from business name
  const rawSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const slug = `${rawSlug}-${organizationId.slice(0, 6)}`;

  let billingCustomerId: string | undefined = undefined;
  try {
    billingCustomerId = await BillingProvider.createCustomer({
      organizationId: organizationId,
      name: businessName,
      email: userEmail
    });
  } catch (e) {
    console.error(e);
  }

  transactions.push(
    prisma.organization.create({
      data: {
        id: organizationId,
        name: businessName,
        slug,
        contactEmail: step.contactEmail || userEmail,
        location: step.location,
        category: step.category,
        businessHours: createDefaultBusinessHours(),
        billingCustomerId,
        billingEmail: billingCustomerId ? userEmail : undefined,
        memberships: {
          create: {
            userId,
            role: Role.ADMIN,
            isOwner: true
          }
        }
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { completedOnboarding: true }
    })
  );
}

const CONNECTOR_PLATFORMS = ['google', 'meta', 'bing'] as const;

async function saveConnectorTokens(organizationId: string): Promise<void> {
  const cookieStore = await cookies();
  const authSecret = process.env.AUTH_SECRET!;

  for (const platform of CONNECTOR_PLATFORMS) {
    const cookieName = `pending_connector_${platform}`;
    const encrypted = cookieStore.get(cookieName)?.value;
    if (!encrypted) continue;

    try {
      const data = JSON.parse(symmetricDecrypt(encrypted, authSecret)) as {
        platform: string;
        accessToken: string;
        refreshToken: string | null;
        accounts: { id: string; name: string }[];
      };

      const existing = await prisma.connectedAdAccount.findFirst({
        where: { organizationId, platform: data.platform.toUpperCase() },
        select: { id: true }
      });

      const primary = data.accounts[0] ?? {
        id: 'pending',
        name: 'Pending account selection'
      };
      const accountData = {
        platform: data.platform.toUpperCase(),
        accountId: primary.id,
        accountName: primary.name,
        isDefault: data.accounts.length > 0,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? undefined,
        status: data.accounts.length > 0 ? 'connected' : 'pending_account_selection'
      };

      if (existing) {
        await prisma.connectedAdAccount.update({
          where: { id: existing.id },
          data: accountData
        });
      } else {
        await prisma.connectedAdAccount.create({
          data: { organizationId, ...accountData }
        });
      }
    } catch (e) {
      console.error(`[connectors] Failed to save ${platform} connector:`, e);
    }
  }
}

function createDefaultBusinessHours() {
  const timeSlot = { start: getTimeSlot(9, 0), end: getTimeSlot(17, 0) };
  return {
    create: [
      { dayOfWeek: DayOfWeek.SUNDAY },
      { dayOfWeek: DayOfWeek.MONDAY, timeSlots: { create: timeSlot } },
      { dayOfWeek: DayOfWeek.TUESDAY, timeSlots: { create: timeSlot } },
      { dayOfWeek: DayOfWeek.WEDNESDAY, timeSlots: { create: timeSlot } },
      { dayOfWeek: DayOfWeek.THURSDAY, timeSlots: { create: timeSlot } },
      { dayOfWeek: DayOfWeek.FRIDAY, timeSlots: { create: timeSlot } },
      { dayOfWeek: DayOfWeek.SATURDAY }
    ]
  };
}
