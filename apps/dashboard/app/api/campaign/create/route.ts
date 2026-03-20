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

type RequestBody = {
  url: string;
  organizationId: string;
  userPreferences?: UserPreferences;
};

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
      timezone: true
    }
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          // Stream may be closed if client disconnected
        }
      };

      let mediaPlan: MediaPlan | null = null;

      try {
        mediaPlan = await runCampaignAgents({
          url,
          organizationId,
          connectedAccounts,
          userPreferences,
          enqueue
        });
      } catch (err) {
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
              mediaPlan: mediaPlan as object
            },
            select: { id: true }
          });

          // Stream the campaign ID so the client can navigate
          enqueue({
            type: 'media_plan',
            plan: { ...mediaPlan, _campaignId: campaign.id } as MediaPlan & { _campaignId: string }
          });
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
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no'
    }
  });
}
