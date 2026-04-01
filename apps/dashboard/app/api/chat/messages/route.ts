/**
 * Messages proxy — fetches conversation message history from the agentic service
 * and transforms it into the format expected by accelera-ai-home.tsx.
 *
 * GET ?conv_id=xxx&organizationId=yyy
 *
 * Agentic service message shape (per block):
 *   { type: 'text', content: string }
 *   { type: 'workflow_progress', workflow_id?: string, data?: object }
 *   { type: 'hitl_request', hitl_id: string, ... }
 *   { type: <tool_name>, data?: object, content?: string }
 *
 * Target format (MessagePart[] per ChatMessage in accelera-ai-home.tsx):
 *   { type: 'text', text: string }
 *   { type: 'tool', tool: { name: string, input: unknown } }
 *   { type: 'workflow_progress', data: unknown }
 *   { type: 'hitl_request', data: Record<string, unknown> }
 */

import { NextRequest } from 'next/server';
import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES } from '~/lib/service-router';

function agentId(): string {
  return process.env.AGENTIC_SERVICE_AGENT_ID ?? 'accelera-ai';
}

type AgentBlock = Record<string, unknown>;

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  blocks: AgentBlock[];
  created_at?: string;
};

type TextPart = { type: 'text'; text: string };
type ToolPart = { type: 'tool'; tool: { name: string; input: unknown } };
type WorkflowProgressPart = { type: 'workflow_progress'; data: unknown };
type HITLRequestPart = { type: 'hitl_request'; data: Record<string, unknown> };
type MessagePart = TextPart | ToolPart | WorkflowProgressPart | HITLRequestPart;

type TransformedMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
};

function transformBlock(block: AgentBlock): MessagePart | null {
  const blockType = String(block['type'] ?? '');

  if (blockType === 'text') {
    const text = String(block['content'] ?? '');
    if (!text) return null;
    return { type: 'text', text };
  }

  if (blockType === 'workflow_progress') {
    const data = (block['data'] ?? {}) as Record<string, unknown>;
    return { type: 'workflow_progress', data };
  }

  if (blockType === 'hitl_request') {
    // The block itself is the HITL request data
    const data = { ...block } as Record<string, unknown>;
    return { type: 'hitl_request', data };
  }

  // All other block types map to tool blocks
  if (blockType) {
    const data = (block['data'] ?? block) as Record<string, unknown>;
    // Strip the 'type' key from data to avoid redundancy when block.data is absent
    const input = block['data'] !== undefined ? data : (() => {
      const { type: _type, ...rest } = block;
      void _type;
      return rest as Record<string, unknown>;
    })();
    return { type: 'tool', tool: { name: blockType, input } };
  }

  return null;
}

function transformMessage(msg: AgentMessage): TransformedMessage {
  const parts: MessagePart[] = [];
  for (const block of msg.blocks ?? []) {
    const part = transformBlock(block);
    if (part) parts.push(part);
  }
  return { id: msg.id, role: msg.role, parts };
}

export async function GET(request: NextRequest): Promise<Response> {
  const agenticUrl = process.env.AGENTIC_SERVICE_URL;
  if (!agenticUrl) {
    return Response.json({ messages: [] });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const convId = searchParams.get('conv_id');
  const orgId = searchParams.get('organizationId') ?? '';

  if (!convId) {
    return new Response('Missing query parameter: conv_id', { status: 400 });
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

  const internalKey = process.env.INTERNAL_API_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(internalKey ? { 'x-internal-api-key': internalKey } : {}),
    'x-user-id': session.user.id,
    'x-org-id': resolvedOrgId,
  };

  const upstream = await fetch(
    `${agenticUrl}/api/v1/agents/${agentId()}/conversations/${convId}/messages`,
    { method: 'GET', headers },
  );

  if (!upstream.ok) {
    if (upstream.status === 404 || upstream.status === 403) {
      return Response.json({ messages: [] });
    }
    return new Response(`Agentic service error: ${upstream.status}`, { status: 502 });
  }

  const body = (await upstream.json()) as {
    messages: AgentMessage[];
    workflows?: unknown[];
  };

  const transformed = (body.messages ?? []).map(transformMessage);
  return Response.json({ messages: transformed });
}
