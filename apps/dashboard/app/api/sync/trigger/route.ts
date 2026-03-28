/**
 * POST /api/sync/trigger
 *
 * Triggers a manual platform sync for all connected ad accounts in an org.
 *
 * Body: { orgId: string }
 */

import { NextRequest, NextResponse } from 'next/server'

// Sync can take up to 2 min (10 parallel Meta API calls × 30s timeout each)
export const maxDuration = 120;

import { auth } from '@workspace/auth'
import { symmetricDecrypt } from '@workspace/auth/encryption'
import { prisma } from '@workspace/database/client'

import { runPlatformSync } from '~/lib/data-pipeline/sync'
import type { PlatformSyncSummary } from '~/lib/data-pipeline/types'
import { SERVICES, callService } from '~/lib/service-router'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { orgId: string }
  try {
    body = (await request.json()) as { orgId: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { orgId } = body
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Forward to sync service if enabled (auth already verified above)
  if (SERVICES.sync.enabled) {
    const res = await callService(SERVICES.sync.url, '/sync/trigger', { orgId })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  }

  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      organizationId: orgId,
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

  for (const account of accounts) {
    if (!account.accessToken) continue
    const decryptedToken = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!)
    const summary = await runPlatformSync({
      id: account.id,
      organizationId: account.organizationId,
      platform: account.platform,
      accountId: account.accountId,
      accessToken: decryptedToken
    })
    results.push(summary)
  }

  return NextResponse.json({ synced: results.length, results })
}
