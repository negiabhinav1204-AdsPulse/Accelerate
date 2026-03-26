import * as React from 'react';
import { type Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { AcceleraAiHome } from '~/components/accelera-ai/accelera-ai-home';
import { getOrganizationDetails } from '~/data/organization/get-organization-details';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Accelera AI')
};

export default async function AcceleraAiPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  const [userDetails, connectedAccounts, orgDetails] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { firstName: true, name: true }
    }),
    prisma.connectedAdAccount.findMany({
      where: { organizationId: ctx.organization.id, status: 'connected' },
      select: { id: true, platform: true, accountName: true }
    }),
    getOrganizationDetails()
  ]);

  const firstName =
    userDetails?.firstName ||
    userDetails?.name?.split(' ')[0] ||
    'there';

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              Accelera AI
            </h1>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody disableScroll>
        <AcceleraAiHome
          firstName={firstName}
          organizationId={ctx.organization.id}
          orgSlug={ctx.organization.slug}
          connectedAccounts={connectedAccounts}
          orgCurrency={orgDetails.currency}
        />
      </PageBody>
    </Page>
  );
}
