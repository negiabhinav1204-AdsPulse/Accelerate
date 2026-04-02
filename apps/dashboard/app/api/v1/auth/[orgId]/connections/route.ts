/**
 * GET /api/v1/auth/[orgId]/connections
 *
 * Internal endpoint — called by the agentic service's campaign_client.py.
 * Returns connected ad accounts for an org in the format the Python
 * ConnectionsResponse model expects.
 *
 * Auth: X-Internal-Api-Key header (service-to-service)
 *
 * Response shape (matches Python ConnectionsResponse Pydantic model):
 * {
 *   organizationId: string,
 *   platforms: {
 *     GOOGLE: { platform, connected, connectionCount, connections: [{accountId, accountName, ...}] },
 *     META: { ... }
 *   },
 *   totalConnections: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@workspace/database/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  // ── Auth: internal API key ────────────────────────────────────────────────
  const internalKey = request.headers.get('x-internal-api-key');
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId } = await params;

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  try {
    const accounts = await prisma.connectedAdAccount.findMany({
      where: { organizationId: orgId, status: 'connected', archivedAt: null },
      select: {
        id: true,
        platform: true,
        accountId: true,
        accountName: true,
        accountType: true,
        currency: true,
        timezone: true,
        status: true,
        connectedAt: true
      }
    });

    // Group by platform (store platforms as uppercase keys)
    const platformMap: Record<
      string,
      {
        platform: string;
        connected: boolean;
        connectionCount: number;
        connections: {
          accountId: string;
          accountName: string;
          accountType: string | null;
          currency: string | null;
          timezone: string | null;
          connectedAt: string;
          tokenValid: boolean;
        }[];
      }
    > = {};

    for (const acct of accounts) {
      const key = acct.platform.toUpperCase();
      if (!platformMap[key]) {
        platformMap[key] = {
          platform: key,
          connected: true,
          connectionCount: 0,
          connections: []
        };
      }
      platformMap[key]!.connections.push({
        accountId: acct.accountId,
        accountName: acct.accountName,
        accountType: acct.accountType,
        currency: acct.currency,
        timezone: acct.timezone,
        connectedAt: acct.connectedAt.toISOString(),
        tokenValid: true
      });
      platformMap[key]!.connectionCount += 1;
    }

    const totalConnections = Object.values(platformMap).reduce(
      (sum, p) => sum + p.connectionCount,
      0
    );

    return NextResponse.json({
      organizationId: orgId,
      platforms: platformMap,
      totalConnections
    });
  } catch (err) {
    console.error('[api/v1/auth/connections] fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}
