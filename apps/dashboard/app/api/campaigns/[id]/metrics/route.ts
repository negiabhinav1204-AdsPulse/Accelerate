/**
 * GET /api/campaigns/[id]/metrics
 *
 * Returns real aggregated performance metrics for a campaign from synced
 * AdPlatformReport data (Meta campaign_insights_daily + Google campaign).
 *
 * Query params:
 *   orgId    (required)
 *   days     — look-back window in days (default 30)
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { prisma } from '@workspace/database/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: campaignId } = await params
  const { searchParams } = request.nextUrl

  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)))

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch Meta and Google campaign reports
  const [metaReports, googleReports] = await Promise.all([
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign_insights_daily', archivedAt: null },
      select: { data: true }
    }),
    prisma.adPlatformReport.findMany({
      where: { organizationId: orgId, reportType: 'campaign', platform: 'GOOGLE', archivedAt: null },
      select: { data: true }
    })
  ])

  let spend = 0
  let impressions = 0
  let clicks = 0
  let conversions = 0
  let conversionValue = 0
  let found = false

  // Meta: match by campaign_id
  for (const report of metaReports) {
    for (const row of (report.data as Record<string, unknown>[]) ?? []) {
      const cid = String(row.campaign_id ?? '')
      if (cid !== campaignId) continue
      const dateStr = String(row.date_start ?? '')
      if (dateStr && dateStr < dateFrom) continue
      found = true
      spend += parseFloat(String(row.spend ?? 0))
      impressions += parseInt(String(row.impressions ?? 0), 10)
      clicks += parseInt(String(row.clicks ?? 0), 10)
      const purchases = ((row.actions as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
      conversions += purchases
      const purchaseValue = ((row.action_values as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
      conversionValue += purchaseValue
    }
  }

  // Google: match by campaign.id or campaignId
  for (const report of googleReports) {
    for (const row of (report.data as Record<string, unknown>[]) ?? []) {
      const nested = row.metrics as Record<string, unknown> | undefined
      const cid = (row.campaign as Record<string, string> | undefined)?.id ?? String(row.campaignId ?? '')
      if (cid !== campaignId) continue
      const date = (row.segments as Record<string, string> | undefined)?.date ?? String(row.date ?? '')
      if (date && date < dateFrom) continue
      found = true
      const costMicros = parseFloat(String(nested?.costMicros ?? nested?.cost_micros ?? row.costMicros ?? 0))
      spend += costMicros / 1_000_000
      impressions += parseInt(String(nested?.impressions ?? row.impressions ?? 0), 10)
      clicks += parseInt(String(nested?.clicks ?? row.clicks ?? 0), 10)
      conversions += parseFloat(String(nested?.conversions ?? row.conversions ?? 0))
      conversionValue += parseFloat(String(nested?.conversionsValue ?? row.conversionsValue ?? 0))
    }
  }

  if (!found) {
    return NextResponse.json({ error: 'No metrics data found for this campaign' }, { status: 404 })
  }

  const roas = spend > 0 ? conversionValue / spend : 0
  const ctr = impressions > 0 ? clicks / impressions : 0
  const cpc = clicks > 0 ? spend / clicks : 0

  return NextResponse.json({
    spend,
    revenue: conversionValue,
    roas,
    conversions,
    impressions,
    clicks,
    ctr,
    cpc,
    days,
  })
}
