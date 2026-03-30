/**
 * GCS image storage utility.
 *
 * Uploads base64-encoded images to Google Cloud Storage and returns a
 * permanent public CDN URL. When GCS env vars are absent the function returns
 * null and the caller falls back to storing the raw base64 data-URI.
 *
 * Required env vars:
 *   GCS_BUCKET_NAME          — e.g. "accelerate-campaign-images"
 *   GCS_SERVICE_ACCOUNT_KEY  — full service-account JSON (single line or multiline)
 */

import { Storage } from '@google-cloud/storage';
import { createHash } from 'crypto';

let _storage: Storage | null = null;

function getStorage(): Storage | null {
  const keyRaw = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (!keyRaw || !process.env.GCS_BUCKET_NAME) return null;
  if (_storage) return _storage;
  try {
    _storage = new Storage({ credentials: JSON.parse(keyRaw) });
    return _storage;
  } catch {
    console.error('[gcs] Failed to parse GCS_SERVICE_ACCOUNT_KEY');
    return null;
  }
}

/**
 * Upload a base64-encoded image to GCS.
 * Returns the public CDN URL on success, null if GCS is not configured.
 *
 * Files are keyed by a SHA-256 content hash so identical images are
 * deduplicated automatically (same behaviour as the reference platform).
 */
export async function uploadImageToGCS(
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  const storage = getStorage();
  if (!storage) return null;

  const bucketName = process.env.GCS_BUCKET_NAME!;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] ?? 'png';
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const objectName = `campaign-images/${hash}.${ext}`;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    // Skip upload if the file already exists (content-addressed dedup)
    const [exists] = await file.exists();
    if (!exists) {
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000, immutable'
        },
        public: true,
        resumable: false // faster for small files
      });
    }

    return `https://storage.googleapis.com/${bucketName}/${objectName}`;
  } catch (err) {
    console.error('[gcs] Upload failed:', err);
    return null;
  }
}
