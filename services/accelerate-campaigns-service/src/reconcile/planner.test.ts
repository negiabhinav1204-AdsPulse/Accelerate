import { test, expect } from 'vitest';
import { topoSort } from './planner';
import type { ResourceNode } from './types';

const n = (localId: string, deps: string[]): ResourceNode => ({ type: 'campaign', localId, desired: {}, deps });

test('orders dependencies before dependents', () => {
  const out = topoSort([n('ad', ['ag']), n('ag', ['c']), n('c', ['b']), n('b', [])]).map((x) => x.localId);
  expect(out.indexOf('b')).toBeLessThan(out.indexOf('c'));
  expect(out.indexOf('c')).toBeLessThan(out.indexOf('ag'));
  expect(out.indexOf('ag')).toBeLessThan(out.indexOf('ad'));
});

test('throws on cycle', () => {
  expect(() => topoSort([n('a', ['b']), n('b', ['a'])])).toThrow('cycle detected');
});
