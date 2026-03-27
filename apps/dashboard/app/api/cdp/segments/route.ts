import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';

import { SERVICES, callService, deleteService, getService } from '~/lib/service-router';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const orgId = ctx.organization.id;

  if (!SERVICES.cdp.enabled) {
    return NextResponse.json({ segments: [], note: 'CDP service not configured' });
  }

  const res = await getService(SERVICES.cdp.url, `/segments?org_id=${orgId}`);
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const body = await req.json();

  if (!SERVICES.cdp.enabled) {
    return NextResponse.json({ error: 'CDP service not configured' }, { status: 503 });
  }

  const res = await callService(SERVICES.cdp.url, '/segments', {
    ...body,
    org_id: ctx.organization.id,
  });
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const { id } = await req.json();

  if (!SERVICES.cdp.enabled) {
    return NextResponse.json({ error: 'CDP service not configured' }, { status: 503 });
  }

  // Verify org ownership (security check)
  const verifyRes = await getService(SERVICES.cdp.url, `/segments/${id}`);
  if (!verifyRes.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const seg = await verifyRes.json();
  if (seg.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const res = await deleteService(SERVICES.cdp.url, `/segments/${id}`);
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
