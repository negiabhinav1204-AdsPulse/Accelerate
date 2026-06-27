import { test, expect, vi } from 'vitest';
import { reconcilePlatform } from './executor';
import type { PlatformAdapter } from './adapters/types';
import type { ResourceNode } from './types';

const okAdapter = (): PlatformAdapter => ({
  treeCreate: true,
  create: vi.fn(async () => ({ externalId: 'ext-1' })),
  // Fix #8: update now returns { applied: boolean }
  update: vi.fn(async () => ({ applied: true })),
  delete: vi.fn(async () => {}),
});

const nodes: ResourceNode[] = [
  { type: 'budget', localId: 'b', desired: { amount: 1 }, deps: [] },
  { type: 'campaign', localId: 'c', desired: { name: 'C' }, deps: ['b'] },
];

test('clean create returns success + externalId, records items', async () => {
  const items: any[] = [];
  const adapter = okAdapter();
  const createMock = adapter.create as ReturnType<typeof vi.fn>;
  const out = await reconcilePlatform({
    platform: 'meta', nodes, adapter,
    ctx: {} as any, runId: 'r1', recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(true);
  expect(out.externalId).toBe('ext-1');
  expect(items.some((i) => i.status === 'SUCCESS')).toBe(true);
  // Regression guard: treeCreate adapter must call create EXACTLY ONCE (campaign node only).
  // Budget node CREATE must be folded into a NOOP to prevent double-create on the platform.
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(items.some((i) => i.resourceType === 'budget' && i.status === 'NOOP')).toBe(true);
});

test('failure on create (immediate throw) records FAILED and returns error', async () => {
  const del = vi.fn(async () => {});
  const adapter: PlatformAdapter = {
    treeCreate: true,
    create: vi.fn(async () => { throw new Error('meta 400'); }),
    update: vi.fn(async () => ({ applied: true })),
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

test('fix #2: recordItem throwing after successful create must not trigger rollback or delete', async () => {
  // Simulates a transient DB error when writing the SUCCESS run-item after adapter.create()
  // already made the campaign live on the platform.
  const deleteMock = vi.fn(async () => {});
  const createMock = vi.fn(async () => ({ externalId: 'ext-live' }));
  let callCount = 0;
  const adapter: PlatformAdapter = {
    treeCreate: true,
    create: createMock,
    update: vi.fn(async () => ({ applied: true })),
    delete: deleteMock,
  };
  const out = await reconcilePlatform({
    platform: 'meta',
    nodes,
    adapter,
    ctx: {} as any,
    runId: 'r-db-blip',
    recordItem: async () => {
      callCount++;
      // Throw on the second call (the SUCCESS record after campaign CREATE).
      if (callCount === 2) throw new Error('DB connection reset');
    },
  });
  // The run must still report success — the campaign is live on the platform.
  expect(out.success).toBe(true);
  expect(out.externalId).toBe('ext-live');
  // The adapter delete MUST NOT have been called — no rollback of a live campaign.
  expect(deleteMock).not.toHaveBeenCalled();
});

test('rollback: CREATE succeeds for budget, fails for campaign → rolls back budget and records ROLLED_BACK', async () => {
  // Use a NON-treeCreate adapter so each node creates independently (per-resource model).
  // With treeCreate, budget CREATE is NOOP so there would be nothing to roll back.
  const deleteMock = vi.fn(async () => {});
  const adapter: PlatformAdapter = {
    treeCreate: false,
    create: vi.fn(async (node: ResourceNode) => {
      if (node.type === 'budget') return { externalId: 'ext-budget' };
      throw new Error('campaign create failed');
    }),
    update: vi.fn(async () => ({ applied: true })),
    delete: deleteMock,
  };
  const rollbackNodes: ResourceNode[] = [
    { type: 'budget', localId: 'b', desired: { amount: 1 }, deps: [] },
    { type: 'campaign', localId: 'c', desired: { name: 'C' }, deps: ['b'] },
  ];
  const items: any[] = [];
  const out = await reconcilePlatform({
    platform: 'meta', nodes: rollbackNodes, adapter, ctx: {} as any, runId: 'r2',
    recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(false);
  expect(items.some((i) => i.status === 'FAILED')).toBe(true);
  // rollback must have deleted the successfully-created budget
  expect(deleteMock).toHaveBeenCalledWith('ext-budget', expect.anything());
  expect(items.some((i) => i.status === 'ROLLED_BACK' && i.externalId === 'ext-budget')).toBe(true);
});
