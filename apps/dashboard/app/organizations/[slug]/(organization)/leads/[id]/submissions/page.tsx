import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { SubmissionsClient } from '~/components/leads/submissions-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Lead Submissions') };

export default async function SubmissionsPage(props: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug, id } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Lead Submissions</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <SubmissionsClient orgId={ctx.organization.id} orgSlug={slug} formId={id} />
      </PageBody>
    </Page>
  );
}
