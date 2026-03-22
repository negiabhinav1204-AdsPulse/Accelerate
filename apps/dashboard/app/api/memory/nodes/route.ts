/**
 * GET /api/memory/nodes?orgId=...  — list all active memory nodes for org
 * PATCH /api/memory/nodes          — update a node's content
 * DELETE /api/memory/nodes?id=...  — archive/delete a node
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { updateMemoryNodeContent, deleteMemoryNode } from '~/lib/memory/memory-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  // Verify membership
  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const nodes = await prisma.orgMemoryNode.findMany({
    where: { orgId, archivedAt: null },
    orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, orgId: true, userId: true, type: true, key: true, summary: true, content: true, confidence: true, accessCount: true, sourceUrl: true, createdAt: true, updatedAt: true }
  });

  return NextResponse.json({ nodes });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { id: string; orgId: string; content: Record<string, unknown>; summary: string };
  const { id, orgId, content, summary } = body;

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await updateMemoryNodeContent(id, orgId, content, summary);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!id || !orgId) return NextResponse.json({ error: 'id and orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({ where: { organizationId: orgId, userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await deleteMemoryNode(id, orgId);
  return NextResponse.json({ ok: true });
}
