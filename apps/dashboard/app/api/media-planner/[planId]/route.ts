/**
 * BFF proxy: GET /api/media-planner/:planId
 * Poll plan status from agent service Redis store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrganizationContext } from '@workspace/auth/context';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8080';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  await getAuthOrganizationContext();
  const { planId } = await params;

  const res = await fetch(`${AGENT_SERVICE_URL}/media-planner/${planId}`);
  if (!res.ok) {
    return NextResponse.json({ error: 'Plan not found' }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
