import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { DashboardClient } from '~/components/dashboard/dashboard-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Dashboard')
};

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Overviews and charts and more</p>
            </div>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <DashboardClient orgId={ctx.organization.id} />
      </PageBody>
    </Page>
  );
}
