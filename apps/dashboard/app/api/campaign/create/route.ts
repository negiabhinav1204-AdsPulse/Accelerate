/**
 * POST /api/campaign/create
 *
 * Streams campaign agent events via newline-delimited JSON (SSE-style).
 * After the media_plan event is streamed, the campaign is saved as DRAFT to the DB.
 *
 * Body: { url: string; organizationId: string; userPreferences?: UserPreferences }
 * Auth: required
 */

import { NextRequest } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { runCampaignAgents } from '~/lib/campaign/agents';
import type { AgentEvent, UserPreferences } from '~/lib/campaign/agents';
import type { MediaPlan } from '~/lib/campaign/transformers';
import {
  getMemoryNode,
  upsertMemoryNode,
  loadOrgMemory,
  pruneMemory,
  isBrandCacheValid,
  extractDomain,
  type MemoryNode
} from '~/lib/memory/memory-service';

type RequestBody = {
  url: string;
  organizationId: string;
  userPreferences?: UserPreferences;
};

/**
 * Call Gemini 2.0 Flash (image generation) for each visual ad type.
 * Streams `image_update` events back via `enqueue`.
 */
async function generateCampaignImages(
  mediaPlan: MediaPlan,
  enqueue: (event: import('~/lib/campaign/agents').AgentEvent) => void
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

  const brandName = mediaPlan.summary?.brandName ?? '';

  for (const platform of mediaPlan.platforms) {
    for (const adType of platform.adTypes) {
      // Skip search/text-only ad types — no images needed
      const normalizedType = adType.adType.toLowerCase();
      if (['search', 'rsa'].includes(normalizedType)) continue;

      // Determine aspect ratio from platform/adType
      const aspectRatio =
        normalizedType.includes('stories') || normalizedType.includes('reels')
          ? '9:16'
          : platform.platform === 'meta'
          ? '1:1'
          : '16:9';

      // Build one prompt per ad (up to 3)
      const imageUrls: string[] = [];

      for (const ad of adType.ads.slice(0, 3)) {
        const headline = ad.headlines[0] ?? brandName;
        const description = ad.descriptions[0] ?? '';
        const prompt = `Professional advertising photograph for ${brandName}. ${headline}. ${description}. Aspect ratio ${aspectRatio}. High quality commercial photography, no text, clean composition.`;

        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any,
          });

          const parts = result.response.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            const pd = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
            if (pd?.mimeType?.startsWith('image/') && pd.data) {
              imageUrls.push(`data:${pd.mimeType};base64,${pd.data}`);
              break;
            }
          }
        } catch {
          // Non-fatal per ad
        }
      }

      if (imageUrls.length > 0) {
        enqueue({
          type: 'image_update',
          platformAdTypeKey: `${platform.platform}:${adType.adType}`,
          imageUrls
        });
      }
    }
  }
}

