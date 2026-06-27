/**
 * C1 gate: proves that request context survives an async hop in a Fastify route handler.
 *
 * The critical insight: `storage.enterWith()` only affects the current async context.
 * Fastify schedules the route handler as a separate async task, so `enterWith` in
 * onRequest does NOT propagate — `storage.run(ctx, done)` must be used instead.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { getContext } from '@workspace/common/context';
import { registerRequestContext } from './request-context-hook.js';

async function buildTestServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });

  // Register the SAME hook used in production index.ts
  registerRequestContext(server);

  // Probe route: performs an async hop then reads context
  server.get('/_ctxprobe', async (_req, _reply) => {
    // Async hop 1: microtask tick
    await Promise.resolve();
    // Async hop 2: macrotask tick (setTimeout via promise)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return getContext();
  });

  await server.ready();
  return server;
}

describe('request context propagation through async hops', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('propagates user context (actorId, orgId, requestId, actorType=user) after two async hops', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/_ctxprobe',
      headers: {
        'x-user-id': 'u-123',
        'x-org-id': 'o-456',
        'x-request-id': 'r-789',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      actorId: 'u-123',
      orgId: 'o-456',
      requestId: 'r-789',
      actorType: 'user',
    });
  });

  it('propagates agent context (actorType=agent) when x-internal-api-key is present', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/_ctxprobe',
      headers: {
        'x-user-id': 'svc-agent',
        'x-org-id': 'o-999',
        'x-request-id': 'r-agent-1',
        'x-internal-api-key': 'secret-key',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      actorId: 'svc-agent',
      orgId: 'o-999',
      requestId: 'r-agent-1',
      actorType: 'agent',
    });
  });
});
