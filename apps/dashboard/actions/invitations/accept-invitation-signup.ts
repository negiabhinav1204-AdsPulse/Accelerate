'use server';

import { revalidateTag } from 'next/cache';

import { signIn } from '@workspace/auth';
import { hashPassword } from '@workspace/auth/password';
import { adjustSeats } from '@workspace/billing/seats';
import { NotFoundError, PreConditionError } from '@workspace/common/errors';
import { InvitationStatus } from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { replaceOrgSlug, routes } from '@workspace/routes';

import { actionClient } from '~/actions/safe-action';
import { Caching, OrganizationCacheKey, UserCacheKey } from '~/data/caching';
import { acceptInvitationSignupSchema } from '~/schemas/invitations/accept-invitation-signup-schema';

export const acceptInvitationSignup = actionClient
  .metadata({ actionName: 'acceptInvitationSignup' })
  .inputSchema(acceptInvitationSignupSchema)
  .action(async ({ parsedInput }) => {
    const invitation = await prisma.invitation.findFirst({
      where: { token: parsedInput.token },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        organizationId: true,
        organization: {
          select: { slug: true }
        }
      }
    });
    if (!invitation) {
      throw new NotFoundError('Invitation not found.');
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new PreConditionError('This invitation has been revoked.');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new PreConditionError('This invitation has already been accepted.');
    }

    const normalizedEmail = invitation.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });
    if (existingUser) {
      throw new PreConditionError(
        'An account already exists for this email. Please sign in to accept the invitation.'
      );
    }

    const hashedPassword = await hashPassword(parsedInput.password);
    const fullName = `${parsedInput.firstName} ${parsedInput.lastName}`.trim();
    const now = new Date();

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: parsedInput.firstName,
          lastName: parsedInput.lastName,
          password: hashedPassword,
          emailVerified: now,
          completedOnboarding: true,
          isFirstLogin: false,
          locale: 'en-US'
        },
        select: { id: true }
      });
      await tx.membership.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role
        },
        select: { id: true }
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
        select: { id: true }
      });
      return user;
    });

    try {
      await adjustSeats(invitation.organizationId);
    } catch (e) {
      console.error(e);
    }

    revalidateTag(
      Caching.createOrganizationTag(
        OrganizationCacheKey.Members,
        invitation.organizationId
      )
    );
    revalidateTag(
      Caching.createOrganizationTag(
        OrganizationCacheKey.Invitations,
        invitation.organizationId
      )
    );
    revalidateTag(
      Caching.createUserTag(UserCacheKey.Organizations, newUser.id)
    );

    await signIn('credentials', {
      email: normalizedEmail,
      password: parsedInput.password,
      redirectTo: replaceOrgSlug(
        routes.dashboard.organizations.slug.AcceleraAi,
        invitation.organization.slug
      )
    });
  });
