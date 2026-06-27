import { test, expect } from 'vitest';
import { diffNode } from './diff';
import type { ResourceNode } from './types';

const base = (over: Partial<ResourceNode>): ResourceNode => ({ type: 'campaign', localId: 'c', desired: {}, deps: [], ...over });

test('CREATE when no lastApplied and no externalId', () => {
  expect(diffNode(base({ desired: { name: 'A' } })).operation).toBe('CREATE');
});
test('NOOP when desired equals lastApplied', () => {
  expect(diffNode(base({ externalId: 'x', desired: { name: 'A' }, lastApplied: { name: 'A' } })).operation).toBe('NOOP');
});
test('UPDATE with changed fields', () => {
  const op = diffNode(base({ externalId: 'x', desired: { name: 'B', budget: 5 }, lastApplied: { name: 'A', budget: 5 } }));
  expect(op.operation).toBe('UPDATE');
  expect(op.changedFields).toEqual(['name']);
});
test('DELETE when desired empty but lastApplied present', () => {
  expect(diffNode(base({ externalId: 'x', desired: {}, lastApplied: { name: 'A' } })).operation).toBe('DELETE');
});
// Fix #10: lastApplied set but no externalId → CREATE (can't update without a platform id)
test('CREATE when lastApplied set but externalId absent', () => {
  const op = diffNode(base({ desired: { name: 'A' }, lastApplied: { name: 'A' } }));
  expect(op.operation).toBe('CREATE');
  expect(op.changedFields).toEqual(['name']);
});
