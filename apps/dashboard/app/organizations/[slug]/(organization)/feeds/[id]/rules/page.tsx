import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Page, PageBody, PageHeader, PagePrimaryBar } from '@workspace/ui/components/page';

import { FeedRulesClient } from '~/components/feeds/feed-rules-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Feed Rules') };

export default async function FeedRulesPage(props: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug, id } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Feed Rules</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <FeedRulesClient feedId={id} orgId={ctx.organization.id} orgSlug={slug} />
      </PageBody>
    </Page>
  );
}
