import { randomUUID } from 'crypto';
import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@workspace/database/client';
import { runReconcile } from './executor';
import { buildPlatformGraph } from './graph';
import type { PlatformAdapter } from './adapters/types';

let campaignId: string;
let orgId: string;

// Use a unique slug so parallel runs don't collide
const uniqueSlug = `recon-int-${Date.now()}`;

beforeAll(async () => {
  const org = await (prisma as any).organization.create({
    data: { name: 'recon-int', slug: uniqueSlug },
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
  // campaignLocalId is a real uuid (as a DB PlatformCampaign id would be)
  const campaignLocalId = randomUUID();

  // Budget and adgroup use the synthetic non-uuid ids that buildPlatformGraph callers
  // supply in production: `${platformCampaignId}-budget`, `${platformCampaignId}-ag0`.
  // These are the ids that previously broke the @db.Uuid column.
  const budgetLocalId = `${campaignLocalId}-budget`;
  const adGroupLocalId = `${campaignLocalId}-ag0`;
  const adLocalId = `${campaignLocalId}-ag0-ad0`;

  // Build nodes for both platforms — each has a budget + campaign + 1 adgroup + 1 ad
  const metaNodes = buildPlatformGraph({
    platform: 'meta',
    campaignLocalId,
    campaignDesired: { name: 'X' },
    budget: { localId: budgetLocalId, desired: { amount: 100 } },
    adGroups: [
      {
        localId: adGroupLocalId,
        desired: { name: 'AG0' },
        ads: [{ localId: adLocalId, desired: { headline: 'H' } }],
      },
    ],
  });
  const googleNodes = buildPlatformGraph({
    platform: 'google',
    campaignLocalId,
    campaignDesired: { name: 'X' },
    budget: { localId: budgetLocalId, desired: { amount: 100 } },
    adGroups: [
      {
        localId: adGroupLocalId,
        desired: { name: 'AG0' },
        ads: [{ localId: adLocalId, desired: { headline: 'H' } }],
      },
    ],
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

  // Prove that non-uuid localIds (like '-budget') were persisted without error.
  // This guards the fix: CampaignRunItem.localId must be VARCHAR, not UUID.
  expect(items.some((i) => i.localId !== null && i.localId.includes('-budget'))).toBe(true);
}, 30_000);
