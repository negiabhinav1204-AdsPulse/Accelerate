/**
 * GET /api/campaigns/external
 *
 * Returns campaigns synced from external ad platforms (Meta, Google).
 * Data is sourced from AdPlatformReport rows rather than the Campaign table.
 * Includes real performance metrics (spend, impressions, clicks, conversions).
 *
 * Query params:
 *   orgId    (required)
 *   search   — case-insensitive name filter
 *   status   — filter by status (e.g. 'active', 'paused')
 *   platform — filter by platform (e.g. 'meta', 'google')
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

type GoogleCampaignRow = {
  // Real API nested format
  campaign?: { id?: string; name?: string; status?: string }
  metrics?: {
    impressions?: string | number
    clicks?: string | number
    costMicros?: string | number
    cost_micros?: string | number
    conversions?: string | number
    conversionsValue?: string | number
  }
  segments?: { date?: string }
  // Mock flat format
  campaignId?: string
  campaignName?: string
  status?: string
  impressions?: number
  clicks?: number
  costMicros?: number
  conversions?: number
  conversionsValue?: number
}

// Performance metrics aggregated per campaign
type CampaignMetrics = {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  roas: number
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
  totalSpend: number
  totalRevenue: number
  metrics: CampaignMetrics
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

  // Fetch Meta campaign metadata + Meta daily insights + Google campaign reports in parallel
  const [metaMetaReports, metaInsightReports, googleCampaignReports] = await Promise.all([
    // Meta: campaign list (metadata)
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaigns', archivedAt: null },
      include: {
        connectedAccount: {
          select: { currency: true, lastSyncAt: true, accountId: true }
        }
      }
    }),
    // Meta: daily campaign insights (performance)
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign_insights_daily', archivedAt: null },
      select: { data: true }
    }),
    // Google: campaign report (metadata + performance combined)
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign', platform: 'GOOGLE', archivedAt: null },
      include: {
        connectedAccount: {
          select: { currency: true, lastSyncAt: true, accountId: true }
        }
      }
    }),
  ])

  // ── Build Meta performance map: campaignId → aggregated metrics ──────────

  const metaMetricsMap = new Map<string, CampaignMetrics>()

  for (const report of metaInsightReports) {
    for (const row of (report.data as Record<string, unknown>[]) ?? []) {
      const cid = String(row.campaign_id ?? '')
      if (!cid) continue
      const purchases = ((row.actions as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
      const purchaseValue = ((row.action_values as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
      const spend = parseFloat(String(row.spend ?? 0))
      const existing = metaMetricsMap.get(cid) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 }
      const newSpend = existing.spend + spend
      const newConvValue = purchaseValue
      metaMetricsMap.set(cid, {
        spend: newSpend,
        impressions: existing.impressions + parseInt(String(row.impressions ?? 0), 10),
        clicks: existing.clicks + parseInt(String(row.clicks ?? 0), 10),
        conversions: existing.conversions + purchases,
        roas: newSpend > 0 ? (existing.roas * existing.spend + newConvValue) / newSpend : 0,
      })
    }
  }

  // ── Build Google performance map: campaignId → aggregated metrics ─────────

  const googleMetricsMap = new Map<string, CampaignMetrics & { name: string; status: string; currency: string; lastSyncAt: string; accountId: string }>()

  for (const report of googleCampaignReports) {
    const currency = report.connectedAccount.currency ?? 'USD'
    const lastSyncAt = report.connectedAccount.lastSyncAt?.toISOString() ?? new Date().toISOString()
    const accountId = report.connectedAccount.accountId

    for (const row of (report.data as GoogleCampaignRow[]) ?? []) {
      const cid = row.campaign?.id ?? row.campaignId ?? ''
      if (!cid) continue
      const name = row.campaign?.name ?? row.campaignName ?? ''
      const status = (row.campaign?.status ?? row.status ?? 'UNKNOWN').toLowerCase()
      const nested = row.metrics
      const costMicros = parseFloat(String(nested?.costMicros ?? nested?.cost_micros ?? row.costMicros ?? 0))
      const spend = costMicros / 1_000_000
      const impressions = parseInt(String(nested?.impressions ?? row.impressions ?? 0), 10)
      const clicks = parseInt(String(nested?.clicks ?? row.clicks ?? 0), 10)
      const conversions = parseFloat(String(nested?.conversions ?? row.conversions ?? 0))
      const convValue = parseFloat(String(nested?.conversionsValue ?? row.conversionsValue ?? 0))

      const existing = googleMetricsMap.get(cid)
      const newSpend = (existing?.spend ?? 0) + spend
      googleMetricsMap.set(cid, {
        name: name || existing?.name || '',
        status: status || existing?.status || 'unknown',
        currency: existing?.currency ?? currency,
        lastSyncAt: existing?.lastSyncAt ?? lastSyncAt,
        accountId: existing?.accountId ?? accountId,
        spend: newSpend,
        impressions: (existing?.impressions ?? 0) + impressions,
        clicks: (existing?.clicks ?? 0) + clicks,
        conversions: (existing?.conversions ?? 0) + conversions,
        roas: newSpend > 0 ? ((existing?.roas ?? 0) * (existing?.spend ?? 0) + convValue) / newSpend : 0,
      })
    }
  }

  // ── Build campaign list ───────────────────────────────────────────────────

  let campaigns: CampaignListItem[] = []

  // Meta campaigns from metadata report
  for (const report of metaMetaReports) {
    const rows = (report.data as MetaCampaign[]) ?? []
    for (const campaign of rows) {
      const budget = campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : 0
      const currency = report.connectedAccount.currency ?? 'USD'
      const updatedAt = report.connectedAccount.lastSyncAt?.toISOString() ?? new Date().toISOString()
      const status = campaign.status?.toLowerCase() ?? 'unknown'
      const metrics = metaMetricsMap.get(campaign.id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 }

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
        totalSpend: metrics.spend,
        totalRevenue: metrics.spend * metrics.roas,
        metrics,
        platformCampaigns: [{
          id: `ext-${campaign.id}`,
          platform: 'meta',
          status,
          budget,
          currency,
          platformCampaignId: campaign.id,
          adGroups: []
        }]
      })
    }
  }

  // Google campaigns (de-duplicated by campaign ID)
  for (const [cid, g] of googleMetricsMap.entries()) {
    const metrics: CampaignMetrics = { spend: g.spend, impressions: g.impressions, clicks: g.clicks, conversions: g.conversions, roas: g.roas }
    campaigns.push({
      id: cid,
      acceId: null,
      name: g.name,
      source: 'external',
      objective: 'SEARCH',
      status: g.status,
      totalBudget: 0,
      currency: g.currency,
      updatedAt: g.lastSyncAt,
      platformCampaignId: cid,
      adAccountId: g.accountId,
      totalSpend: g.spend,
      totalRevenue: g.spend * g.roas,
      metrics,
      platformCampaigns: [{
        id: `ext-google-${cid}`,
        platform: 'google',
        status: g.status,
        budget: 0,
        currency: g.currency,
        platformCampaignId: cid,
        adGroups: []
      }]
    })
  }

  // Apply filters
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
    [...metaMetaReports, ...googleCampaignReports]
      .map((r) => r.connectedAccount.lastSyncAt)
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0]
      ?.toISOString() ?? null

  return NextResponse.json({ campaigns, total: campaigns.length, lastSyncAt })
}
