import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isEncrypted } from '@workspace/common/crypto';
import { backfillEncryptedSecrets } from './encrypt-existing-secrets';

const base = new PrismaClient();
let orgId: string;
let acctId: string;

beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  const org = await base.organization.create({ data: { name: 'bf-org', slug: `bf-${Date.now()}` } as any });
  orgId = org.id;
  // insert raw plaintext token, bypassing the extension
  const acct = await base.connectedAdAccount.create({
    data: { organizationId: orgId, platform: 'meta', accountId: 'a', accountName: 'n', accessToken: 'PLAINTEXT' },
  });
  acctId = acct.id;
});

afterAll(async () => {
  await base.connectedAdAccount.deleteMany({ where: { organizationId: orgId } });
  await base.organization.delete({ where: { id: orgId } });
  await base.$disconnect();
});

test('encrypts plaintext tokens and is idempotent', async () => {
  const first = await backfillEncryptedSecrets(base);
  expect(first.connectedAdAccounts).toBe(1);
  const raw = await base.$queryRawUnsafe<any[]>(`select "accessToken" from "ConnectedAdAccount" where id = $1::uuid`, acctId);
  expect(isEncrypted(raw[0].accessToken)).toBe(true);
  const second = await backfillEncryptedSecrets(base);
  expect(second.connectedAdAccounts).toBe(0); // nothing left to do
});
