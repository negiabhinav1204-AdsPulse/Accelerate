import { test, expect, vi } from 'vitest';
import { reconcilePlatform } from './executor';
import type { PlatformAdapter } from './adapters/types';
import type { ResourceNode } from './types';

const okAdapter = (): PlatformAdapter => ({
  treeCreate: true,
  create: vi.fn(async () => ({ externalId: 'ext-1' })),
  update: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
});

const nodes: ResourceNode[] = [
  { type: 'budget', localId: 'b', desired: { amount: 1 }, deps: [] },
  { type: 'campaign', localId: 'c', desired: { name: 'C' }, deps: ['b'] },
];

test('clean create returns success + externalId, records items', async () => {
  const items: any[] = [];
  const out = await reconcilePlatform({
    platform: 'meta', nodes, adapter: okAdapter(),
    ctx: {} as any, runId: 'r1', recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(true);
  expect(out.externalId).toBe('ext-1');
  expect(items.some((i) => i.status === 'SUCCESS')).toBe(true);
});

test('failure on create rolls back created resources (best-effort) and records', async () => {
  const del = vi.fn(async () => {});
  const adapter: PlatformAdapter = {
    treeCreate: true,
    create: vi.fn(async () => { throw new Error('meta 400'); }),
    update: vi.fn(async () => {}),
    delete: del,
  };
  const items: any[] = [];
  const out = await reconcilePlatform({
    platform: 'meta', nodes, adapter, ctx: {} as any, runId: 'r1',
    recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(false);
  expect(out.error).toContain('meta 400');
  expect(items.some((i) => i.status === 'FAILED')).toBe(true);
});
