import { MonitoringProvider } from '@workspace/monitoring/provider';
import { assertEncryptionKey } from '@workspace/common/crypto';

export async function register() {
  // Fail-fast: ensure FIELD_ENCRYPTION_KEY is present and valid at boot time.
  // Guard to nodejs runtime only — edge/browser runtimes don't use field encryption.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    assertEncryptionKey();
  }
  await MonitoringProvider.register();
}

export const onRequestError = MonitoringProvider.captureRequestError;
