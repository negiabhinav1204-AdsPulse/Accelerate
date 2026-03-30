/**
 * Image storage utility — Vercel Blob.
 *
 * Uploads base64-encoded images and returns a permanent public CDN URL.
 * Falls back gracefully (returns null) when BLOB_READ_WRITE_TOKEN is absent
 * so local dev / CI still works without credentials.
 *
 * Setup: Vercel dashboard → project → Storage → Create Blob store.
 * Vercel auto-adds BLOB_READ_WRITE_TOKEN to your project env vars.
 */

import { put } from '@vercel/blob';
import { createHash } from 'crypto';

/**
 * Upload a base64-encoded image to Vercel Blob.
 * Returns the permanent CDN URL on success, null if Blob is not configured.
 *
 * Files are keyed by a SHA-256 content hash for deduplication — identical
 * images from different campaigns share the same URL and are never re-uploaded.
 */
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
      addRandomSuffix: false, // use our own hash — deterministic, deduplicated
    });

    return url;
  } catch (err) {
    console.error('[blob] Upload failed:', err);
    return null;
  }
}
