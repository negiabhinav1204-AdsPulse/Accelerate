import { MonitoringProvider } from '@workspace/monitoring/provider';

export async function register() {
  await MonitoringProvider.register();
}

export const onRequestError = MonitoringProvider.captureRequestError;
