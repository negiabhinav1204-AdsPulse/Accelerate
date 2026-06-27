import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withAuditAndEncryption, OptimisticLockError } from './extension';
import { runWithContext } from '@workspace/common/context';

const base = new PrismaClient();
const prisma = withAuditAndEncryption(base);
let orgId: string;
let commerceConnectorId: string;

beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  const org = await base.organization.create({ data: { name: 'audit-test-org', slug: `audit-${Date.now()}` } as any });
  orgId = org.id;
});

afterAll(async () => {
  if (commerceConnectorId) {
    await base.commerceConnector.delete({ where: { id: commerceConnectorId } }).catch(() => {});
  }
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

test('encrypts ConnectedAdAccount token at rest, decrypts on read', async () => {
  const acct = await prisma.connectedAdAccount.create({
    data: { organizationId: orgId, platform: 'meta', accountId: 'a1', accountName: 'n', accessToken: 'plain-token' },
  });
  const raw = await base.$queryRawUnsafe<any[]>(`select "accessToken" from "ConnectedAdAccount" where id = $1::uuid`, acct.id);
  expect(raw[0].accessToken.startsWith('v1:')).toBe(true);
  const read = await prisma.connectedAdAccount.findUnique({ where: { id: acct.id } });
  expect(read!.accessToken).toBe('plain-token');
  await base.connectedAdAccount.delete({ where: { id: acct.id } });
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

test('CommerceConnector credentials: encrypts json at rest, decrypts to object on read', async () => {
  const credentials = { apiKey: 'k', storeUrl: 'https://x' };
  const connector = await prisma.commerceConnector.create({
    data: {
      organizationId: orgId,
      platform: 'SHOPIFY',
      name: 'test-store',
      credentials,
    },
  });
  commerceConnectorId = connector.id;
  const raw = await base.$queryRawUnsafe<any[]>(
    `select credentials from "CommerceConnector" where id = $1::uuid`,
    connector.id,
  );
  // stored value should be a v1:-prefixed encrypted string (stored as JSON string in the Json column)
  const storedValue = raw[0].credentials;
  expect(typeof storedValue === 'string' ? storedValue : JSON.stringify(storedValue)).toMatch(/v1:/);
  const read = await prisma.commerceConnector.findUnique({ where: { id: connector.id } });
  expect(read!.credentials).toEqual({ apiKey: 'k', storeUrl: 'https://x' });
});

