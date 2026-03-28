/**
 * Data pipeline orchestrator
 *
 * Called after a successful OAuth connector callback.
 * Fetches all Tier 1 reports for the connected account and persists
 * them in AdPlatformReport rows (upsert by connectedAccountId + reportType).
 */

import { prisma } from '@workspace/database/client';

import { syncGoogleAccount } from './google-sync';
import { MetaTokenExpiredError, syncMetaAccount } from './meta-sync';
import { syncBingAccount } from './bing-sync';
import type { PlatformSyncSummary, SyncResult } from './types';

type ConnectedAccount = {
  id: string;
  organizationId: string;
  platform: string;
  accountId: string;
  accessToken: string | null;
};

export async function runPlatformSync(account: ConnectedAccount): Promise<PlatformSyncSummary> {
  const { id, organizationId, platform, accountId, accessToken } = account;

  if (!accessToken) {
    return { platform, accountId, results: [], completedAt: new Date() };
  }

  const platformKey = platform.toUpperCase();
  let results: (SyncResult & { rows?: unknown[] })[] = [];

  if (platformKey === 'GOOGLE') {
    results = (await syncGoogleAccount(id, accessToken, accountId)) as (SyncResult & { rows?: unknown[] })[];
  } else if (platformKey === 'META') {
    try {
      results = (await syncMetaAccount(id, accessToken, accountId)) as (SyncResult & { rows?: unknown[] })[];
    } catch (e) {
      if (e instanceof MetaTokenExpiredError) {
        // Mark the account as needing reconnect so the UI can surface this
        await prisma.connectedAdAccount.update({
          where: { id },
          data: { status: 'token_expired' }
        }).catch(() => {});
        return { platform: platformKey, accountId, results: [], completedAt: new Date(), tokenExpired: true };
      }
      throw e;
    }
  } else if (platformKey === 'BING') {
    results = (await syncBingAccount(id, accessToken, accountId)) as (SyncResult & { rows?: unknown[] })[];
  }

  // Persist each report to DB — delete existing for this account+reportType, then insert
  for (const result of results) {
    const rows = result.rows ?? [];
    if (rows.length === 0) continue;

    try {
      await prisma.$transaction([
        prisma.adPlatformReport.deleteMany({
          where: { connectedAccountId: id, reportType: result.reportType }
        }),
        prisma.adPlatformReport.create({
          data: {
            organizationId,
            connectedAccountId: id,
            platform: platformKey,
            reportType: result.reportType,
            dateRange: '30d',
            data: rows as object[]
          }
        })
      ]);
    } catch (e) {
      console.error(`[sync] Failed to persist ${platformKey}/${result.reportType}:`, e);
    }
  }

  // Update lastSyncAt on the connected account
  try {
    await prisma.connectedAdAccount.update({
      where: { id },
      data: { lastSyncAt: new Date() }
    });
  } catch {
    // non-fatal
  }

  return {
    platform: platformKey,
    accountId,
    results: results.map(({ rows: _rows, ...r }) => r),
    completedAt: new Date()
  };
}
