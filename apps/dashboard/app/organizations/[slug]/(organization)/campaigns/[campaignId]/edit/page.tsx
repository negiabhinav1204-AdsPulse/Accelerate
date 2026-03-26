import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody } from '@workspace/ui/components/page';

import { CampaignEditClient } from '~/components/campaigns/campaign-edit-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Edit Campaign') };

export default async function CampaignEditPage(props: {
  params: Promise<{ slug: string; campaignId: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug, campaignId } = await props.params;

  return (
    <Page>
      <PageBody>
        <CampaignEditClient
          orgSlug={slug}
          orgId={ctx.organization.id}
          campaignId={campaignId}
        />
      </PageBody>
    </Page>
  );
}
