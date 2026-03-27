import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar,
  PageActions
} from '@workspace/ui/components/page';

import { SegmentsClient } from '~/components/cdp/segments-client';
import { createTitle } from '~/lib/formatters';
import { replaceOrgSlug, routes } from '@workspace/routes';

export const metadata: Metadata = { title: createTitle('Segments') };

export default async function SegmentsPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Audience Segments</h1>
        </PagePrimaryBar>
        <PageActions>
          <a
            href={replaceOrgSlug(routes.dashboard.organizations.slug.Cdp, slug)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All customers
          </a>
        </PageActions>
      </PageHeader>
      <PageBody>
        <div className="p-6">
          <SegmentsClient orgId={ctx.organization.id} />
        </div>
      </PageBody>
    </Page>
  );
}
