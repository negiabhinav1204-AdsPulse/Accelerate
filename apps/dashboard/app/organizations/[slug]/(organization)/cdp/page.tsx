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

import { CdpProfilesClient } from '~/components/cdp/cdp-profiles-client';
import { getOrganizationDetails } from '~/data/organization/get-organization-details';
import { createTitle } from '~/lib/formatters';
import { replaceOrgSlug, routes } from '@workspace/routes';

export const metadata: Metadata = { title: createTitle('Customers') };

export default async function CdpPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { slug } = await props.params;
  const orgDetails = await getOrganizationDetails();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Customers</h1>
        </PagePrimaryBar>
        <PageActions>
          <a
            href={replaceOrgSlug(routes.dashboard.organizations.slug.CdpSegments, slug)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage segments →
          </a>
        </PageActions>
      </PageHeader>
      <PageBody>
        <div className="p-6">
          <CdpProfilesClient orgId={ctx.organization.id} orgCurrency={orgDetails.currency ?? 'USD'} />
        </div>
      </PageBody>
    </Page>
  );
}
