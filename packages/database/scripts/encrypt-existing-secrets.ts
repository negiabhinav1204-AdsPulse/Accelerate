import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted } from '@workspace/common/crypto';

export async function backfillEncryptedSecrets(base: PrismaClient) {
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    throw new Error('FIELD_ENCRYPTION_KEY must be set before running the secrets backfill');
  }
  // ConnectedAdAccount tokens are encrypted at the application layer (symmetricEncrypt) — do NOT re-encrypt here.

  let connectors = 0;
  const crows = await base.$queryRawUnsafe<any[]>(`select id, credentials from "CommerceConnector"`);
  for (const r of crows) {
    const cur = typeof r.credentials === 'string' ? r.credentials : JSON.stringify(r.credentials);
    if (cur && !isEncrypted(cur)) {
      // The credentials column is jsonb; the encrypted ciphertext must be stored as a JSON string value.
      // Use to_json() to produce a valid jsonb string literal from the ciphertext.
      await base.$executeRawUnsafe(
        `update "CommerceConnector" set credentials = to_json($1::text)::jsonb where id = $2::uuid`,
        encryptField(cur),
        r.id,
      );
      connectors++;
    }
  }
  return { commerceConnectors: connectors };
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
