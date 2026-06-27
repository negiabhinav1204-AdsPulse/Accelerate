import { test, expect, beforeAll } from 'vitest';
import { encryptField, decryptField, isEncrypted } from './crypto';

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes hex
});

test('round-trips plaintext', () => {
  const enc = encryptField('super-secret-token');
  expect(enc).not.toContain('super-secret-token');
  expect(enc.startsWith('v1:')).toBe(true);
  expect(decryptField(enc)).toBe('super-secret-token');
});

test('passes through legacy plaintext on decrypt', () => {
  expect(decryptField('legacy-plaintext')).toBe('legacy-plaintext');
});

test('isEncrypted detects prefix', () => {
  expect(isEncrypted(encryptField('x'))).toBe(true);
  expect(isEncrypted('nope')).toBe(false);
});

test('tampered ciphertext throws', () => {
  const enc = encryptField('secret');
  const parts = enc.split(':');
  parts[3] = parts[3].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  expect(() => decryptField(parts.join(':'))).toThrow();
});
