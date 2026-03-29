import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { ExperimentLiveClient } from '~/components/experiments/experiment-live-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Experiment Live') };

export default async function ExperimentLivePage(props: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { id } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Experiment Live</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <ExperimentLiveClient orgId={ctx.organization.id} experimentId={id} />
      </PageBody>
    </Page>
  );
}
