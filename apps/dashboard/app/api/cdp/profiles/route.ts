import { NextRequest, NextResponse } from 'next/server';

import { getAuthOrganizationContext } from '@workspace/auth/context';

import { SERVICES, callService, getService } from '~/lib/service-router';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthOrganizationContext();
  const orgId = ctx.organization.id;

  const { searchParams } = req.nextUrl;
  const page = searchParams.get('page') ?? '1';
  const limit = searchParams.get('limit') ?? '50';
  const search = searchParams.get('search') ?? '';
  const segmentId = searchParams.get('segment_id') ?? '';
  const sort = searchParams.get('sort') ?? 'total_spend_desc';

  if (!SERVICES.cdp.enabled) {
    return NextResponse.json({ profiles: [], total: 0, page: 1, pages: 1, overview: null, note: 'CDP service not configured' });
  }

  const params = new URLSearchParams({
    org_id: orgId,
    page,
    limit,
    ...(search && { search }),
    ...(segmentId && { segment_id: segmentId }),
    sort,
  });

  const [profilesRes, overviewRes] = await Promise.all([
    getService(SERVICES.cdp.url, `/profiles?${params}`),
    getService(SERVICES.cdp.url, `/profiles/overview?org_id=${orgId}`),
  ]);

  const profiles = profilesRes.ok ? await profilesRes.json() : { profiles: [], total: 0, page: 1, pages: 1 };
  const overview = overviewRes.ok ? await overviewRes.json() : null;

  return NextResponse.json({ ...profiles, overview });
}
