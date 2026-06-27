import crypto from 'node:crypto';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must decode to 32 bytes (256-bit)');
  }
  return key;
}

/**
 * Fail-fast check for FIELD_ENCRYPTION_KEY. Available for future DB-layer encryption.
 * Currently uncalled — secret fields are encrypted by their owning application layers.
 * Do NOT call at module import time.
 */
export function assertEncryptionKey(): void {
  getKey(); // throws if missing or wrong length
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext
  const [, ivHex, tagHex, ...rest] = stored.split(':');
  const ctHex = rest.join(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
