import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isEncrypted } from '@workspace/common/crypto';
import { backfillEncryptedSecrets } from './encrypt-existing-secrets';

const base = new PrismaClient();
let orgId: string;
let connectorId: string;

beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  const org = await base.organization.create({ data: { name: 'bf-org', slug: `bf-${Date.now()}` } as any });
  orgId = org.id;
  // Insert raw plaintext credentials, bypassing the extension
  const connector = await base.commerceConnector.create({
    data: {
      organizationId: orgId,
      platform: 'SHOPIFY',
      name: 'backfill-test-store',
      credentials: JSON.stringify({ apiKey: 'raw-key' }),
    },
  });
  connectorId = connector.id;
});

afterAll(async () => {
  await base.commerceConnector.deleteMany({ where: { organizationId: orgId } });
  await base.organization.delete({ where: { id: orgId } });
  await base.$disconnect();
});

test('encrypts plaintext CommerceConnector credentials and is idempotent', async () => {
  const first = await backfillEncryptedSecrets(base);
  expect(first.commerceConnectors).toBeGreaterThanOrEqual(1);
  const raw = await base.$queryRawUnsafe<any[]>(
    `select credentials from "CommerceConnector" where id = $1::uuid`,
    connectorId,
  );
  const storedValue = typeof raw[0].credentials === 'string' ? raw[0].credentials : JSON.stringify(raw[0].credentials);
  expect(isEncrypted(storedValue)).toBe(true);
  const second = await backfillEncryptedSecrets(base);
  expect(second.commerceConnectors).toBe(0); // nothing left to encrypt
});
