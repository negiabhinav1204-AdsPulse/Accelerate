import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

/**
 * POST /api/shopping-feeds/zombie-sku/label
 * Body: { orgId, productIds: string[], customLabel: string, labelValue: string }
 *
 * Writes the zombie label into FeedProduct.customLabels JSON for each product.
 * If the FeedProduct row doesn't exist yet (products are still mock), we upsert it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    productIds: string[]; // shopifyProductIds
    customLabel: string;
    labelValue: string;
  };

  const { orgId, productIds, customLabel, labelValue } = body;
  if (!orgId || !productIds?.length || !customLabel || !labelValue) {
    return NextResponse.json({ error: 'orgId, productIds, customLabel, labelValue required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const store = await prisma.connectedStore.findFirst({
    where: { organizationId: orgId },
    select: { id: true }
  });
  if (!store) return NextResponse.json({ error: 'No connected store' }, { status: 400 });

  let labeled = 0;
  for (const shopifyProductId of productIds) {
    // Try to update existing FeedProduct row
    const existing = await prisma.feedProduct.findFirst({
      where: { connectedStoreId: store.id, shopifyProductId },
      select: { id: true, customLabels: true }
    });

    const updatedLabels = {
      ...((existing?.customLabels as Record<string, string> | null) ?? {}),
      [customLabel]: labelValue
    };

    if (existing) {
      await prisma.feedProduct.update({
        where: { id: existing.id },
        data: { customLabels: updatedLabels }
      });
    } else {
      // Create a minimal FeedProduct so the label is persisted
      await prisma.feedProduct.create({
        data: {
          organizationId: orgId,
          connectedStoreId: store.id,
          shopifyProductId,
          title: shopifyProductId, // placeholder — real sync will overwrite
          price: 0,
          customLabels: updatedLabels
        }
      });
    }
    labeled++;
  }

  return NextResponse.json({ labeled });
}
