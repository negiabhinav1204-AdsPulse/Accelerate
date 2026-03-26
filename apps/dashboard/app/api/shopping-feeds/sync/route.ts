import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';

// Stub sync endpoint — simulates triggering a Shopify → channel sync.
// Will be replaced with real Shopify API + Google Content API calls once credentials are set up.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { orgId?: string; channel?: string };

  // Simulate a short delay
  await new Promise((r) => setTimeout(r, 800));

  return NextResponse.json({
    success: true,
    message: 'Sync triggered successfully',
    syncedAt: new Date().toISOString(),
    channel: body.channel ?? 'all',
    productsQueued: 10
  });
}
