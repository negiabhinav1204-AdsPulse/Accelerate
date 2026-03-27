/**
 * Service Router — feature flag gateway for microservices.
 *
 * Each USE_*_SERVICE env var gates traffic to the Cloud Run service.
 * Set to 'false' (or unset) to fall back to the monolith instantly.
 * Flip in Vercel env vars — no deployment needed for rollback.
 */

export const SERVICES = {
  agent: {
    enabled: !!(process.env.AGENT_SERVICE_URL && process.env.USE_AGENT_SERVICE === 'true'),
    url: process.env.AGENT_SERVICE_URL ?? '',
  },
  sync: {
    enabled: !!(process.env.SYNC_SERVICE_URL && process.env.USE_SYNC_SERVICE === 'true'),
    url: process.env.SYNC_SERVICE_URL ?? '',
  },
  reporting: {
    enabled: !!(process.env.REPORTING_SERVICE_URL && process.env.USE_REPORTING_SERVICE === 'true'),
    url: process.env.REPORTING_SERVICE_URL ?? '',
  },
  memory: {
    enabled: !!(process.env.MEMORY_SERVICE_URL && process.env.USE_MEMORY_SERVICE === 'true'),
    url: process.env.MEMORY_SERVICE_URL ?? '',
  },
  chat: {
    enabled: !!(process.env.CHAT_SERVICE_URL && process.env.USE_CHAT_SERVICE === 'true'),
    url: process.env.CHAT_SERVICE_URL ?? '',
  },
  connector: {
    enabled: !!(process.env.CONNECTOR_SERVICE_URL && process.env.USE_CONNECTOR_SERVICE === 'true'),
    url: process.env.CONNECTOR_SERVICE_URL ?? '',
  },
  shoppingFeeds: {
    enabled: !!(process.env.SHOPPING_FEEDS_SERVICE_URL && process.env.USE_SHOPPING_FEEDS_SERVICE === 'true'),
    url: process.env.SHOPPING_FEEDS_SERVICE_URL ?? '',
  },
} as const;

/**
 * Forward a request to a Cloud Run microservice.
 * Adds the INTERNAL_API_KEY header for service-to-service auth.
 */
export async function callService(
  serviceUrl: string,
  path: string,
  body: unknown
): Promise<Response> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error('INTERNAL_API_KEY not set');

  return fetch(`${serviceUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalKey,
    },
    body: JSON.stringify(body),
  });
}

export async function getService(serviceUrl: string, path: string): Promise<Response> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error('INTERNAL_API_KEY not set');

  return fetch(`${serviceUrl}${path}`, {
    method: 'GET',
    headers: { 'x-internal-api-key': internalKey },
  });
}

export async function deleteService(serviceUrl: string, path: string, body?: unknown): Promise<Response> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error('INTERNAL_API_KEY not set');

  return fetch(`${serviceUrl}${path}`, {
    method: 'DELETE',
    headers: {
      'x-internal-api-key': internalKey,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

export async function patchService(
  serviceUrl: string,
  path: string,
  body: unknown
): Promise<Response> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error('INTERNAL_API_KEY not set');

  return fetch(`${serviceUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalKey,
    },
    body: JSON.stringify(body),
  });
}
