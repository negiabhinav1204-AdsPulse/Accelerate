/**
 * POST /api/campaign/create
 *
 * Entry point for async campaign generation.
 * - Validates auth, membership, and rate limits
 * - Creates a Redis job record
 * - Publishes to QStash (production) or runs worker directly (dev/no QStash)
 * - Returns { jobId } immediately — frontend polls /api/campaign/status/:jobId
 *
 * Body: { url: string; organizationId: string; userPreferences?: object }
 */

import { NextRequest, NextResponse } from 'next/server';

import { Client } from '@upstash/qstash';
import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

import { createJob } from '~/lib/job-store';
import { aiRateLimit } from '~/lib/rate-limit';

type RequestBody = {
  url: string;
  organizationId: string;
  userPreferences?: Record<string, unknown>;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Rate limiting ─────────────────────────────────────────────────────────
  try {
    const { success, limit, remaining, reset } =
      await aiRateLimit.limit(userId);
    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `You can create up to ${limit} campaigns per hour. Try again after ${new Date(reset).toLocaleTimeString()}.`,
          remaining: 0,
          reset
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset)
          }
        }
      );
    }
  } catch {
    // Redis unavailable — allow through
  }

  // ── 3. Validate body ─────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { url, organizationId, userPreferences } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }
  if (!organizationId || typeof organizationId !== 'string') {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'url must be a valid URL' },
      { status: 400 }
    );
  }

  // ── 4. Membership check ───────────────────────────────────────────────────────
  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 5. Create Redis job record ────────────────────────────────────────────────
  const { v4: uuidv4 } = await import('uuid');
  const jobId = uuidv4();

  try {
    await createJob({ jobId, orgId: organizationId, userId, url });
  } catch (e) {
    console.error('[campaign/create] Failed to create Redis job:', e);
    return NextResponse.json(
      { error: 'Failed to initialise job' },
      { status: 500 }
    );
  }

  const workerPayload = { jobId, url, organizationId, userId, userPreferences };

  // ── 6. Enqueue to QStash (production) or run inline (dev) ────────────────────
  const qstashToken = process.env.QSTASH_TOKEN;
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? '';
  const useQStash = !!qstashToken && !dashboardUrl.includes('localhost');

  if (useQStash) {
    try {
      const qstash = new Client({ token: qstashToken });
      await qstash.publishJSON({
        url: `${dashboardUrl}/api/campaign/worker`,
        body: workerPayload,
        retries: 1
      });
    } catch (e) {
      console.error('[campaign/create] QStash publish failed:', e);
      return NextResponse.json(
        { error: 'Failed to enqueue job' },
        { status: 500 }
      );
    }
  } else {
    // Dev mode: call worker directly (fire-and-forget so response returns immediately)
    void fetch(`${dashboardUrl || 'http://localhost:3000'}/api/campaign/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerPayload)
    }).catch((e) => console.error('[campaign/create] Dev worker call failed:', e));
  }

  // ── 7. Return job ID immediately ──────────────────────────────────────────────
  return NextResponse.json({ jobId }, { status: 202 });
}
