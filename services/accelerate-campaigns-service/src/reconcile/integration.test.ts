import { randomUUID } from 'crypto';
import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@workspace/database/client';
import { runReconcile } from './executor';
import { buildPlatformGraph } from './graph';
import type { PlatformAdapter } from './adapters/types';

let campaignId: string;
let orgId: string;

beforeAll(async () => {
  const org = await (prisma as any).organization.create({
    data: { name: 'recon-int', slug: `recon-${Date.now()}` },
  });
  orgId = org.id;
  const c = await prisma.campaign.create({
    data: { organizationId: orgId, createdBy: orgId, name: 'INT', objective: 'SALES' },
  });
  campaignId = c.id;
});

afterAll(async () => {
  await prisma.campaignRun.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { organizationId: orgId } });
  await (prisma as any).organization.delete({ where: { id: orgId } });
});

const adapter = (fail = false): PlatformAdapter => ({
  treeCreate: true,
  create: vi.fn(async () => {
    if (fail) throw new Error('boom');
    return { externalId: 'EXT' };
  }),
  update: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
});

test('partial failure -> PARTIAL status + per-platform items recorded', async () => {
  // localIds must be valid UUIDs because CampaignRunItem.localId is @db.Uuid
  const campaignLocalId = randomUUID();
  const budgetLocalId = randomUUID();

  // Build nodes for both platforms — each needs a campaign node so treeCreate fires
  const metaNodes = buildPlatformGraph({
    platform: 'meta',
    campaignLocalId,
    campaignDesired: { name: 'X' },
    budget: { localId: budgetLocalId, desired: { amount: 1 } },
    adGroups: [],
  });
  const googleNodes = buildPlatformGraph({
    platform: 'google',
    campaignLocalId,
    campaignDesired: { name: 'X' },
    budget: { localId: budgetLocalId, desired: { amount: 1 } },
    adGroups: [],
  });

  const summary = await runReconcile({
    campaignId,
    organizationId: orgId,
    trigger: 'publish',
    platforms: [
      { platform: 'meta', nodes: metaNodes, adapter: adapter(false), ctx: {} as any },
      { platform: 'google', nodes: googleNodes, adapter: adapter(true), ctx: {} as any },
    ],
  });

  expect(summary.status).toBe('PARTIAL');

  const items = await prisma.campaignRunItem.findMany({ where: { runId: summary.runId } });
  expect(items.some((i) => i.status === 'SUCCESS')).toBe(true);
  expect(items.some((i) => i.status === 'FAILED')).toBe(true);
}, 30_000);
