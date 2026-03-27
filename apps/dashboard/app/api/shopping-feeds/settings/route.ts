import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, patchService } from '~/lib/service-router';

/**
 * GET /api/shopping-feeds/settings?orgId=...
 *
 * Returns ShoppingFeedSettings for the org's connected store,
 * plus the connected ad account info (id + name) for each platform.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/settings?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  // Find the connected Shopify store
  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId, isActive: true },
    select: { id: true }
  });

  if (!store) {
    return NextResponse.json({ hasStore: false });
  }

  // Find or create feed settings
  let settings = await prisma.shoppingFeedSettings.findUnique({
    where: { connectorId: store.id }
  });

  if (!settings) {
    settings = await prisma.shoppingFeedSettings.create({
      data: {
        organizationId: orgId,
        connectorId: store.id
      }
    });
  }

  // Pull default connected ad accounts for each platform
  const [googleAccount, metaAccount, bingAccount] = await Promise.all([
    prisma.connectedAdAccount.findFirst({
      where: { organizationId: orgId, platform: 'google', isDefault: true, archivedAt: null },
      select: { accountId: true, accountName: true }
    }),
    prisma.connectedAdAccount.findFirst({
      where: { organizationId: orgId, platform: 'meta', isDefault: true, archivedAt: null },
      select: { accountId: true, accountName: true }
    }),
    prisma.connectedAdAccount.findFirst({
      where: { organizationId: orgId, platform: 'bing', isDefault: true, archivedAt: null },
      select: { accountId: true, accountName: true }
    })
  ]);

  return NextResponse.json({
    hasStore: true,
    settings,
    connectedAccounts: {
      google: googleAccount,
      meta: metaAccount,
      bing: bingAccount
    }
  });
}

type SettingsPatchBody = {
  orgId: string;
  titlePreference?: string;
  descriptionPreference?: string;
  variantPreference?: string;
  appendVariantToTitle?: boolean;
  inventoryPolicy?: string;
  useSecondImage?: boolean;
  submitAdditionalImages?: boolean;
  richDescriptions?: boolean;
  enableSalePrice?: boolean;
  enableUtmTracking?: boolean;
  productIdFormat?: string;
  defaultGoogleCategory?: string | null;
  defaultAgeGroup?: string | null;
  merchantCenterId?: string | null;
  channels?: string[];
};

/**
 * PATCH /api/shopping-feeds/settings
 *
 * Updates ShoppingFeedSettings for the org's connected store.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as SettingsPatchBody;
  const { orgId, ...fields } = body;

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await patchService(SERVICES.shoppingFeeds.url, '/shopping-feeds/settings', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  // Find the connected store
  const store = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId, isActive: true },
    select: { id: true }
  });

  if (!store) {
    return NextResponse.json({ error: 'No connected store found' }, { status: 404 });
  }

  const updated = await prisma.shoppingFeedSettings.upsert({
    where: { connectorId: store.id },
    create: {
      organizationId: orgId,
      connectorId: store.id,
      ...fields
    },
    update: fields
  });

  return NextResponse.json({ settings: updated });
}
