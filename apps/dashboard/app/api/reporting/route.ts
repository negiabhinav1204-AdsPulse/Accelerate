/**
 * GET /api/reporting
 *
 * Returns aggregated campaign performance metrics from synced platform insights.
 *
 * Query params:
 *   orgId       (required)
 *   campaignId  — filter to a single campaign
 *   dateRange   — '7d' | '15d' | '30d' | 'custom' (default: '7d')
 *   dateFrom    — used when dateRange = 'custom'
 *   dateTo      — used when dateRange = 'custom'
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { prisma } from '@workspace/database/client'

import { orgKey, redis, TTL } from '~/lib/redis'
import { SERVICES, getService } from '~/lib/service-router'

type AgeGenderRow = {
  age: string
  gender: string
  impressions: string
  spend: string
  clicks: string
  date_start: string
}

type PlatformRow = {
  publisher_platform: string
  platform_position: string
  impressions: string
  spend: string
  clicks: string
  date_start: string
}

type MetaInsightRow = {
  date_start: string
  date_stop: string
  campaign_id: string
  campaign_name: string
  impressions: string
  spend: string
  clicks: string
  ctr?: string
  cpc?: string
  cpm?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
}

function getConversions(row: MetaInsightRow): number {
  return (row.actions ?? [])
    .filter(
      (a) =>
        a.action_type === 'purchase' ||
        a.action_type === 'offsite_conversion.fb_pixel_purchase'
    )
    .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
}

function getRoas(row: MetaInsightRow): number {
  return parseFloat(row.purchase_roas?.[0]?.value ?? '0')
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
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

  // Forward to reporting service if enabled (auth + membership already verified above)
  if (SERVICES.reporting.enabled) {
    const qs = request.nextUrl.searchParams.toString()
    const res = await getService(SERVICES.reporting.url, `/reporting?${qs}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  }

  const campaignId = searchParams.get('campaignId')
  const dateRange = searchParams.get('dateRange') ?? '7d'
  let dateFrom = searchParams.get('dateFrom') ?? ''
  let dateTo = searchParams.get('dateTo') ?? ''

  if (dateRange !== 'custom') {
    const daysMap: Record<string, number> = { '7d': 7, '15d': 15, '30d': 30 }
    const days = daysMap[dateRange] ?? 7
    const now = new Date()
    dateTo = toISODate(now)
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    dateFrom = toISODate(from)
  }

  // Check Redis cache (reporting data is expensive — 4 parallel DB queries)
  const reportingCacheKey = orgKey(
    orgId,
    `reporting:${dateRange}:${campaignId ?? 'all'}:${dateFrom}:${dateTo}`
  )
  try {
    const cached = await redis.get(reportingCacheKey)
    if (cached) return NextResponse.json(cached)
  } catch {
    // Redis unavailable — fall through to DB
  }

  const [reports, latestAccount, ageGenderReports, platformReports] = await Promise.all([
    prisma.adPlatformReport.findMany({
      where: {
        organizationId: orgId,
        reportType: 'campaign_insights_daily',
        archivedAt: null
      },
      include: {
        connectedAccount: {
          select: {
            lastSyncAt: true,
            platform: true
          }
        }
      }
    }),
    prisma.connectedAdAccount.findFirst({
      where: {
        organizationId: orgId,
        platform: 'meta',
        archivedAt: null
      },
      orderBy: { lastSyncAt: 'desc' },
      select: { lastSyncAt: true }
    }),
    prisma.adPlatformReport.findMany({
      where: {
        organizationId: orgId,
        reportType: 'insights_by_age_gender',
        archivedAt: null
      }
    }),
    prisma.adPlatformReport.findMany({
      where: {
        organizationId: orgId,
        reportType: 'insights_by_platform_placement',
        archivedAt: null
      }
    })
  ])

  // Flatten and filter rows across all reports
  let rows: MetaInsightRow[] = []
  for (const report of reports) {
    const reportRows = (report.data as MetaInsightRow[]) ?? []
    for (const row of reportRows) {
      if (row.date_start >= dateFrom && row.date_start <= dateTo) {
        rows.push(row)
      }
    }
  }

  if (campaignId) {
    rows = rows.filter((r) => r.campaign_id === campaignId)
  }

  // dailyMetrics — group by date_start
  const dailyMap = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >()

  for (const row of rows) {
    const existing = dailyMap.get(row.date_start) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0
    }
    dailyMap.set(row.date_start, {
      spend: existing.spend + parseFloat(row.spend || '0'),
      impressions: existing.impressions + parseInt(row.impressions || '0', 10),
      clicks: existing.clicks + parseInt(row.clicks || '0', 10),
      conversions: existing.conversions + getConversions(row)
    })
  }

  const dailyMetrics = Array.from(dailyMap.entries())
    .map(([date, metrics]) => ({ date, ...metrics }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // summaryTotals
  let totalSpend = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0
  let totalRoas = 0
  let roasCount = 0

  for (const row of rows) {
    totalSpend += parseFloat(row.spend || '0')
    totalImpressions += parseInt(row.impressions || '0', 10)
    totalClicks += parseInt(row.clicks || '0', 10)
    totalConversions += getConversions(row)
    const roas = getRoas(row)
    if (roas > 0) {
      totalRoas += roas
      roasCount++
    }
  }

  const summaryTotals = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    conversions: totalConversions,
    ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    roas: roasCount > 0 ? totalRoas / roasCount : 0
  }

  // perCampaign — group by campaign_id + campaign_name
  const campaignMap = new Map<
    string,
    {
      campaignId: string
      campaignName: string
      spend: number
      impressions: number
      clicks: number
      conversions: number
      roasSum: number
      roasCount: number
    }
  >()

  for (const row of rows) {
    const key = row.campaign_id
    const existing = campaignMap.get(key) ?? {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      roasSum: 0,
      roasCount: 0
    }
    const roas = getRoas(row)
    campaignMap.set(key, {
      ...existing,
      spend: existing.spend + parseFloat(row.spend || '0'),
      impressions: existing.impressions + parseInt(row.impressions || '0', 10),
      clicks: existing.clicks + parseInt(row.clicks || '0', 10),
      conversions: existing.conversions + getConversions(row),
      roasSum: existing.roasSum + (roas > 0 ? roas : 0),
      roasCount: existing.roasCount + (roas > 0 ? 1 : 0)
    })
  }

  const perCampaign = Array.from(campaignMap.values())
    .map(({ roasSum, roasCount: rc, ...c }) => ({
      ...c,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      roas: rc > 0 ? roasSum / rc : 0
    }))
    .sort((a, b) => b.spend - a.spend)

  // ageGender — group by age, sum clicks by gender
  const ageGenderMap = new Map<string, { female: number; male: number; others: number }>()
  for (const report of ageGenderReports) {
    const reportRows = (report.data as AgeGenderRow[]) ?? []
    for (const row of reportRows) {
      if (row.date_start >= dateFrom && row.date_start <= dateTo) {
        const existing = ageGenderMap.get(row.age) ?? { female: 0, male: 0, others: 0 }
        const clicks = parseInt(row.clicks || '0', 10)
        const gender = row.gender?.toLowerCase() ?? ''
        if (gender === 'female') {
          ageGenderMap.set(row.age, { ...existing, female: existing.female + clicks })
        } else if (gender === 'male') {
          ageGenderMap.set(row.age, { ...existing, male: existing.male + clicks })
        } else {
          ageGenderMap.set(row.age, { ...existing, others: existing.others + clicks })
        }
      }
    }
  }
  const ageGender = Array.from(ageGenderMap.entries())
    .map(([age, counts]) => ({ age, ...counts }))
    .sort((a, b) => a.age.localeCompare(b.age))

  // platformBreakdown — group by publisher_platform + platform_position, sum clicks
  const platformMap = new Map<string, { region: string; conversions: number }>()
  for (const report of platformReports) {
    const reportRows = (report.data as PlatformRow[]) ?? []
    for (const row of reportRows) {
      if (row.date_start >= dateFrom && row.date_start <= dateTo) {
        const publisherCapitalized =
          (row.publisher_platform ?? '').charAt(0).toUpperCase() +
          (row.publisher_platform ?? '').slice(1).toLowerCase()
        const positionTitleCase = (row.platform_position ?? '')
          .replace(/_/g, ' ')
          .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        const region = `${publisherCapitalized} ${positionTitleCase}`.trim()
        const key = region
        const existing = platformMap.get(key) ?? { region, conversions: 0 }
        platformMap.set(key, {
          region,
          conversions: existing.conversions + parseInt(row.clicks || '0', 10)
        })
      }
    }
  }
  const platformBreakdown = Array.from(platformMap.values())
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5)

  const lastSyncAt = latestAccount?.lastSyncAt?.toISOString() ?? null

  const payload = { dailyMetrics, summaryTotals, perCampaign, ageGender, platformBreakdown, lastSyncAt }

  // Populate Redis cache
  try {
    await redis.setex(reportingCacheKey, TTL.REPORTING, payload)
  } catch {
    // Non-fatal
  }

  return NextResponse.json(payload)
}
