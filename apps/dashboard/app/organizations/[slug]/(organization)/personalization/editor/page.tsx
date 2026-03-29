import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { PersonalizationEditorClient } from '~/components/personalization/personalization-editor-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Page Editor') };

// This page receives optional ?pageId= query param for editing a specific page
export default async function PersonalizationEditorPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pageId?: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;
  const { pageId } = await props.searchParams;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Page Editor</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <PersonalizationEditorClient orgId={ctx.organization.id} orgSlug={slug} pageId={pageId} />
      </PageBody>
    </Page>
  );
}
