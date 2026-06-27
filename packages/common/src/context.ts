import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorType = 'user' | 'agent' | 'system';

export interface RequestContext {
  actorId?: string;
  actorType: ActorType;
  orgId?: string;
  requestId?: string;
}

const STORAGE_KEY = Symbol.for('__workspace_request_context__');
declare const globalThis: Record<symbol, AsyncLocalStorage<RequestContext>>;
if (!globalThis[STORAGE_KEY]) {
  globalThis[STORAGE_KEY] = new AsyncLocalStorage<RequestContext>();
}
const storage = globalThis[STORAGE_KEY];

const SYSTEM: RequestContext = { actorType: 'system' };

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  const result = storage.run(ctx, fn);
  // Prisma (and other lazy-Promise libraries) defer execution until the Promise is awaited.
  // If the returned value is a thenable, re-subscribe within the ALS scope so that the
  // deferred execution chain runs in the correct context.
  if (result !== null && result !== undefined && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
    return storage.run(ctx, () =>
      new Promise<Awaited<T>>((resolve, reject) => {
        (result as unknown as Promise<Awaited<T>>).then(resolve, reject);
      }),
    ) as T;
  }
  return result;
}

export function getContext(): RequestContext {
  return storage.getStore() ?? SYSTEM;
}

export function enterContext(ctx: RequestContext): void {
  storage.enterWith(ctx);
}
