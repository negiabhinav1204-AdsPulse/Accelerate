/**
 * POST /api/campaign/worker
 *
 * QStash webhook — runs the full campaign agent pipeline asynchronously.
 * Called by Upstash QStash after a job is enqueued by /api/campaign/create.
 *
 * Security: QStash signature verified before any execution.
 * Progress: All agent events stored in Redis job store for frontend polling.
 */

import { NextRequest, NextResponse } from 'next/server';

import { Receiver } from '@upstash/qstash';
import { prisma } from '@workspace/database/client';

import { runCampaignAgents } from '~/lib/campaign/agents';
import type { AgentEvent, UserPreferences } from '~/lib/campaign/agents';
import { appendJobEvent, updateJob } from '~/lib/job-store';
import type { MediaPlan } from '~/lib/campaign/transformers';
import {
  extractDomain,
  getMemoryNode,
  isBrandCacheValid,
  loadOrgMemory,
  pruneMemory,
  upsertMemoryNode
} from '~/lib/memory/memory-service';
import { orgKey, redis } from '~/lib/redis';

// Vercel function timeout — 300s on Enterprise, 60s on Pro (QStash retries on timeout)
export const maxDuration = 300;

type WorkerPayload = {
  jobId: string;
  url: string;
  organizationId: string;
  userId: string;
  userPreferences?: UserPreferences;
};

