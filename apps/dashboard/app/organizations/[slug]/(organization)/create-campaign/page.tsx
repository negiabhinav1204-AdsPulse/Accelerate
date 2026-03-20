import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { CreateCampaignHome } from '~/components/campaign/create-campaign-home';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Create Campaign') };

export default async function CreateCampaignPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  const connectedAccounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: ctx.organization.id, status: 'connected' },
    select: { id: true, platform: true, accountName: true, currency: true }
  });

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Create Campaign</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody disableScroll>
        <CreateCampaignHome
          orgSlug={ctx.organization.slug}
          organizationId={ctx.organization.id}
          connectedAccounts={connectedAccounts.map((a) => ({ ...a, currency: a.currency ?? undefined }))}
        />
      </PageBody>
    </Page>
  );
}
