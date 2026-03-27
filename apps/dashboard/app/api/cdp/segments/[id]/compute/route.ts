import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';

import { SERVICES, callService, getService } from '~/lib/service-router';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { id } = await params;

  if (!SERVICES.cdp.enabled) {
    return NextResponse.json({ error: 'CDP service not configured' }, { status: 503 });
  }

  // Verify org ownership
  const verifyRes = await getService(SERVICES.cdp.url, `/segments/${id}`);
  if (!verifyRes.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const seg = await verifyRes.json();
  if (seg.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const res = await callService(SERVICES.cdp.url, `/segments/${id}/compute`, {});
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
