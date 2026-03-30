import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { verifyQStashSignature } from '../lib/qstash';
import { appendJobEvent, updateJob } from '../lib/job-store';
import { uploadImageToGCS } from '../lib/gcs';
import { redis, orgKey } from '../lib/redis';
import { prisma } from '../lib/db';
import { runCampaignAgents } from '../agents/pipeline';
import type { AgentEvent, UserPreferences } from '../agents/pipeline';
import type { MediaPlan } from '../agents/transformers';
import {
  extractDomain,
  getMemoryNode,
  isBrandCacheValid,
  loadOrgMemory,
  pruneMemory,
  upsertMemoryNode,
} from '../lib/memory/memory-service';

const payloadSchema = z.object({
  jobId: z.string(),
  url: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  userPreferences: z.record(z.unknown()).optional(),
});

async function generateCampaignImages(
  mediaPlan: MediaPlan,
  campaignId: string,
  /** Awaitable append — ensures each image_update lands in Redis before job completes */
  appendEvent: (event: AgentEvent) => Promise<void>
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const brandName = mediaPlan.summary?.brandName ?? '';
  let anyGenerated = false;

  for (const platform of mediaPlan.platforms) {
    for (const adType of platform.adTypes) {
      const normalizedType = adType.adType.toLowerCase();
      if (['search', 'rsa'].includes(normalizedType)) continue;

      const aspectRatio =
        normalizedType.includes('stories') || normalizedType.includes('reels')
          ? '9:16'
          : platform.platform === 'meta'
          ? '1:1'
          : '16:9';

      const imageUrls: string[] = [];

      for (const ad of adType.ads.slice(0, 3)) {
        // Use ad.imagePrompt (set per-ad by the strategy agent with seasonal/contextual context).
        // Fall back to generic lifestyle prompt if field is absent.
        const adPrompt = (ad as { imagePrompt?: string }).imagePrompt;
        const prompt = adPrompt
          ? `${adPrompt}. Aspect ratio ${aspectRatio}. High quality commercial photography, no text overlay, clean composition suitable for digital advertising.`
          : `Professional lifestyle advertisement for ${brandName}. ${ad.headlines[0] ?? brandName}. ${ad.descriptions[0] ?? ''}. Aspect ratio ${aspectRatio}. No text overlay.`;

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio },
              }),
            }
          );
          const data = (await res.json()) as { predictions?: { bytesBase64Encoded: string; mimeType: string }[] };
          const prediction = data.predictions?.[0];
          if (prediction?.bytesBase64Encoded) {
            const mime = prediction.mimeType ?? 'image/png';
            const gcsUrl = await uploadImageToGCS(prediction.bytesBase64Encoded, mime);
            const url = gcsUrl ?? `data:${mime};base64,${prediction.bytesBase64Encoded}`;
            imageUrls.push(url);
            ad.imageUrls = [url];
            anyGenerated = true;
          }
        } catch {
          // Non-fatal per ad
        }
      }

      if (imageUrls.length > 0) {
        // Await so the Redis write is confirmed before next iteration / job completion
        await appendEvent({
          type: 'image_update',
          platformAdTypeKey: `${platform.platform}:${adType.adType}`,
          imageUrls,
        } as AgentEvent);
      }
    }
  }

  if (anyGenerated) {
    try {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { mediaPlan: mediaPlan as object },
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
      objective: mediaPlan.objective,
    },
    sourceUrl: `https://${domain}`,
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
      lastCreatedAt: new Date().toISOString(),
    },
  });

  const notes = (userPreferences as { notes?: string }).notes ?? '';
  const SEASONAL_TERMS = [
    'diwali', 'holi', 'eid', 'christmas', 'black friday', 'sale',
    'new year', 'independence day', 'navratri', 'puja', 'festive',
  ];
  const matchedSeason = SEASONAL_TERMS.find((t) => notes.toLowerCase().includes(t));
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
        createdAt: new Date().toISOString(),
      },
    });
  }
}

