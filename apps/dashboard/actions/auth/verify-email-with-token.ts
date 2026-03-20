'use server';

import { redirect } from 'next/navigation';
import { addHours, isAfter } from 'date-fns';

import { PASSWORD_RESET_EXPIRY_HOURS } from '@workspace/auth/constants';
import { verifyEmail } from '@workspace/auth/verification';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';
import { routes } from '@workspace/routes';

import { actionClient } from '~/actions/safe-action';
import { verifyEmailWithTokenSchema } from '~/schemas/auth/verify-email-with-token-schema';

export const verifyEmailWithToken = actionClient
  .metadata({ actionName: 'verifyEmailWithToken' })
  .inputSchema(verifyEmailWithTokenSchema)
  .action(async ({ parsedInput }) => {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { token: parsedInput.token },
      select: { identifier: true, expires: true }
    });
    if (!verificationToken) {
      throw new NotFoundError('Verificaton token not found.');
    }
    const user = await prisma.user.findFirst({
      where: { email: verificationToken.identifier },
      select: {
        name: true,
        email: true,
        emailVerified: true
      }
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (isAfter(new Date(), verificationToken.expires)) {
      return redirect(
        `${routes.dashboard.auth.verifyEmail.Expired}?email=${verificationToken.identifier}`
      );
    }

    if (!user.emailVerified) {
      await verifyEmail(verificationToken.identifier);
    }

    const expiry = addHours(new Date(), PASSWORD_RESET_EXPIRY_HOURS);
    const passwordRequest = await prisma.resetPasswordRequest.create({
      data: {
        email: user.email!,
        expires: expiry
      }
    });

    return redirect(
      `${routes.dashboard.auth.resetPassword.Request}/${passwordRequest.id}`
    );
  });
