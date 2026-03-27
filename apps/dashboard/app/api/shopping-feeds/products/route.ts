import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { SERVICES, getService } from '~/lib/service-router';

import {
  MOCK_SHOPIFY_PRODUCTS,
  MOCK_SHOPIFY_STORE
} from '~/lib/platforms/shopify-mock';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const channel = searchParams.get('channel') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const search = searchParams.get('search') ?? '';

  if (SERVICES.shoppingFeeds.enabled) {
    const qs = new URLSearchParams({ channel, status, search }).toString();
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/products?${qs}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  const searchLower = search.toLowerCase();

  let products = [...MOCK_SHOPIFY_PRODUCTS];

  if (searchLower) {
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        p.brand.toLowerCase().includes(searchLower)
    );
  }

  if (channel !== 'all') {
    products = products.filter((p) => p.channelStatus[channel as keyof typeof p.channelStatus] !== undefined);
  }

  if (status !== 'all') {
    products = products.filter((p) => {
      const statuses = Object.values(p.channelStatus);
      if (status === 'approved') return statuses.some((s) => s === 'approved' || s === 'active');
      if (status === 'pending') return statuses.some((s) => s === 'pending');
      if (status === 'disapproved') return statuses.some((s) => s === 'disapproved');
      if (status === 'not_submitted') return statuses.every((s) => s === 'not_submitted');
      return true;
    });
  }

  return NextResponse.json({
    store: MOCK_SHOPIFY_STORE,
    products,
    total: products.length
  });
}
