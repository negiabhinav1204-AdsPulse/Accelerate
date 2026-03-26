import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

/**
 * POST /api/shopping-feeds/zombie-sku/create-campaign
 * Body: { orgId, campaignName, dailyBudget, labelValue, productCount }
 *
 * Creates a pre-configured Shopping campaign (DRAFT) targeting the zombie_sku custom label.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    campaignName: string;
    dailyBudget: number;
    labelValue: string;
    productCount: number;
  };

  const { orgId, campaignName, dailyBudget, labelValue, productCount } = body;
  if (!orgId || !campaignName || !dailyBudget) {
    return NextResponse.json({ error: 'orgId, campaignName, dailyBudget required' }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const mediaPlan = {
    campaignName,
    objective: 'Shopping — Zombie SKU Recovery',
    channels: ['Google Shopping'],
    budget: { daily: dailyBudget, currency: 'USD' },
    targeting: {
      customLabel: labelValue,
      productCount,
      strategy: 'Standard Shopping — custom_label filter'
    },
    adFormats: ['Product Listing Ad'],
    notes: `Auto-created Zombie SKU recovery campaign. Targets ${productCount} low-visibility product(s) labeled "${labelValue}". Increase bids to resurface these products in Google Shopping.`
  };

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: orgId,
      createdBy: session.user.id,
      name: campaignName,
      status: 'DRAFT',
      objective: 'Shopping',
      source: 'shopping_feeds',
      mediaPlan: mediaPlan as object
    }
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
