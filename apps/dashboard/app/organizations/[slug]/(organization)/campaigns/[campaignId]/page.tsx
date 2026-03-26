import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody } from '@workspace/ui/components/page';

import { CampaignDetailClient } from '~/components/campaigns/campaign-detail-client';
import { getOrganizationDetails } from '~/data/organization/get-organization-details';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Campaign Detail') };

export default async function CampaignDetailPage(props: {
  params: Promise<{ slug: string; campaignId: string }>;
  searchParams: Promise<{ source?: string; platform?: string; orgId?: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug, campaignId } = await props.params;
  const sp = await props.searchParams;
  const source = sp.source ?? 'external';
  const platform = sp.platform ?? 'meta';
  const orgDetails = await getOrganizationDetails();

  return (
    <Page>
      <PageBody>
        <CampaignDetailClient
          orgSlug={slug}
          orgId={ctx.organization.id}
          campaignId={campaignId}
          source={source}
          platform={platform}
          orgCurrency={orgDetails.currency}
        />
      </PageBody>
    </Page>
  );
}
