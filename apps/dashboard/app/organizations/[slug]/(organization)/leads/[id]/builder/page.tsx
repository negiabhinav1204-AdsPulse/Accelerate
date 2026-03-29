import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { FormBuilderClient } from '~/components/leads/form-builder-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Form Builder') };

export default async function FormBuilderPage(props: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug, id } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Form Builder</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <FormBuilderClient orgId={ctx.organization.id} orgSlug={slug} formId={id} />
      </PageBody>
    </Page>
  );
}
