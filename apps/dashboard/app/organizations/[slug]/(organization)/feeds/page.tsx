import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { FeedsClient } from '~/components/feeds/feeds-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Commerce Feeds') };

export default async function FeedsPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Commerce Feeds</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <FeedsClient orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
