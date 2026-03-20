import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

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
