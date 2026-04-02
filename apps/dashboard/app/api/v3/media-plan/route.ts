/**
 * POST /api/v3/media-plan
 *
 * Internal endpoint — called by the agentic service's campaign_client.py.
 * Creates a Campaign record (status: REVIEWING) for an AI-generated media plan.
 *
 * Auth: X-Internal-Api-Key header (service-to-service, no user session required)
 * Headers: X-Org-Id (required), X-User-Id (optional)
 * Body: { name: string; url: string }
 * Response: { id, name, status, sourceUrl, createdAt }
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@workspace/database/client';

import { orgKey, redis } from '~/lib/redis';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth: internal API key ────────────────────────────────────────────────
  const internalKey = request.headers.get('x-internal-api-key');
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Headers ───────────────────────────────────────────────────────────────
  const orgId = request.headers.get('x-org-id') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (!orgId) {
    return NextResponse.json({ error: 'X-Org-Id header required' }, { status: 400 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { name?: string; url?: string };
  try {
    body = (await request.json()) as { name?: string; url?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, url } = body;
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // ── Create campaign record ────────────────────────────────────────────────
  try {
    const acceCount = await prisma.campaign.count({
      where: { organizationId: orgId, source: 'accelerate' }
    });
    const acceId = `ACCE-${String(acceCount + 1).padStart(2, '0')}`;

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: orgId,
        createdBy: userId || '00000000-0000-0000-0000-000000000000', // fall back to nil UUID if no userId
        name,
        sourceUrl: url ?? null,
        objective: 'awareness',
        status: 'REVIEWING',
        source: 'accelerate',
        acceId,
        totalBudget: 0,
        currency: 'USD'
      },
      select: {
        id: true,
        acceId: true,
        name: true,
        status: true,
        sourceUrl: true,
        objective: true,
        createdAt: true
      }
    });

    // Invalidate campaigns list cache
    void redis
      .del(
        orgKey(orgId, 'campaigns:all:p1'),
        orgKey(orgId, 'campaigns:accelerate:p1')
      )
      .catch(() => {});

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    console.error('[api/v3/media-plan] create failed:', err);
    return NextResponse.json({ error: 'Failed to create media plan' }, { status: 500 });
  }
}
