import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorType = 'user' | 'agent' | 'system';

export interface RequestContext {
  actorId?: string;
  actorType: ActorType;
  orgId?: string;
  requestId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();
const SYSTEM: RequestContext = { actorType: 'system' };

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext {
  return storage.getStore() ?? SYSTEM;
}
