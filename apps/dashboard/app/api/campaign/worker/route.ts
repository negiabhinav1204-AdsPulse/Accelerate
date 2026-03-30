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
  /** Campaign DB id — used to persist generated images so detail page shows them immediately */
  campaignId: string,
  enqueue: (event: AgentEvent) => void
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  // No key → leave imageUrls empty; client-side /api/campaign/generate-images handles it
  if (!apiKey) return;

  const brandName = mediaPlan.summary?.brandName ?? '';
  let promptIndex = 0;
  let anyGenerated = false;

  for (const platform of mediaPlan.platforms) {
    for (const adType of platform.adTypes) {
      const normalizedType = adType.adType.toLowerCase();
      if (['search', 'rsa'].includes(normalizedType)) continue;

      const imageUrls: string[] = [];

      for (let i = 0; i < Math.min(adType.ads.length, 3); i++) {
        const ad = adType.ads[i]!;

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
          : `Professional lifestyle advertisement for ${brandName}. Product: ${ad.headlines[0] ?? brandName}. ${ad.descriptions[0] ?? ''}. Aspect ratio ${aspectRatio}. Show a person using or wearing the product in a realistic everyday setting, no text overlay.`;

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio }
              })
            }
          );
          const data = (await res.json()) as { predictions?: { bytesBase64Encoded: string; mimeType: string }[] };
          const prediction = data.predictions?.[0];
          if (prediction?.bytesBase64Encoded) {
            const url = `data:${prediction.mimeType ?? 'image/png'};base64,${prediction.bytesBase64Encoded}`;
            imageUrls.push(url);
            // Write into the mediaPlan in-place so the DB update below captures it
            ad.imageUrls = [url];
            anyGenerated = true;
          }
        } catch { /* non-fatal — client-side generation handles missing slots */ }
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

  // Persist generated images to DB so campaign detail shows them on every subsequent view
  if (anyGenerated) {
    try {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { mediaPlan: mediaPlan as object }
      });
    } catch { /* non-fatal */ }
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

      // ── 6. Fire media_plan event FIRST so the frontend sets mediaPlan to non-null,
      // THEN generate images which fires image_update events.
      //
      // ORDER MATTERS: image_update handlers guard `if (!prev) return prev` — they
      // are silently dropped while mediaPlan is null. media_plan must land in Redis
      // BEFORE image_update events so the frontend processes them in correct order:
      //   media_plan → mediaPlan non-null
      //   image_update × N → images applied to non-null mediaPlan
      const planForEvent = {
        ...mediaPlan,
        _campaignId: campaign.id,
        platforms: mediaPlan.platforms.map((p) => ({
          ...p,
          adTypes: p.adTypes.map((at) => ({
            ...at,
            ads: at.ads.map((ad) => ({ ...ad, imageUrls: [] }))
          }))
        }))
      };
      await appendJobEvent(jobId, { type: 'media_plan', plan: planForEvent } as { type: string; [key: string]: unknown });

      // Generate images — each image_update event is appended AFTER media_plan
      const creativeImagePrompts = (agentOutputs?.creative as { imagePrompts?: string[] } | undefined)?.imagePrompts ?? [];
      await generateCampaignImages(mediaPlan, creativeImagePrompts, campaign.id, enqueue);

      // Mark job complete (no event — media_plan already appended above)
      await updateJob(jobId, { status: 'completed', campaignId: campaign.id });

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
