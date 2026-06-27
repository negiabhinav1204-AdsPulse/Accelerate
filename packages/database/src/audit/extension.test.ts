import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withAuditAndEncryption, OptimisticLockError } from './extension';
import { runWithContext } from '@workspace/common/context';

const base = new PrismaClient();
const prisma = withAuditAndEncryption(base);
let orgId: string;

beforeAll(async () => {
  const org = await base.organization.create({ data: { name: 'audit-test-org', slug: `audit-${Date.now()}` } as any });
  orgId = org.id;
});

afterAll(async () => {
  await base.auditLog.deleteMany({ where: { organizationId: orgId } });
  await base.campaign.deleteMany({ where: { organizationId: orgId } });
  await base.organization.delete({ where: { id: orgId } });
  await base.$disconnect();
});

test('writes CREATE audit row with actor from context', async () => {
  const c = await runWithContext({ actorId: orgId, actorType: 'user', orgId }, () =>
    prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C1', objective: 'SALES' } }),
  );
  const logs = await base.auditLog.findMany({ where: { entityId: c.id, operation: 'CREATE' } });
  expect(logs).toHaveLength(1);
  expect(logs[0].actorType).toBe('user');
  expect(c.version).toBe(1);
});

test('UPDATE bumps version and records changed-field diff', async () => {
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C2', objective: 'SALES' } });
  const u = await prisma.campaign.update({ where: { id: c.id }, data: { name: 'C2-renamed' } });
  expect(u.version).toBe(2);
  const log = await base.auditLog.findFirst({ where: { entityId: c.id, operation: 'UPDATE' } });
  expect((log!.diff as any).name).toEqual({ old: 'C2', new: 'C2-renamed' });
});

test('optimistic lock conflict throws OptimisticLockError', async () => {
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C3', objective: 'SALES' } });
  await expect(
    prisma.campaign.update({ where: { id: c.id, version: 999 } as any, data: { name: 'x' } }),
  ).rejects.toBeInstanceOf(OptimisticLockError);
});

test('updating a non-existent id throws P2025, not OptimisticLockError', async () => {
  const nonExistentId = '00000000-0000-0000-0000-000000000000';
  await expect(
    prisma.campaign.update({ where: { id: nonExistentId }, data: { name: 'ghost' } }),
  ).rejects.toSatisfy((e: any) => e.code === 'P2025' && !(e instanceof OptimisticLockError));
});

test('optimistic lock conflict still throws OptimisticLockError (version mismatch)', async () => {
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C4', objective: 'SALES' } });
  await expect(
    prisma.campaign.update({ where: { id: c.id, version: 999 } as any, data: { name: 'x' } }),
  ).rejects.toBeInstanceOf(OptimisticLockError);
});

test('platformCampaign.updateMany bumps version and writes one UPDATE_MANY AuditLog', async () => {
  // Create a parent campaign first
  const c = await prisma.campaign.create({
    data: { organizationId: orgId, createdBy: orgId, name: 'BulkParent', objective: 'SALES' },
  });

  // Create two platform campaigns via base (bypass audit to set known initial state)
  const pc1 = await base.platformCampaign.create({
    data: { campaignId: c.id, platform: 'meta', adTypes: ['image'], budget: 100, version: 1, status: 'draft' },
  });
  const pc2 = await base.platformCampaign.create({
    data: { campaignId: c.id, platform: 'google', adTypes: ['search'], budget: 200, version: 1, status: 'draft' },
  });

  const result = await runWithContext({ actorId: orgId, actorType: 'user', orgId }, () =>
    prisma.platformCampaign.updateMany({
      where: { campaignId: c.id },
      data: { status: 'paused' },
    }),
  );

  expect(result.count).toBe(2);

  // Verify version was bumped on matched rows
  const updated1 = await base.platformCampaign.findUnique({ where: { id: pc1.id } });
  const updated2 = await base.platformCampaign.findUnique({ where: { id: pc2.id } });
  expect(updated1!.version).toBe(2);
  expect(updated2!.version).toBe(2);

  // Verify exactly one UPDATE_MANY AuditLog was written
  const logs = await base.auditLog.findMany({ where: { organizationId: orgId, operation: 'UPDATE_MANY', entityType: 'PlatformCampaign' } });
  expect(logs).toHaveLength(1);
  expect((logs[0].diff as any).count).toBe(2);

  // Cleanup
  await base.platformCampaign.deleteMany({ where: { campaignId: c.id } });
});

test('upsert on audited model throws audit bypass error', async () => {
  await expect(
    (prisma.campaign as any).upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: { name: 'x' },
      create: { organizationId: orgId, createdBy: orgId, name: 'x', objective: 'SALES' },
    }),
  ).rejects.toThrow('upsert on audited model Campaign is not supported (audit bypass)');
});
