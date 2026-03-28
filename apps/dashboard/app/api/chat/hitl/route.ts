/**
 * POST /api/chat/hitl
 *
 * Forwards a HITL form submission to the agentic service.
 * Called when the user approves or rejects a workflow pause (e.g. campaign config form).
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { SERVICES } from '~/lib/service-router';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { step_id, action, user_input, conv_id } = (await request.json()) as {
    step_id: string;
    action: 'submit' | 'reject';
    user_input?: Record<string, unknown>;
    conv_id?: string;
  };

  if (!SERVICES.agentic.enabled) {
    return NextResponse.json({ error: 'Agentic service not configured' }, { status: 503 });
  }

  const internalKey = process.env.INTERNAL_API_KEY;
  const url = `${SERVICES.agentic.url}/api/v1/agents/accelera-ai/hitl/${step_id}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(internalKey ? { 'x-internal-api-key': internalKey } : {}),
      'x-user-id': session.user.id,
    },
    body: JSON.stringify({ action, user_input: user_input ?? {}, conv_id }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `HITL submission failed: ${res.status}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