export async function runRoute(fastify: FastifyInstance) {
  fastify.post('/run', async (request, reply) => {
    const isValid = await verifyQStashSignature(request);
    if (!isValid) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = payloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload', details: parsed.error.issues });
    }

    const { jobId, url, organizationId, userId, userPreferences } = parsed.data;

    await updateJob(jobId, { status: 'running' });

    const enqueue = (event: AgentEvent): void => {
      void updateJob(jobId, { event: event as unknown as { type: string; [key: string]: unknown } }).catch(() => {});
    };

    // Run pipeline async — return 200 immediately so QStash doesn't retry
    void (async () => {
      try {
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
            accessToken: true,
          },
        });

        const domain = extractDomain(url);
        const [brandMemory, userPreferencesMemory] = await Promise.all([
          getMemoryNode(organizationId, undefined, 'brand_profile', domain),
          loadOrgMemory(organizationId, userId, [
            'campaign_preference',
            'media_plan_feedback',
            'seasonal_intent',
            'creative_preference',
          ]),
        ]);

        const enrichedPreferences = {
          ...userPreferences,
          _brandMemory:
            brandMemory && isBrandCacheValid(brandMemory) ? brandMemory.content : null,
          _userMemory: userPreferencesMemory.map((n) => ({
            type: n.type,
            key: n.key,
            content: n.content,
          })),
        };

        const result = await runCampaignAgents({
          url,
          organizationId,
          connectedAccounts,
          userPreferences: enrichedPreferences as UserPreferences,
          enqueue,
        });

        const { mediaPlan, agentOutputs } = result;

        if (!mediaPlan) {
          await updateJob(jobId, { status: 'failed', error: 'No media plan generated' });
          return;
        }

        try {
          const acceCount = await prisma.campaign.count({
            where: { organizationId, source: 'accelerate' },
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
              agentOutputs: (agentOutputs as object) ?? undefined,
            },
            select: { id: true },
          });

          // Strip imageUrls from event — images sent via separate image_update events.
          // This keeps the Redis payload small (base64 images can be 10–20MB total).
          enqueue({
            type: 'media_plan',
            plan: {
              ...mediaPlan,
              _campaignId: campaign.id,
              platforms: mediaPlan.platforms.map((p) => ({
                ...p,
                adTypes: p.adTypes.map((at) => ({
                  ...at,
                  ads: at.ads.map((ad) => ({ ...ad, imageUrls: [] })),
                })),
              })),
            } as MediaPlan & { _campaignId: string },
          });

          void redis
            .del(
              orgKey(organizationId, 'campaigns:all:p1'),
              orgKey(organizationId, 'campaigns:accelerate:p1')
            )
            .catch(() => {});

          // Generate images — each image_update is AWAITED so it lands in Redis
          // before the next iteration and before updateJob(completed) below.
          const appendEvent = async (event: AgentEvent): Promise<void> => {
            await appendJobEvent(jobId, event as unknown as { type: string; [key: string]: unknown });
          };
          await generateCampaignImages(mediaPlan, campaign.id, appendEvent);

          await updateJob(jobId, { status: 'completed', campaignId: campaign.id });
          void saveCampaignMemory({
            orgId: organizationId,
            userId,
            domain,
            mediaPlan,
            userPreferences: (userPreferences as Record<string, unknown>) ?? {},
          }).catch(() => {});
          void pruneMemory(organizationId).catch(() => {});
        } catch (dbErr) {
          fastify.log.error({ dbErr }, '[run] DB save failed');
          await updateJob(jobId, { status: 'failed', error: 'Failed to save campaign' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Agent pipeline failed';
        enqueue({ type: 'error', message });
        await updateJob(jobId, { status: 'failed', error: message });
      }
    })();

    return reply.status(200).send({ received: true, jobId });
  });
}
