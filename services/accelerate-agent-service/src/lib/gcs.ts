/**
 * GCS image storage utility (microservice copy).
 * See apps/dashboard/lib/gcs.ts for full documentation.
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
    return null;
  }
}

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

    const [exists] = await file.exists();
    if (!exists) {
      await file.save(buffer, {
        metadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' },
        public: true,
        resumable: false,
      });
    }

    return `https://storage.googleapis.com/${bucketName}/${objectName}`;
  } catch (err) {
    console.error('[gcs] Upload failed:', err);
    return null;
  }
}
