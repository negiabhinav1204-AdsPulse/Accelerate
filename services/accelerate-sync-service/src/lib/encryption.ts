import crypto from 'crypto';

const ALGORITHM = 'aes256';
const INPUT_ENCODING = 'utf8';
const OUTPUT_ENCODING = 'hex';
const IV_LENGTH = 16;

function deriveKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

export function symmetricDecrypt(text: string, key: string): string {
  const components = text.split(':');
  const iv = Buffer.from(components.shift() ?? '', OUTPUT_ENCODING);
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(key), iv);
  let deciphered = decipher.update(components.join(':'), OUTPUT_ENCODING, INPUT_ENCODING);
  deciphered += decipher.final(INPUT_ENCODING);
  return deciphered;
}
