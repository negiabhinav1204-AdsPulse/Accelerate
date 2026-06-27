import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted } from '@workspace/common/crypto';

export async function backfillEncryptedSecrets(base: PrismaClient) {
  let accounts = 0;
  const rows = await base.$queryRawUnsafe<any[]>(
    `select id, "accessToken", "refreshToken" from "ConnectedAdAccount"`,
  );
  for (const r of rows) {
    const updates: string[] = [];
    const params: any[] = [];
    if (typeof r.accessToken === 'string' && r.accessToken && !isEncrypted(r.accessToken)) {
      params.push(encryptField(r.accessToken));
      updates.push(`"accessToken" = $${params.length}`);
    }
    if (typeof r.refreshToken === 'string' && r.refreshToken && !isEncrypted(r.refreshToken)) {
      params.push(encryptField(r.refreshToken));
      updates.push(`"refreshToken" = $${params.length}`);
    }
    if (updates.length) {
      params.push(r.id);
      await base.$executeRawUnsafe(
        `update "ConnectedAdAccount" set ${updates.join(', ')} where id = $${params.length}::uuid`,
        ...params,
      );
      accounts++;
    }
  }

  let connectors = 0;
  const crows = await base.$queryRawUnsafe<any[]>(`select id, credentials from "CommerceConnector"`);
  for (const r of crows) {
    const cur = typeof r.credentials === 'string' ? r.credentials : JSON.stringify(r.credentials);
    if (cur && !isEncrypted(cur)) {
      await base.$executeRawUnsafe(
        `update "CommerceConnector" set credentials = $1 where id = $2::uuid`,
        encryptField(cur),
        r.id,
      );
      connectors++;
    }
  }
  return { connectedAdAccounts: accounts, commerceConnectors: connectors };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const base = new PrismaClient();
  backfillEncryptedSecrets(base)
    .then((r) => {
      console.log('Backfill complete:', r);
      return base.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
