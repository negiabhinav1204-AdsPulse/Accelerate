import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { KeywordPlannerClient } from '~/components/utilities/keyword-planner-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Keyword Planner') };

export default async function KeywordPlannerPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Keyword Planner</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <KeywordPlannerClient orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
