import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { MerchantCenterClient } from '~/components/feeds/merchant-center-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Google Merchant Center') };

export default async function MerchantCenterPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Google Merchant Center</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <MerchantCenterClient orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