async function saveCampaignMemory(params: {
  orgId: string;
  userId: string;
  domain: string;
  mediaPlan: MediaPlan;
  userPreferences: Record<string, unknown>;
}): Promise<void> {
  const { orgId, userId, domain, mediaPlan, userPreferences } = params;

  // Save brand profile (org-level)
  await upsertMemoryNode({
    orgId,
    type: 'brand_profile',
    key: domain,
    summary: `Brand profile for ${mediaPlan.summary?.brandName ?? domain}: ${mediaPlan.objective} campaigns, targeting ${mediaPlan.targetAudience?.locations?.join(', ') ?? 'global'}, currency ${mediaPlan.currency}`,
    content: {
      brandName: mediaPlan.summary?.brandName,
      domain,
      currency: mediaPlan.currency,
      targetCountry: mediaPlan.targetAudience?.locations?.[0],
      objective: mediaPlan.objective
    },
    sourceUrl: `https://${domain}`
  });

  // Save campaign preference (user-level)
  const platforms = mediaPlan.platforms.map((p) => p.platform);
  await upsertMemoryNode({
    orgId,
    userId,
    type: 'campaign_preference',
    key: `${userId}_prefs`,
    summary: `User prefers ${platforms.join(', ')} campaigns with ${mediaPlan.currency} ${mediaPlan.totalBudget} budget over ${mediaPlan.duration} days for ${mediaPlan.objective} objective`,
    content: {
      preferredPlatforms: platforms,
      typicalBudget: mediaPlan.totalBudget,
      currency: mediaPlan.currency,
      typicalDuration: mediaPlan.duration,
      preferredObjective: mediaPlan.objective,
      lastCreatedAt: new Date().toISOString()
    }
  });

  // Save seasonal intent if detected in user notes
  const notes = (userPreferences as { notes?: string }).notes ?? '';
  const SEASONAL_TERMS = ['diwali', 'holi', 'eid', 'christmas', 'black friday', 'sale', 'new year', 'independence day', 'navratri', 'puja', 'festive'];
  const matchedSeason = SEASONAL_TERMS.find((t) => notes.toLowerCase().includes(t));
  if (matchedSeason) {
    await upsertMemoryNode({
      orgId,
      userId,
      type: 'seasonal_intent',
      key: matchedSeason,
      summary: `User created a ${matchedSeason} campaign: "${notes.slice(0, 200)}"`,
      content: { season: matchedSeason, userNote: notes, campaignName: mediaPlan.campaignName, createdAt: new Date().toISOString() }
    });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { url, organizationId, userPreferences } = body;

  if (!url || typeof url !== 'string') {
    return new Response('url is required', { status: 400 });
  }
  if (!organizationId || typeof organizationId !== 'string') {
    return new Response('organizationId is required', { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return new Response('url must be a valid URL', { status: 400 });
  }

  // Verify user is a member of the organization
  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId: userId }
  });
  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  // Load connected ad accounts for this organization
  // accessToken is included so the competitor agent can query the Meta Ad Library
  const connectedAccounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId, status: 'connected', archivedAt: null },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      isDefault: true,
      status: true,
      currency: true,
      timezone: true,
      accessToken: true
    }
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
        } catch {
          // Stream may be closed if client disconnected
        }
      };

      let mediaPlan: MediaPlan | null = null;
      let agentOutputs: Record<string, unknown> | null = null;
      const domain = extractDomain(url);

      try {
        // Load org memory context
        const [brandMemory, userPreferencesMemory] = await Promise.all([
          getMemoryNode(organizationId, undefined, 'brand_profile', domain),
          userId ? loadOrgMemory(organizationId, userId, ['campaign_preference', 'media_plan_feedback', 'seasonal_intent', 'creative_preference']) : Promise.resolve([])
        ]);

        // Inject memory context into user preferences
        const enrichedPreferences = {
          ...userPreferences,
          _brandMemory: brandMemory && isBrandCacheValid(brandMemory) ? brandMemory.content : null,
          _userMemory: userPreferencesMemory.map((n) => ({ type: n.type, key: n.key, content: n.content }))
        };

        const result = await runCampaignAgents({
          url,
          organizationId,
          connectedAccounts,
          userPreferences: enrichedPreferences,
          enqueue
        });
        mediaPlan = result.mediaPlan;
        agentOutputs = result.agentOutputs as unknown as Record<string, unknown>;
      } catch (err) {
        if (err instanceof Error && err.message === 'CONFLICT_DETECTED') {
          // Pipeline paused for user confirmation — conflict_check was already enqueued
          controller.close();
          return;
        }
        const message = err instanceof Error ? err.message : 'Campaign agent pipeline failed';
        enqueue({ type: 'error', message });
        controller.close();
        return;
      }

      // Save campaign as DRAFT after streaming completes
      if (mediaPlan) {
        try {
          // Generate ACCE-ID
          const acceCount = await prisma.campaign.count({
            where: { organizationId, source: 'accelerate' }
          });
          const acceId = `ACCE-${String(acceCount + 1).padStart(2, '0')}`;

          const campaign = await prisma.campaign.create({
            data: {
              organizationId,
              createdBy: userId,
              name: mediaPlan.campaignName,
              sourceUrl: url,
              objective: mediaPlan.objective,
              status: 'DRAFT',
              source: 'accelerate',
              acceId,
              totalBudget: mediaPlan.totalBudget,
              currency: mediaPlan.currency,
              startDate: mediaPlan.startDate ? new Date(mediaPlan.startDate) : null,
              endDate: mediaPlan.endDate ? new Date(mediaPlan.endDate) : null,
              targetAudience: mediaPlan.targetAudience as object,
              mediaPlan: mediaPlan as object,
              agentOutputs: agentOutputs ?? undefined
            },
            select: { id: true }
          });

          // Stream the campaign ID so the client can navigate
          enqueue({
            type: 'media_plan',
            plan: { ...mediaPlan, _campaignId: campaign.id } as MediaPlan & { _campaignId: string }
          });

          // Save memory nodes (fire-and-forget, non-fatal)
          void saveCampaignMemory({
            orgId: organizationId,
            userId,
            domain,
            mediaPlan,
            userPreferences: userPreferences ?? {}
          }).catch(() => {});

          // Prune low-confidence nodes
          void pruneMemory(organizationId).catch(() => {});
        } catch (dbErr) {
          console.error('[campaign/create] DB save failed:', dbErr);
          // Non-fatal — client already has the media plan from the earlier media_plan event
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no'
    }
  });
}
