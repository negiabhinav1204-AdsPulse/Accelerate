import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { CommerceConnectorsClient } from '~/components/commerce/commerce-connectors-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Commerce Connectors') };

export default async function CommerceConnectorsPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Commerce Connectors</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6">
          <CommerceConnectorsClient orgId={ctx.organization.id} orgSlug={slug} />
        </div>
      </PageBody>
    </Page>
  );
}
