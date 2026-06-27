import type { FastifyInstance } from 'fastify';
import { runWithContext, type RequestContext } from '@workspace/common/context';

/**
 * Build a RequestContext from incoming Fastify request headers.
 */
export function buildCtx(request: { headers: Record<string, string | string[] | undefined> }): RequestContext {
  return {
    actorId: (request.headers['x-user-id'] as string) || undefined,
    orgId: (request.headers['x-org-id'] as string) || undefined,
    requestId: (request.headers['x-request-id'] as string) || undefined,
    actorType: request.headers['x-internal-api-key'] ? 'agent' : 'user',
  };
}

/**
 * Register the request-context onRequest hook on a Fastify server.
 *
 * Uses `storage.run(ctx, done)` (via `runWithContext`) rather than `enterWith` so that
 * the entire request lifecycle — including async hops in route handlers — runs inside
 * the correct AsyncLocalStorage scope.  `enterWith` only mutates the *current* async
 * context and does not propagate to the microtask/macrotask continuations that Fastify
 * schedules after the hook chain completes.
 */
export function registerRequestContext(server: FastifyInstance): void {
  server.addHook('onRequest', (request, _reply, done) => {
    const ctx = buildCtx(request as unknown as { headers: Record<string, string | string[] | undefined> });
    runWithContext(ctx, done);
  });
}
