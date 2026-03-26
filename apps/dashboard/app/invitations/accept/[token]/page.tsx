import * as React from 'react';
import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createSearchParamsCache, parseAsString } from 'nuqs/server';
import { validate as uuidValidate } from 'uuid';

import { InvitationStatus } from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { routes } from '@workspace/routes';

import { InvitationSignupCard } from '~/components/invitations/invitation-signup-card';
import { createTitle } from '~/lib/formatters';

const paramsCache = createSearchParamsCache({
  token: parseAsString.withDefault('')
});

export const metadata: Metadata = {
  title: createTitle('Create account')
};

export default async function InvitationAcceptPage({
  params
}: NextPageProps): Promise<React.JSX.Element> {
  const { token } = await paramsCache.parse(params);
  if (!token || !uuidValidate(token)) {
    return notFound();
  }

  const invitation = await prisma.invitation.findFirst({
    where: { token },
    select: {
      email: true,
      status: true,
      organization: {
        select: { name: true }
      }
    }
  });
  if (!invitation) {
    return notFound();
  }
  if (invitation.status === InvitationStatus.ACCEPTED) {
    return redirect(routes.dashboard.invitations.AlreadyAccepted);
  }
  if (invitation.status === InvitationStatus.REVOKED) {
    return redirect(routes.dashboard.invitations.Revoked);
  }

  // If an account already exists for this email, send back to sign-in flow
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email.toLowerCase() },
    select: { id: true }
  });
  if (existingUser) {
    return redirect(`${routes.dashboard.invitations.Request}/${token}`);
  }

  return (
    <InvitationSignupCard
      token={token}
      organizationName={invitation.organization.name}
      email={invitation.email}
    />
  );
}
