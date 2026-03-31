/**
 * Conversation proxy — bridges the Accelerate frontend to the agentic service.
 *
 * GET  ?latest=true              → GET  /api/v1/agents/{id}/conversations/latest
 * GET  ?conv_id=xxx              → (future — fetch specific conversation)
 * POST (no body required)        → POST /api/v1/agents/{id}/conversations
 *
 * All requests forward Authorization, x-org-id, and x-user-id.
 */

import { NextRequest } from 'next/server';
import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES } from '~/lib/service-router';

function agentId(): string {
  return process.env.AGENTIC_SERVICE_AGENT_ID ?? 'accelera-ai';
}

function agenticHeaders(
  userId: string,
  orgId: string,
): Record<string, string> {
  const internalKey = process.env.INTERNAL_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(internalKey ? { 'x-internal-api-key': internalKey } : {}),
    'x-user-id': userId,
    'x-org-id': orgId,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!SERVICES.agentic.enabled) {
    return Response.json({ conversation_id: null });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latest = searchParams.get('latest');
  const convId = searchParams.get('conv_id');
  const orgId = searchParams.get('organizationId') ?? '';

  // Resolve org membership to get the canonical org id
  let resolvedOrgId = orgId;
  if (orgId) {
    try {
      const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id, organizationId: orgId },
        select: { organization: { select: { id: true } } },
      });
      if (membership?.organization?.id) resolvedOrgId = membership.organization.id;
    } catch {
      // non-fatal — proceed with provided orgId
    }
  }

  const headers = agenticHeaders(session.user.id, resolvedOrgId);

  if (latest === 'true') {
    const upstream = await fetch(
      `${SERVICES.agentic.url}/api/v1/agents/${agentId()}/conversations/latest`,
      { method: 'GET', headers },
    );
    if (!upstream.ok) {
      if (upstream.status === 404) return Response.json({ conversation_id: null });
      return new Response(`Agentic service error: ${upstream.status}`, { status: 502 });
    }
    const data = (await upstream.json()) as { conversation_id: string | null };
    return Response.json(data);
  }

  if (convId) {
    // Future: GET specific conversation details — for now return conversation_id echo
    return Response.json({ conversation_id: convId });
  }

  return new Response('Missing query parameter: latest or conv_id', { status: 400 });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!SERVICES.agentic.enabled) {
    return Response.json({ conversation_id: null });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Optional body with organizationId
  let orgId = '';
  try {
    const body = (await request.json()) as { organizationId?: string };
    orgId = body.organizationId ?? '';
  } catch {
    // no body — fine
  }

  let resolvedOrgId = orgId;
  if (orgId) {
    try {
      const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id, organizationId: orgId },
        select: { organization: { select: { id: true } } },
      });
      if (membership?.organization?.id) resolvedOrgId = membership.organization.id;
    } catch {
      // non-fatal
    }
  }

  const headers = agenticHeaders(session.user.id, resolvedOrgId);

  const upstream = await fetch(
    `${SERVICES.agentic.url}/api/v1/agents/${agentId()}/conversations`,
    { method: 'POST', headers, body: JSON.stringify({}) },
  );
  if (!upstream.ok) {
    return new Response(`Agentic service error: ${upstream.status}`, { status: 502 });
  }
  const data = (await upstream.json()) as { conversation_id: string };
  return Response.json(data);
}
