import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { LeadsClient } from '~/components/leads/leads-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Lead Forms') };

export default async function LeadsPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Lead Forms</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <LeadsClient orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
