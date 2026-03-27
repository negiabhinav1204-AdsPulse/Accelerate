import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { MediaPlannerClient } from '~/components/media-planner/media-planner-client';
import { getOrganizationDetails } from '~/data/organization/get-organization-details';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Media Planner') };

export default async function MediaPlannerPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;
  const orgDetails = await getOrganizationDetails();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Media Planner</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6 h-full">
          <MediaPlannerClient
            orgSlug={slug}
            orgCurrency={orgDetails.currency ?? 'USD'}
          />
        </div>
      </PageBody>
    </Page>
  );
}