async function generateCampaignImages(
  mediaPlan: MediaPlan,
  /** Product-specific image prompts from the Creative Agent */
  creativeImagePrompts: string[],
  /** Real product images scraped from the product page — if present, used instead of AI generation */
  realProductImages: string[],
  enqueue: (event: AgentEvent) => void
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;

  const brandName = mediaPlan.summary?.brandName ?? '';
  let promptIndex = 0;

  for (const platform of mediaPlan.platforms) {
    for (const adType of platform.adTypes) {
      const normalizedType = adType.adType.toLowerCase();
      if (['search', 'rsa'].includes(normalizedType)) continue;

      const imageUrls: string[] = [];

      for (let i = 0; i < Math.min(adType.ads.length, 3); i++) {
        const ad = adType.ads[i]!;

        // ── Priority 1: real product image already on the ad (applied in agents.ts) ──
        if (ad.imageUrls.length > 0) {
          imageUrls.push(ad.imageUrls[0]!);
          continue;
        }

        // ── Priority 2: real product image scraped from the page ──
        if (realProductImages.length > 0) {
          imageUrls.push(realProductImages[i % realProductImages.length]!);
          continue;
        }

        // ── Priority 3: AI generation (only when no real image is available) ──
        if (!apiKey) continue;

        const aspectRatio =
          normalizedType.includes('stories') || normalizedType.includes('reels')
            ? '9:16'
            : platform.platform === 'meta'
            ? '1:1'
            : '16:9';

        const creativePrompt = creativeImagePrompts[promptIndex % Math.max(creativeImagePrompts.length, 1)];
        promptIndex++;

        const prompt = creativePrompt
          ? `${creativePrompt}. Aspect ratio ${aspectRatio}. High quality commercial photography, no text overlay, clean composition suitable for digital advertising.`
          : `Professional product advertisement for ${brandName}. Product: ${ad.headlines[0] ?? brandName}. ${ad.descriptions[0] ?? ''}. Aspect ratio ${aspectRatio}. Show the actual product prominently, no text.`;

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any
          });

          const parts = result.response.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            const pd = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
            if (pd?.mimeType?.startsWith('image/') && pd.data) {
              imageUrls.push(`data:${pd.mimeType};base64,${pd.data}`);
              break;
            }
          }
        } catch { /* non-fatal */ }
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

  const notes = (userPreferences as { notes?: string }).notes ?? '';
  const SEASONAL_TERMS = [
    'diwali', 'holi', 'eid', 'christmas', 'black friday', 'sale',
    'new year', 'independence day', 'navratri', 'puja', 'festive'
  ];
  const matchedSeason = SEASONAL_TERMS.find((t) =>
    notes.toLowerCase().includes(t)
  );
  if (matchedSeason) {
    await upsertMemoryNode({
      orgId,
      userId,
      type: 'seasonal_intent',
      key: matchedSeason,
      summary: `User created a ${matchedSeason} campaign: "${notes.slice(0, 200)}"`,
      content: {
        season: matchedSeason,
        userNote: notes,
        campaignName: mediaPlan.campaignName,
        createdAt: new Date().toISOString()
      }
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify QStash signature ──────────────────────────────────────────────
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (currentSigningKey && nextSigningKey) {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const rawBody = await request.text();
    const signature = request.headers.get('upstash-signature') ?? '';

    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      console.error('[worker] QStash signature verification failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Re-parse from verified raw body
    let payload: WorkerPayload;
    try {
      payload = JSON.parse(rawBody) as WorkerPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    return runWorker(payload);
  }

  // Dev mode: no signing keys set, trust the request
  const payload = (await request.json()) as WorkerPayload;
  return runWorker(payload);
}

async function runWorker(payload: WorkerPayload): Promise<NextResponse> {
  const { jobId, url, organizationId, userId, userPreferences } = payload;

  await updateJob(jobId, { status: 'running' });

  // Redis enqueue — uses RPUSH (atomic) so concurrent agent calls don't race
  const enqueue = (event: AgentEvent): void => {
    void appendJobEvent(jobId, event as unknown as { type: string; [key: string]: unknown }).catch(() => {});
  };

  try {
    // ── 2. Load connected accounts ────────────────────────────────────────────
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

    // ── 3. Load memory context ────────────────────────────────────────────────
    const domain = extractDomain(url);
    const [brandMemory, userPreferencesMemory] = await Promise.all([
      getMemoryNode(organizationId, undefined, 'brand_profile', domain),
      loadOrgMemory(organizationId, userId, [
        'campaign_preference',
        'media_plan_feedback',
        'seasonal_intent',
        'creative_preference'
      ])
    ]);

    const enrichedPreferences = {
      ...userPreferences,
      _brandMemory:
        brandMemory && isBrandCacheValid(brandMemory)
          ? brandMemory.content
          : null,
      _userMemory: userPreferencesMemory.map((n) => ({
        type: n.type,
        key: n.key,
        content: n.content
      }))
    };

    // ── 4. Run agent pipeline ─────────────────────────────────────────────────
    const result = await runCampaignAgents({
      url,
      organizationId,
      connectedAccounts,
      userPreferences: enrichedPreferences,
      enqueue
    });

    const { mediaPlan, productImages: realProductImages, agentOutputs } = result;

    if (!mediaPlan) {
      await updateJob(jobId, { status: 'failed', error: 'No media plan generated' });
      return NextResponse.json({ ok: true });
    }

    // ── 5. Save campaign to DB ────────────────────────────────────────────────
    try {
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
          agentOutputs: (agentOutputs as object) ?? undefined
        },
        select: { id: true }
      });

      // Invalidate campaigns list cache
      void redis.del(
        orgKey(organizationId, 'campaigns:all:p1'),
        orgKey(organizationId, 'campaigns:accelerate:p1')
      ).catch(() => {});

      // Mark job complete — media_plan event is included here so it is
      // guaranteed written to the events list BEFORE status becomes 'completed'.
      // This prevents the frontend from stopping its poll before receiving the plan.
      await updateJob(jobId, {
        status: 'completed',
        campaignId: campaign.id,
        event: {
          type: 'media_plan',
          plan: { ...mediaPlan, _campaignId: campaign.id }
        }
      });

      // ── 6. Generate images (fire-and-forget after job marked complete) ───────
      const creativeImagePrompts = (agentOutputs?.creative as { imagePrompts?: string[] } | undefined)?.imagePrompts ?? [];
      void generateCampaignImages(mediaPlan, creativeImagePrompts, realProductImages ?? [], enqueue).catch(() => {});

      // ── 7. Save memory nodes ─────────────────────────────────────────────────
      void saveCampaignMemory({
        orgId: organizationId,
        userId,
        domain,
        mediaPlan,
        userPreferences: (userPreferences as Record<string, unknown>) ?? {}
      }).catch(() => {});

      void pruneMemory(organizationId).catch(() => {});
    } catch (dbErr) {
      console.error('[worker] DB save failed:', dbErr);
      await updateJob(jobId, {
        status: 'failed',
        error: 'Failed to save campaign'
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Campaign agent pipeline failed';
    enqueue({ type: 'error', message });
    await updateJob(jobId, { status: 'failed', error: message });
  }

  return NextResponse.json({ ok: true });
}
