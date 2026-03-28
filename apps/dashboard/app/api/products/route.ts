import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';

import { SERVICES, getService } from '~/lib/service-router';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const orgId = ctx.organization.id;

  const { searchParams } = req.nextUrl;
  const page = searchParams.get('page') ?? '1';
  const limit = searchParams.get('limit') ?? '50';
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const connectorId = searchParams.get('connector_id') ?? '';
  const sort = searchParams.get('sort') ?? 'velocity_desc';

  if (!SERVICES.commerce.enabled) {
    return NextResponse.json({ products: [], total: 0, page: 1, pages: 1, note: 'Commerce service not configured' });
  }

  const params = new URLSearchParams({
    org_id: orgId,
    page,
    limit,
    ...(search && { search }),
    ...(status && { status }),
    ...(connectorId && { connector_id: connectorId }),
    sort,
  });

  const res = await getService(SERVICES.commerce.url, `/products?${params}`);
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
