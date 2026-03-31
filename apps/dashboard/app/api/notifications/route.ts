/**
 * Notifications API
 *
 * GET  /api/notifications              — List unseen/unread notifications for current user
 * PATCH /api/notifications             — Mark notifications as seen (body: { ids?: string[] } — omit to mark all)
 * DELETE /api/notifications/:id        — Dismiss a notification
 */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const userId = ctx.session.user.id;
    const orgId = ctx.organization.id;

    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get('includeRead') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        organizationId: orgId,
        dismissed: false,
        ...(includeRead ? {} : { seenAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        subject: true,
        content: true,
        link: true,
        seenAt: true,
        createdAt: true,
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, organizationId: orgId, seenAt: null, dismissed: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const userId = ctx.session.user.id;
    const orgId = ctx.organization.id;

    const body = await request.json() as { ids?: string[] };
    const now = new Date();

    if (body.ids && body.ids.length > 0) {
      // Mark specific notifications as seen
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, userId, organizationId: orgId },
        data: { seenAt: now },
      });
    } else {
      // Mark all unseen as seen
      await prisma.notification.updateMany({
        where: { userId, organizationId: orgId, seenAt: null },
        data: { seenAt: now },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/notifications]', err);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthOrganizationContext();
    const userId = ctx.session.user.id;
    const orgId = ctx.organization.id;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: { id, userId, organizationId: orgId },
      data: { dismissed: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/notifications]', err);
    return NextResponse.json({ error: 'Failed to dismiss notification' }, { status: 500 });
  }
}
