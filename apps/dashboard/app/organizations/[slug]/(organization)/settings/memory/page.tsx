import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { MemoryProfile } from '~/components/memory/memory-profile';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('AI Memory')
};

export default async function MemorySettingsPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">AI Memory</h1>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6 max-w-3xl">
          <MemoryProfile
            orgId={ctx.organization.id}
            orgName={ctx.organization.name}
          />
        </div>
      </PageBody>
    </Page>
  );
}
