import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as {
    orgId: string;
    marketName?: string;
    targetCountry?: string;
    language?: string;
    currency?: string;
    isEnabled?: boolean;
  };

  const { orgId, ...fields } = body;
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const existing = await prisma.shopifyMarket.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.shopifyMarket.update({
    where: { id },
    data: {
      ...(fields.marketName !== undefined && { marketName: fields.marketName }),
      ...(fields.targetCountry !== undefined && { targetCountry: fields.targetCountry }),
      ...(fields.language !== undefined && { language: fields.language }),
      ...(fields.currency !== undefined && { currency: fields.currency }),
      ...(fields.isEnabled !== undefined && { isEnabled: fields.isEnabled })
    }
  });

  return NextResponse.json({ market: updated });
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const existing = await prisma.shopifyMarket.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.shopifyMarket.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
