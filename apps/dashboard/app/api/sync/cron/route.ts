/**
 * GET /api/sync/cron
 *
 * Vercel cron job — runs daily to sync all connected ad accounts across all orgs.
 * Secured by CRON_SECRET env var (set in Vercel project settings).
 */

import { NextRequest, NextResponse } from 'next/server'

import { symmetricDecrypt } from '@workspace/auth/encryption'
import { prisma } from '@workspace/database/client'

import { runPlatformSync } from '~/lib/data-pipeline/sync'
import type { PlatformSyncSummary } from '~/lib/data-pipeline/types'
import { SERVICES, callService } from '~/lib/service-router'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Forward to sync service if enabled
  if (SERVICES.sync.enabled) {
    const res = await fetch(`${SERVICES.sync.url}/sync/cron`, {
      headers: { Authorization: request.headers.get('authorization') ?? '' }
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  }

  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      archivedAt: null,
      status: 'connected'
    },
    select: {
      id: true,
      organizationId: true,
      platform: true,
      accountId: true,
      accessToken: true
    }
  })

  const results: PlatformSyncSummary[] = []
  const errors: { accountId: string; error: string }[] = []

  for (const account of accounts) {
    if (!account.accessToken) continue
    try {
      const decryptedToken = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!)
      const summary = await runPlatformSync({
        id: account.id,
        organizationId: account.organizationId,
        platform: account.platform,
        accountId: account.accountId,
        accessToken: decryptedToken
      })
      results.push(summary)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ accountId: account.accountId, error: message })
      console.error(`[cron] Failed to sync account ${account.accountId}:`, err)
    }
  }

  return NextResponse.json({
    synced: results.length,
    failed: errors.length,
    results,
    errors,
    ranAt: new Date().toISOString()
  })
}
