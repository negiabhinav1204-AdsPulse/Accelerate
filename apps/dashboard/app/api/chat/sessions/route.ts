import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, callService, getService } from '~/lib/service-router';

/**
 * POST /api/chat/sessions — save campaign messages to a session.
 * Used when a campaign is created inline (URL-triggered) so those messages
 * are persisted and survive page refresh.
 *
 * Body: {
 *   organizationId: string;
 *   sessionId?: string;          // omit to create a new session
 *   title?: string;              // used only when creating a new session
 *   messages: { role: string; content: string; toolData?: unknown }[];
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  let body: { organizationId: string; sessionId?: string; title?: string; messages: { role: string; content: string; toolData?: unknown }[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  const { organizationId, sessionId, title, messages } = body;
  if (!organizationId || !Array.isArray(messages) || messages.length === 0) {
    return new NextResponse('organizationId and messages required', { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findFirst({ where: { organizationId, userId: session.user.id } });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  if (SERVICES.chat.enabled) {
    const res = await callService(SERVICES.chat.url, '/chat/sessions', { organizationId, sessionId, title, messages, userId: session.user.id });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  let activeSessionId = sessionId;

  if (!activeSessionId) {
    const newSession = await prisma.chatSession.create({
      data: { organizationId, userId: session.user.id, title: title ?? 'Campaign' },
      select: { id: true }
    });
    activeSessionId = newSession.id;
  }

  await prisma.chatMessage.createMany({
    data: messages.map((m) => ({
      sessionId: activeSessionId!,
      role: m.role,
      content: m.content,
      toolData: m.toolData !== undefined ? m.toolData as object : undefined
    }))
  });

  await prisma.chatSession.update({ where: { id: activeSessionId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ sessionId: activeSessionId });
}

/** GET /api/chat/sessions?organizationId=xxx — list recent sessions */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return new NextResponse('organizationId required', { status: 400 });
  }

  if (SERVICES.chat.enabled) {
    const res = await getService(SERVICES.chat.url, `/chat/sessions?organizationId=${organizationId}&userId=${session.user.id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const sessions = await prisma.chatSession.findMany({
    where: { organizationId, userId: session.user.id },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: { id: true, role: true, content: true, toolData: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  });

  return NextResponse.json(sessions);
}
