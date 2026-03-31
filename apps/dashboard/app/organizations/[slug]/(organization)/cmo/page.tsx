import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { CmoClient } from '~/components/cmo/cmo-client';
import { getOrganizationDetails } from '~/data/organization/get-organization-details';
import { createTitle } from '~/lib/formatters';
import { Skeleton } from '@workspace/ui/components/skeleton';

export const metadata: Metadata = { title: createTitle('AI CMO') };

export default async function CmoPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  await getAuthOrganizationContext();
  await props.params;
  const orgDetails = await getOrganizationDetails();

  const { params } = props;
  const { slug } = await params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">AI CMO</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6">
          <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
            <CmoClient orgCurrency={orgDetails.currency ?? 'USD'} orgSlug={slug} />
          </React.Suspense>
        </div>
      </PageBody>
    </Page>
  );
}
