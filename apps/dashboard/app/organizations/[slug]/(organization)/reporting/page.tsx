import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { ReportingClient } from '~/components/reporting/reporting-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Reporting') };

export default async function ReportingPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Reporting</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <ReportingClient orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
