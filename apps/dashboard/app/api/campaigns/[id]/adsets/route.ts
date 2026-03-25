/**
 * GET /api/campaigns/[id]/adsets
 *
 * Returns ad sets (and nested ads + creatives) for a given campaign.
 * Supports both Accelerate-managed campaigns and external (Meta-synced) campaigns.
 *
 * Query params:
 *   orgId    (required)
 *   source   — 'accelerate' | 'external'
 *   platform — e.g. 'meta'
 */

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@workspace/auth'
import { prisma } from '@workspace/database/client'

type MetaAdSet = {
  id: string
  name: string
  status: string
  campaign_id: string
  daily_budget?: string
  optimization_goal?: string
  targeting?: Record<string, unknown>
}

type MetaAd = {
  id: string
  name: string
  status: string
  campaign_id: string
  adset_id: string
  creative?: { id: string }
}

type MetaAdCreative = {
  id: string
  title?: string
  body?: string
  image_url?: string
  thumbnail_url?: string
  call_to_action_type?: string
  object_url?: string
}

type MetaCampaignRow = {
  id: string
  name: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = request.nextUrl

  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const source = searchParams.get('source') ?? 'external'
  const platform = searchParams.get('platform') ?? 'meta'

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (source === 'external') {
    const reports = await prisma.adPlatformReport.findMany({
      where: {
        organizationId: orgId,
        reportType: { in: ['adsets', 'ads', 'adcreatives', 'campaigns'] },
        platform: 'META'
      },
      select: {
        reportType: true,
        data: true
      }
    })

    const adsetsReport = reports.find((r) => r.reportType === 'adsets')
    const adsReport = reports.find((r) => r.reportType === 'ads')
    const creativesReport = reports.find((r) => r.reportType === 'adcreatives')
    const campaignsReport = reports.find((r) => r.reportType === 'campaigns')

    const allAdSets = (adsetsReport?.data as MetaAdSet[]) ?? []
    const allAds = (adsReport?.data as MetaAd[]) ?? []
    const allCreatives = (creativesReport?.data as MetaAdCreative[]) ?? []
    const allCampaigns = (campaignsReport?.data as MetaCampaignRow[]) ?? []

    const adSets = allAdSets.filter((a) => a.campaign_id === id)
    const campaignAds = allAds.filter((a) => a.campaign_id === id)

    const creativesById = new Map(allCreatives.map((c) => [c.id, c]))

    const campaignName =
      allCampaigns.find((c) => c.id === id)?.name ?? id

    const adSetItems = adSets.map((adset) => {
      const setAds = campaignAds.filter((a) => a.adset_id === adset.id)

      return {
        id: adset.id,
        name: adset.name,
        status: adset.status?.toLowerCase(),
        dailyBudget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : 0,
        optimizationGoal: adset.optimization_goal,
        targeting: adset.targeting ?? {},
        ads: setAds.map((ad) => {
          const creativeId = ad.creative?.id
          const matchedCreative = creativeId ? creativesById.get(creativeId) : null

          return {
            id: ad.id,
            name: ad.name,
            status: ad.status?.toLowerCase(),
            creative: matchedCreative
              ? {
                  id: matchedCreative.id,
                  title: matchedCreative.title ?? null,
                  body: matchedCreative.body ?? null,
                  imageUrl: matchedCreative.image_url ?? null,
                  thumbnailUrl: matchedCreative.thumbnail_url ?? null,
                  callToActionType: matchedCreative.call_to_action_type ?? null,
                  objectUrl: matchedCreative.object_url ?? null
                }
              : null
          }
        })
      }
    })

    return NextResponse.json({
      campaignId: id,
      campaignName,
      platform: 'meta',
      adSets: adSetItems
    })
  }

  // source === 'accelerate'
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: orgId },
    include: {
      platformCampaigns: {
        where: platform ? { platform } : undefined,
        include: {
          adGroups: {
            include: {
              ads: {
                select: {
                  id: true,
                  headlines: true,
                  descriptions: true,
                  imageUrls: true,
                  status: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const adSets = campaign.platformCampaigns.flatMap((pc) =>
    pc.adGroups.map((group) => ({
      id: group.id,
      name: group.name,
      status: group.status,
      dailyBudget: Number(pc.budget),
      optimizationGoal: null,
      targeting: {},
      ads: group.ads.map((ad) => ({
        id: ad.id,
        name: ad.headlines[0] ?? ad.id,
        status: ad.status,
        creative: {
          id: ad.id,
          title: ad.headlines[0] ?? null,
          body: ad.descriptions[0] ?? null,
          imageUrl: ad.imageUrls[0] ?? null,
          thumbnailUrl: null,
          callToActionType: null,
          objectUrl: null
        }
      }))
    }))
  )

  return NextResponse.json({
    campaignId: id,
    campaignName: campaign.name,
    platform,
    adSets
  })
}
