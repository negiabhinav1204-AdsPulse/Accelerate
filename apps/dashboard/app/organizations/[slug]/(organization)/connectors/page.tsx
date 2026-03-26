import * as React from 'react';
import type { Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import {
  ConnectorsClient,
  type ConnectedPlatformData
} from '~/components/connectors/connectors-client';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Connectors')
};

export default async function ConnectorsPage({
  searchParams
}: {
  searchParams: Promise<{
    connected?: string;
    connector_error?: string;
    platform?: string;
    select?: string;
  }>;
}): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();
  const { connected, connector_error, platform: errorPlatform, select } = await searchParams;

  const membership = ctx.session.user.memberships.find(
    (m) => m.organizationId === ctx.organization.id
  );
  // Admin and Developer can manage connectors
  const isAdmin =
    !!membership &&
    (membership.isOwner ||
      membership.role === 'ADMIN' ||
      membership.role === 'DEVELOPER');

  // Fetch all active (non-archived) connected accounts for the org
  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      organizationId: ctx.organization.id,
      archivedAt: null
    },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      isDefault: true,
      status: true,
      lastSyncAt: true
    },
    orderBy: { connectedAt: 'asc' }
  });

  // Group by platform
  const platformMap = new Map<string, typeof accounts>();
  for (const account of accounts) {
    const list = platformMap.get(account.platform) ?? [];
    list.push(account);
    platformMap.set(account.platform, list);
  }

  const connectedPlatforms: ConnectedPlatformData[] = Array.from(
    platformMap.entries()
  ).map(([platform, accs]) => {
    const defaultAccount = accs.find((a) => a.isDefault) ?? accs[0] ?? null;
    return {
      platform,
      defaultAccount: defaultAccount
        ? {
            accountId: defaultAccount.accountId,
            accountName: defaultAccount.accountName,
            lastSyncAt: defaultAccount.lastSyncAt
          }
        : null,
      accountCount: accs.length
    };
  });

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Connectors</h1>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="p-6">
          <ConnectorsClient
            connected={connectedPlatforms}
            orgSlug={ctx.organization.slug}
            orgId={ctx.organization.id}
            isAdmin={isAdmin}
            initialConnected={connected}
            initialError={connector_error}
            initialErrorPlatform={errorPlatform}
            initialSelectPlatform={select}
          />
        </div>
      </PageBody>
    </Page>
  );
}
