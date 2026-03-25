import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody } from '@workspace/ui/components/page';

import { CampaignListClient } from '~/components/campaigns/campaigns-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Campaigns')
};

export default async function CampaignsPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageBody>
        <CampaignListClient orgSlug={slug} orgId={ctx.organization.id} />
      </PageBody>
    </Page>
  );
}
