/**
 * PATCH /api/campaigns/[id]/status
 *
 * Pause or resume a campaign (Accelerate-managed or external/Meta-synced).
 *
 * Body: {
 *   action: 'pause' | 'resume'
 *   source: 'accelerate' | 'external'
 *   platform: string
 *   platformCampaignId: string
 *   adAccountId: string
 *   orgId: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { symmetricDecrypt } from '@workspace/auth/encryption'
import { prisma } from '@workspace/database/client'

import { pauseMetaCampaign, resumeMetaCampaign } from '~/lib/platforms/meta-api'

type StatusBody = {
  action: 'pause' | 'resume'
  source: 'accelerate' | 'external'
  platform: string
  platformCampaignId: string
  adAccountId: string
  orgId: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: StatusBody
  try {
    body = (await request.json()) as StatusBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, source, platform, platformCampaignId, adAccountId, orgId } = body

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
  if (!action || !['pause', 'resume'].includes(action)) {
    return NextResponse.json({ error: 'action must be pause or resume' }, { status: 400 })
  }

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    if (source === 'external' && platform === 'meta') {
      const account = await prisma.connectedAdAccount.findFirst({
        where: { organizationId: orgId, platform: 'META', archivedAt: null },
        select: { accessToken: true }
      })

      if (!account?.accessToken) {
        return NextResponse.json({ ok: false, error: 'No connected Meta account found' }, { status: 404 })
      }

      const token = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!)

      if (action === 'pause') {
        await pauseMetaCampaign(platformCampaignId, adAccountId, token)
      } else {
        await resumeMetaCampaign(platformCampaignId, adAccountId, token)
      }

      return NextResponse.json({ ok: true })
    }

    if (source === 'accelerate') {
      const newStatus = action === 'pause' ? 'paused' : 'live'

      await prisma.platformCampaign.updateMany({
        where: {
          campaignId: id,
          ...(platform ? { platform } : {})
        },
        data: { status: newStatus }
      })

      // Best-effort: also call Meta API if we have the platform campaign ID
      if (platformCampaignId && platform === 'meta') {
        try {
          const account = await prisma.connectedAdAccount.findFirst({
            where: { organizationId: orgId, platform: 'META', archivedAt: null },
            select: { accessToken: true }
          })
          if (account?.accessToken) {
            const token = symmetricDecrypt(account.accessToken, process.env.AUTH_SECRET!)
            if (action === 'pause') {
              await pauseMetaCampaign(platformCampaignId, adAccountId, token)
            } else {
              await resumeMetaCampaign(platformCampaignId, adAccountId, token)
            }
          }
        } catch {
          // best-effort — ignore Meta API errors for accelerate campaigns
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Unknown source' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
