/**
 * GET /api/optimization
 *
 * Generates data-driven optimization recommendations from real campaign
 * performance data (AdPlatformReport). No mock data — returns empty array
 * if no synced data exists.
 *
 * Query params:
 *   orgId (required)
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { prisma } from '@workspace/database/client'

type RecommendationCategory = 'budget' | 'bid' | 'creative' | 'audience' | 'anomaly' | 'pacing'
type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW'

type Recommendation = {
  id: string
  priority: RecommendationPriority
  category: RecommendationCategory
  campaign: string
  platform: string
  title: string
  reason: string
  estimated_impact: string
  dismissed: boolean
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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

  // Aggregate per campaign: 30d, 14d, 2d windows
  type CampaignAgg = {
    id: string
    name: string
    platform: string
    spend30: number
    spend14: number
    spend2: number
    impressions30: number
    clicks30: number
    conversions30: number
    convValue30: number
    cpc30: number[]  // daily CPC values for spike detection
  }

  const campaignMap = new Map<string, CampaignAgg>()

  function getOrCreate(id: string, name: string, platform: string): CampaignAgg {
    if (!campaignMap.has(id)) {
      campaignMap.set(id, { id, name, platform, spend30: 0, spend14: 0, spend2: 0, impressions30: 0, clicks30: 0, conversions30: 0, convValue30: 0, cpc30: [] })
    }
    return campaignMap.get(id)!
  }

  // Process Meta rows
  for (const report of metaReports) {
    for (const row of (report.data as Record<string, unknown>[]) ?? []) {
      const cid = String(row.campaign_id ?? '')
      const cname = String(row.campaign_name ?? '')
      const date = String(row.date_start ?? '')
      if (!cid || !date || date < thirtyDaysAgo) continue

      const spend = parseFloat(String(row.spend ?? 0))
      const impr = parseInt(String(row.impressions ?? 0), 10)
      const clks = parseInt(String(row.clicks ?? 0), 10)
      const purchases = ((row.actions as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
      const purchaseValue = ((row.action_values as { action_type: string; value: string }[] | undefined) ?? [])
        .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase')
        .reduce((s, a) => s + parseFloat(a.value || '0'), 0)

      const agg = getOrCreate(cid, cname, 'meta')
      agg.spend30 += spend
      agg.impressions30 += impr
      agg.clicks30 += clks
      agg.conversions30 += purchases
      agg.convValue30 += purchaseValue
      if (date >= fourteenDaysAgo) agg.spend14 += spend
      if (date >= twoDaysAgo) agg.spend2 += spend
      if (clks > 0) agg.cpc30.push(spend / clks)
    }
  }

  // Process Google rows
  for (const report of googleReports) {
    for (const row of (report.data as Record<string, unknown>[]) ?? []) {
      const nested = row.metrics as Record<string, unknown> | undefined
      const cid = (row.campaign as Record<string, string> | undefined)?.id ?? String(row.campaignId ?? '')
      const cname = (row.campaign as Record<string, string> | undefined)?.name ?? String(row.campaignName ?? '')
      const date = (row.segments as Record<string, string> | undefined)?.date ?? String(row.date ?? '')
      if (!cid || !date || date < thirtyDaysAgo) continue

      const costMicros = parseFloat(String(nested?.costMicros ?? nested?.cost_micros ?? row.costMicros ?? 0))
      const spend = costMicros / 1_000_000
      const impr = parseInt(String(nested?.impressions ?? row.impressions ?? 0), 10)
      const clks = parseInt(String(nested?.clicks ?? row.clicks ?? 0), 10)
      const convs = parseFloat(String(nested?.conversions ?? row.conversions ?? 0))
      const convValue = parseFloat(String(nested?.conversionsValue ?? row.conversionsValue ?? 0))

      const agg = getOrCreate(cid, cname, 'google')
      agg.spend30 += spend
      agg.impressions30 += impr
      agg.clicks30 += clks
      agg.conversions30 += convs
      agg.convValue30 += convValue
      if (date >= fourteenDaysAgo) agg.spend14 += spend
      if (date >= twoDaysAgo) agg.spend2 += spend
      if (clks > 0) agg.cpc30.push(spend / clks)
    }
  }

  if (campaignMap.size === 0) {
    return NextResponse.json({ recommendations: [], synced: false })
  }

  const recommendations: Recommendation[] = []
  let recIndex = 0

  for (const agg of campaignMap.values()) {
    const roas = agg.spend30 > 0 ? agg.convValue30 / agg.spend30 : 0
    const ctr = agg.impressions30 > 0 ? agg.clicks30 / agg.impressions30 : 0
    const avgCpc = agg.cpc30.length > 0 ? agg.cpc30.reduce((s, v) => s + v, 0) / agg.cpc30.length : 0

    // HIGH: Negative ROAS with significant spend (bleeder)
    if (agg.spend30 >= 500 && roas < 1.0 && agg.convValue30 > 0) {
      recommendations.push({
        id: `rec-${++recIndex}`,
        priority: 'HIGH',
        category: 'budget',
        campaign: agg.name,
        platform: agg.platform,
        title: `Pause '${agg.name}' — ROAS ${roas.toFixed(1)}x`,
        reason: `$${agg.spend30.toFixed(0)} spend with $${agg.convValue30.toFixed(0)} revenue over 30 days. ROAS below breakeven.`,
        estimated_impact: `Save ~$${(agg.spend30 / 30 * 30).toFixed(0)}/month`,
        dismissed: false,
      })
    }

    // HIGH: Zero conversions with significant spend
    if (agg.spend30 >= 200 && agg.conversions30 === 0) {
      recommendations.push({
        id: `rec-${++recIndex}`,
        priority: 'HIGH',
        category: 'budget',
        campaign: agg.name,
        platform: agg.platform,
        title: `'${agg.name}' — $${agg.spend30.toFixed(0)} spend, 0 conversions`,
        reason: `No conversions recorded in 30 days despite significant spend. Review targeting or landing page.`,
        estimated_impact: `Recover $${agg.spend30.toFixed(0)} in wasted spend`,
        dismissed: false,
      })
    }

    // HIGH: CPC spike in last 2 days vs 30-day average
    if (agg.cpc30.length >= 5 && agg.spend2 > 10) {
      const recentCpcs = agg.cpc30.slice(-4)
      const recentAvg = recentCpcs.reduce((s, v) => s + v, 0) / recentCpcs.length
      if (recentAvg > avgCpc * 1.5) {
        const spikePercent = Math.round(((recentAvg - avgCpc) / avgCpc) * 100)
        recommendations.push({
          id: `rec-${++recIndex}`,
          priority: 'HIGH',
          category: 'anomaly',
          campaign: agg.name,
          platform: agg.platform,
          title: `CPC spike +${spikePercent}% in last 48 hours`,
          reason: `CPC jumped from $${avgCpc.toFixed(2)} to $${recentAvg.toFixed(2)}. Possible auction pressure or bid change.`,
          estimated_impact: 'Prevent budget waste',
          dismissed: false,
        })
      }
    }

    // MEDIUM: Strong winner — scale budget
    if (agg.spend30 >= 100 && roas >= 3.0) {
      recommendations.push({
        id: `rec-${++recIndex}`,
        priority: 'MEDIUM',
        category: 'budget',
        campaign: agg.name,
        platform: agg.platform,
        title: `Scale '${agg.name}' +25% — ROAS ${roas.toFixed(1)}x`,
        reason: `Consistently strong ROAS over 30 days. Budget-limited winner with room to grow.`,
        estimated_impact: '+30–40% conversions',
        dismissed: false,
      })
    }

    // MEDIUM: Low CTR suggests bid or audience mismatch
    if (agg.impressions30 >= 10000 && ctr < 0.01 && agg.spend30 >= 100) {
      recommendations.push({
        id: `rec-${++recIndex}`,
        priority: 'MEDIUM',
        category: 'bid',
        campaign: agg.name,
        platform: agg.platform,
        title: `Low CTR ${(ctr * 100).toFixed(2)}% — review bids or creative`,
        reason: `${agg.impressions30.toLocaleString()} impressions but only ${(ctr * 100).toFixed(2)}% CTR. Consider refreshing creative or tightening audience.`,
        estimated_impact: 'Improve click efficiency',
        dismissed: false,
      })
    }

    // LOW: Old campaign with no recent spend — may be paused
    if (agg.spend30 >= 100 && agg.spend14 === 0) {
      recommendations.push({
        id: `rec-${++recIndex}`,
        priority: 'LOW',
        category: 'pacing',
        campaign: agg.name,
        platform: agg.platform,
        title: `'${agg.name}' — no spend in 14 days`,
        reason: `Campaign had $${agg.spend30.toFixed(0)} spend in the past 30 days but went dark recently. May be paused or budget exhausted.`,
        estimated_impact: 'Resume to capture demand',
        dismissed: false,
      })
    }
  }

  // Sort: HIGH → MEDIUM → LOW, then by spend descending
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return NextResponse.json({ recommendations, synced: true, campaignCount: campaignMap.size })
}
