/**
 * GET /api/reporting
 *
 * Returns aggregated campaign performance metrics from synced platform insights.
 * Supports Meta and Google Ads data, normalized to a common format.
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

// ─── Meta types ────────────────────────────────────────────────────────────────

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

// ─── Google types ───────────────────────────────────────────────────────────────

// Handles both real API (nested) and mock (flat camelCase) formats
type GoogleCampaignRow = {
  // Real API nested format
  campaign?: { id?: string; name?: string }
  metrics?: {
    impressions?: string | number
    clicks?: string | number
    costMicros?: string | number
    cost_micros?: string | number
    conversions?: string | number
    conversionsValue?: string | number
    conversions_value?: string | number
  }
  segments?: { date?: string }
  // Mock flat format
  date?: string
  campaignId?: string
  campaignName?: string
  impressions?: number
  clicks?: number
  costMicros?: number
  conversions?: number
  conversionsValue?: number
}

type GoogleAgeRangeRow = {
  // Real API nested
  adGroupCriterion?: { ageRange?: { type?: string } }
  metrics?: { clicks?: string | number }
  segments?: { date?: string }
  // Mock flat
  date?: string
  ageRange?: string
  clicks?: number
}

type GoogleGenderRow = {
  // Real API nested
  adGroupCriterion?: { gender?: { type?: string } }
  metrics?: { clicks?: string | number }
  segments?: { date?: string }
  // Mock flat
  date?: string
  gender?: string
  clicks?: number
}

// ─── Common normalized row (all platforms → this shape before aggregation) ─────

type NormalizedRow = {
  date_start: string
  campaign_id: string
  campaign_name: string
  impressions: number
  spend: number
  clicks: number
  conversions: number
  roas: number
}

// ─── Normalization helpers ──────────────────────────────────────────────────────

function normalizeMetaRow(row: MetaInsightRow): NormalizedRow {
  const conversions = (row.actions ?? [])
    .filter(
      (a) =>
        a.action_type === 'purchase' ||
        a.action_type === 'offsite_conversion.fb_pixel_purchase'
    )
    .reduce((s, a) => s + parseFloat(a.value || '0'), 0)

  return {
    date_start: row.date_start,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    impressions: parseInt(row.impressions || '0', 10),
    spend: parseFloat(row.spend || '0'),
    clicks: parseInt(row.clicks || '0', 10),
    conversions,
    roas: parseFloat(row.purchase_roas?.[0]?.value ?? '0')
  }
}

function normalizeGoogleCampaignRow(row: GoogleCampaignRow): NormalizedRow {
  const date = row.segments?.date ?? row.date ?? ''
  const campaignId = row.campaign?.id ?? row.campaignId ?? ''
  const campaignName = row.campaign?.name ?? row.campaignName ?? ''
  const impressions = parseInt(String(row.metrics?.impressions ?? row.impressions ?? 0), 10)
  const clicks = parseInt(String(row.metrics?.clicks ?? row.clicks ?? 0), 10)
  const costMicros = parseFloat(
    String(row.metrics?.costMicros ?? row.metrics?.cost_micros ?? row.costMicros ?? 0)
  )
  const conversions = parseFloat(
    String(row.metrics?.conversions ?? row.conversions ?? 0)
  )
  const conversionsValue = parseFloat(
    String(row.metrics?.conversionsValue ?? row.metrics?.conversions_value ?? row.conversionsValue ?? 0)
  )
  const spend = costMicros / 1_000_000
  // Compute ROAS from conversions value / spend if available
  const roas = spend > 0 && conversionsValue > 0 ? conversionsValue / spend : 0

  return { date_start: date, campaign_id: campaignId, campaign_name: campaignName, impressions, spend, clicks, conversions, roas }
}

// Convert Google age range type to display label (matches Meta's format)
function googleAgeRangeToLabel(type: string): string {
  const map: Record<string, string> = {
    AGE_RANGE_18_24: '18-24',
    AGE_RANGE_25_34: '25-34',
    AGE_RANGE_35_44: '35-44',
    AGE_RANGE_45_54: '45-54',
    AGE_RANGE_55_64: '55-64',
    AGE_RANGE_65_UP: '65+',
    AGE_RANGE_UNDETERMINED: 'undetermined'
  }
  return map[type] ?? type
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl

  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Forward to reporting service if enabled
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

  // Redis cache (reporting data is expensive — 6 parallel DB queries)
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

  const [
    metaCampaignReports,
    googleCampaignReports,
    latestSyncAccount,
    metaAgeGenderReports,
    googleAgeRangeReports,
    googleGenderReports,
    metaPlatformReports
  ] = await Promise.all([
    // Meta: daily campaign insights
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign_insights_daily', archivedAt: null },
      include: { connectedAccount: { select: { lastSyncAt: true, platform: true } } }
    }),
    // Google: campaign report
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign', platform: 'GOOGLE', archivedAt: null },
      include: { connectedAccount: { select: { lastSyncAt: true, platform: true } } }
    }),
    // Most recently synced account (any platform)
    prisma.connectedAdAccount.findFirst({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { lastSyncAt: 'desc' },
      select: { lastSyncAt: true }
    }),
    // Meta: age/gender breakdown
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'insights_by_age_gender', archivedAt: null }
    }),
    // Google: age range view
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'age_range_view', platform: 'GOOGLE', archivedAt: null }
    }),
    // Google: gender view
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'gender_view', platform: 'GOOGLE', archivedAt: null }
    }),
    // Meta: platform placement breakdown
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'insights_by_platform_placement', archivedAt: null }
    })
  ])

  // ─── Collect + normalize all campaign rows ────────────────────────────────

  let rows: NormalizedRow[] = []

  for (const report of metaCampaignReports) {
    for (const row of (report.data as MetaInsightRow[]) ?? []) {
      if (row.date_start >= dateFrom && row.date_start <= dateTo) {
        rows.push(normalizeMetaRow(row))
      }
    }
  }

  for (const report of googleCampaignReports) {
    for (const row of (report.data as GoogleCampaignRow[]) ?? []) {
      const normalized = normalizeGoogleCampaignRow(row)
      if (normalized.date_start >= dateFrom && normalized.date_start <= dateTo) {
        rows.push(normalized)
      }
    }
  }

  if (campaignId) {
    rows = rows.filter((r) => r.campaign_id === campaignId)
  }

  // ─── dailyMetrics ─────────────────────────────────────────────────────────

  const dailyMap = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number }
  >()

  for (const row of rows) {
    const existing = dailyMap.get(row.date_start) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    dailyMap.set(row.date_start, {
      spend: existing.spend + row.spend,
      impressions: existing.impressions + row.impressions,
      clicks: existing.clicks + row.clicks,
      conversions: existing.conversions + row.conversions
    })
  }

  const dailyMetrics = Array.from(dailyMap.entries())
    .map(([date, metrics]) => ({ date, ...metrics }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ─── summaryTotals ────────────────────────────────────────────────────────

  let totalSpend = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0
  let totalRoas = 0
  let roasCount = 0

  for (const row of rows) {
    totalSpend += row.spend
    totalImpressions += row.impressions
    totalClicks += row.clicks
    totalConversions += row.conversions
    if (row.roas > 0) {
      totalRoas += row.roas
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

  // ─── perCampaign ──────────────────────────────────────────────────────────

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
    campaignMap.set(key, {
      ...existing,
      spend: existing.spend + row.spend,
      impressions: existing.impressions + row.impressions,
      clicks: existing.clicks + row.clicks,
      conversions: existing.conversions + row.conversions,
      roasSum: existing.roasSum + (row.roas > 0 ? row.roas : 0),
      roasCount: existing.roasCount + (row.roas > 0 ? 1 : 0)
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

  // ─── ageGender ────────────────────────────────────────────────────────────

  const ageGenderMap = new Map<string, { female: number; male: number; others: number }>()

  // Meta age/gender
  for (const report of metaAgeGenderReports) {
    for (const row of (report.data as AgeGenderRow[]) ?? []) {
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

  // Google age range
  for (const report of googleAgeRangeReports) {
    for (const row of (report.data as GoogleAgeRangeRow[]) ?? []) {
      const date = row.segments?.date ?? row.date ?? ''
      if (date >= dateFrom && date <= dateTo) {
        const rawAge = row.adGroupCriterion?.ageRange?.type ?? row.ageRange ?? ''
        const age = googleAgeRangeToLabel(rawAge)
        const clicks = parseInt(String(row.metrics?.clicks ?? row.clicks ?? 0), 10)
        const existing = ageGenderMap.get(age) ?? { female: 0, male: 0, others: 0 }
        // Age range rows don't split by gender — add to others
        ageGenderMap.set(age, { ...existing, others: existing.others + clicks })
      }
    }
  }

  // Google gender
  for (const report of googleGenderReports) {
    for (const row of (report.data as GoogleGenderRow[]) ?? []) {
      const date = row.segments?.date ?? row.date ?? ''
      if (date >= dateFrom && date <= dateTo) {
        const genderRaw = (row.adGroupCriterion?.gender?.type ?? row.gender ?? '').toLowerCase()
        const clicks = parseInt(String(row.metrics?.clicks ?? row.clicks ?? 0), 10)
        // Add Google gender clicks to the 'all ages' bucket (key: 'google')
        const existing = ageGenderMap.get('all ages') ?? { female: 0, male: 0, others: 0 }
        if (genderRaw === 'female') {
          ageGenderMap.set('all ages', { ...existing, female: existing.female + clicks })
        } else if (genderRaw === 'male') {
          ageGenderMap.set('all ages', { ...existing, male: existing.male + clicks })
        } else {
          ageGenderMap.set('all ages', { ...existing, others: existing.others + clicks })
        }
      }
    }
  }

  const ageGender = Array.from(ageGenderMap.entries())
    .map(([age, counts]) => ({ age, ...counts }))
    .sort((a, b) => a.age.localeCompare(b.age))

  // ─── platformBreakdown ────────────────────────────────────────────────────

  const platformMap = new Map<string, { region: string; conversions: number }>()

  // Meta platform placement
  for (const report of metaPlatformReports) {
    for (const row of (report.data as PlatformRow[]) ?? []) {
      if (row.date_start >= dateFrom && row.date_start <= dateTo) {
        const publisherCapitalized =
          (row.publisher_platform ?? '').charAt(0).toUpperCase() +
          (row.publisher_platform ?? '').slice(1).toLowerCase()
        const positionTitleCase = (row.platform_position ?? '')
          .replace(/_/g, ' ')
          .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        const region = `${publisherCapitalized} ${positionTitleCase}`.trim()
        const existing = platformMap.get(region) ?? { region, conversions: 0 }
        platformMap.set(region, {
          region,
          conversions: existing.conversions + parseInt(row.clicks || '0', 10)
        })
      }
    }
  }

  // Google: use normalized campaign rows grouped by ad network type
  for (const report of googleCampaignReports) {
    for (const row of (report.data as (GoogleCampaignRow & { adNetworkType?: string; segments?: { date?: string; adNetworkType?: string } })[]) ?? []) {
      const date = row.segments?.date ?? row.date ?? ''
      if (date >= dateFrom && date <= dateTo) {
        const networkType = row.segments?.adNetworkType ?? (row as { adNetworkType?: string }).adNetworkType ?? 'SEARCH'
        const networkLabel: Record<string, string> = {
          SEARCH: 'Google Search',
          DISPLAY: 'Google Display',
          YOUTUBE_SEARCH: 'YouTube Search',
          YOUTUBE_WATCH: 'YouTube Watch',
          MIXED: 'Google Mixed',
          UNKNOWN: 'Google'
        }
        const region = networkLabel[networkType] ?? `Google ${networkType}`
        const clicks = parseInt(String(row.metrics?.clicks ?? row.clicks ?? 0), 10)
        const existing = platformMap.get(region) ?? { region, conversions: 0 }
        platformMap.set(region, { region, conversions: existing.conversions + clicks })
      }
    }
  }

  const platformBreakdown = Array.from(platformMap.values())
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5)

  const lastSyncAt = latestSyncAccount?.lastSyncAt?.toISOString() ?? null

  const payload = { dailyMetrics, summaryTotals, perCampaign, ageGender, platformBreakdown, lastSyncAt }

  // Populate Redis cache
  try {
    await redis.setex(reportingCacheKey, TTL.REPORTING, payload)
  } catch {
    // Non-fatal
  }

  return NextResponse.json(payload)
}
