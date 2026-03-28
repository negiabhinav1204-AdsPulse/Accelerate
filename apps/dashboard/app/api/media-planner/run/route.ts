/**
 * BFF proxy: POST /api/media-planner/run
 * Forwards to agent service and streams SSE back to the client.
 */

import { NextRequest } from 'next/server';
import { getAuthOrganizationContext } from '@workspace/auth/context';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8080';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getAuthOrganizationContext();
  const orgId = ctx.organization.id;

  const body = await request.json() as {
    budget: number;
    objective?: string;
    selectedPlatforms?: string[];
  };

  const agentRes = await fetch(`${AGENT_SERVICE_URL}/media-planner/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, ...body }),
  });

  // Stream SSE directly back to client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = agentRes.body?.getReader();
      if (!reader) { controller.close(); return; }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
        // Pass-through decoded text for debugging
        decoder.decode(value);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Plan-Id': agentRes.headers.get('X-Plan-Id') ?? '',
    },
  });
}
