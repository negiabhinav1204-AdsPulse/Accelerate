import 'server-only';

import { prisma } from '@workspace/database/client';

export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolData: unknown;
  createdAt: Date;
};

export type ChatSessionData = {
  sessionId: string;
  messages: StoredMessage[];
};

/**
 * Returns the most recent chat session for this user+org, or null if none exists.
 * We keep one active session per user per org (the most recently updated one).
 */
export async function getChatSession(
  userId: string,
  organizationId: string
): Promise<ChatSessionData | null> {
  const session = await prisma.chatSession.findFirst({
    where: { userId, organizationId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          toolData: true,
          createdAt: true
        }
      }
    }
  });

  if (!session) return null;

  return {
    sessionId: session.id,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      toolData: m.toolData,
      createdAt: m.createdAt
    }))
  };
}
