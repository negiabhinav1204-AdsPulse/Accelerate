/**
 * GET /api/campaigns/external
 *
 * Returns campaigns synced from external ad platforms (e.g. Meta).
 * Data is sourced from AdPlatformReport rows rather than the Campaign table.
 *
 * Query params:
 *   orgId    (required)
 *   search   — case-insensitive name filter
 *   status   — filter by status (e.g. 'active', 'paused')
 *   platform — filter by platform (e.g. 'meta')
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { prisma } from '@workspace/database/client'

type MetaCampaign = {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time?: string
}

type CampaignListItem = {
  id: string
  acceId: null
  name: string
  source: 'external'
  objective: string
  status: string
  totalBudget: number
  currency: string
  updatedAt: string
  platformCampaignId: string
  adAccountId: string
  platformCampaigns: {
    id: string
    platform: string
    status: string
    budget: number
    currency: string
    platformCampaignId: string
    adGroups: never[]
  }[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl

  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = searchParams.get('search')
  const statusFilter = searchParams.get('status')
  const platformFilter = searchParams.get('platform')

  const reports = await prisma.adPlatformReport.findMany({
    where: {
      organizationId: orgId,
      reportType: 'campaigns',
      archivedAt: null
    },
    include: {
      connectedAccount: {
        select: {
          currency: true,
          lastSyncAt: true,
          accountId: true
        }
      }
    }
  })

  let campaigns: CampaignListItem[] = []

  for (const report of reports) {
    const rows = (report.data as MetaCampaign[]) ?? []

    for (const campaign of rows) {
      const budget = campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : 0
      const currency = report.connectedAccount.currency ?? 'USD'
      const updatedAt =
        report.connectedAccount.lastSyncAt?.toISOString() ?? new Date().toISOString()
      const status = campaign.status?.toLowerCase() ?? 'unknown'

      campaigns.push({
        id: campaign.id,
        acceId: null,
        name: campaign.name,
        source: 'external',
        objective: campaign.objective ?? 'UNKNOWN',
        status,
        totalBudget: budget,
        currency,
        updatedAt,
        platformCampaignId: campaign.id,
        adAccountId: report.connectedAccount.accountId,
        platformCampaigns: [
          {
            id: `ext-${campaign.id}`,
            platform: 'meta',
            status,
            budget,
            currency,
            platformCampaignId: campaign.id,
            adGroups: []
          }
        ]
      })
    }
  }

  // Apply in-memory filters
  if (search) {
    const lower = search.toLowerCase()
    campaigns = campaigns.filter((c) => c.name.toLowerCase().includes(lower))
  }
  if (statusFilter) {
    campaigns = campaigns.filter((c) => c.status === statusFilter.toLowerCase())
  }
  if (platformFilter) {
    campaigns = campaigns.filter((c) =>
      c.platformCampaigns.some((pc) => pc.platform === platformFilter.toLowerCase())
    )
  }

  const lastSyncAt =
    reports
      .map((r) => r.connectedAccount.lastSyncAt)
      .find((d) => d != null)
      ?.toISOString() ?? null

  return NextResponse.json({ campaigns, total: campaigns.length, lastSyncAt })
}
