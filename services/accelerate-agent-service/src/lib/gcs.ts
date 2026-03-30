/**
 * Image storage utility — Vercel Blob (microservice copy).
 * See apps/dashboard/lib/gcs.ts for full documentation.
 */

import { put } from '@vercel/blob';
import { createHash } from 'crypto';

export async function uploadImageToGCS(
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] ?? 'png';
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const pathname = `campaign-images/${hash}.${ext}`;

    const { url } = await put(pathname, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });

    return url;
  } catch (err) {
    console.error('[blob] Upload failed:', err);
    return null;
  }
}
