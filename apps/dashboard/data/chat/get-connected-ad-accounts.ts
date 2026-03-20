import 'server-only';

import { prisma } from '@workspace/database/client';

export type ConnectedAdAccount = {
  id: string;
  platform: string;
  accountId: string;
  accountName: string;
  status: string;
};

export async function getConnectedAdAccounts(
  organizationId: string
): Promise<ConnectedAdAccount[]> {
  const accounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId, status: 'connected' },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      status: true
    },
    orderBy: { connectedAt: 'asc' }
  });

  return accounts;
}
