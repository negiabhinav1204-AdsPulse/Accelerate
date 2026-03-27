/**
 * GET  /chat/sessions?organizationId=&userId=  — list recent sessions with messages
 * POST /chat/sessions                           — save campaign messages to a session
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyInternalKey(headers: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || headers['x-internal-api-key'] === key;
}

type SaveBody = {
  organizationId: string;
  userId: string;
  sessionId?: string;
  title?: string;
  messages: { role: string; content: string; toolData?: unknown }[];
};

export async function sessionsRoute(fastify: FastifyInstance) {
  // GET /chat/sessions
  fastify.get('/chat/sessions', async (request, reply) => {
    if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { organizationId, userId } = request.query as Record<string, string>;
    if (!organizationId || !userId) {
      return reply.status(400).send({ error: 'organizationId and userId required' });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { organizationId, userId },
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

    return sessions;
  });

  // POST /chat/sessions
  fastify.post<{ Body: SaveBody }>('/chat/sessions', async (request, reply) => {
    if (!verifyInternalKey(request.headers as Record<string, unknown>)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body;
    const { organizationId, userId, sessionId, title, messages } = body;

    if (!organizationId || !userId || !Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send({ error: 'organizationId, userId and messages required' });
    }

    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const newSession = await prisma.chatSession.create({
        data: { organizationId, userId, title: title ?? 'Campaign' },
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

    await prisma.chatSession.update({
      where: { id: activeSessionId },
      data: { updatedAt: new Date() }
    });

    return { sessionId: activeSessionId };
  });
}
