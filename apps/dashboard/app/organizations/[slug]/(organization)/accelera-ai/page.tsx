import * as React from 'react';
import { type Metadata } from 'next';
import { unstable_cache } from 'next/cache';

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
    unstable_cache(
      () => prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { firstName: true, name: true }
      }),
      ['accelera-ai-user', ctx.session.user.id],
      { revalidate: 3600, tags: [`user-info:${ctx.session.user.id}`] }
    )(),
    unstable_cache(
      () => prisma.connectedAdAccount.findMany({
        where: { organizationId: ctx.organization.id, status: 'connected' },
        select: { id: true, platform: true, accountName: true }
      }),
      ['accelera-ai-accounts', ctx.organization.id],
      { revalidate: 300, tags: [`org-connected-accounts:${ctx.organization.id}`] }
    )(),
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
