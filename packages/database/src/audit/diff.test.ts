import { test, expect } from 'vitest';
import { computeFieldDiff } from './diff';

test('captures only changed fields', () => {
  const d = computeFieldDiff(
    { name: 'A', budget: 10, status: 'draft' },
    { name: 'A', budget: 20, status: 'paused' },
    ['name', 'budget', 'status'],
  );
  expect(d).toEqual({
    budget: { old: 10, new: 20 },
    status: { old: 'draft', new: 'paused' },
  });
});

test('deep-compares json values', () => {
  const d = computeFieldDiff(
    { targeting: { age: [18, 35] } },
    { targeting: { age: [18, 45] } },
    ['targeting'],
  );
  expect(d.targeting).toEqual({ old: { age: [18, 35] }, new: { age: [18, 45] } });
});

test('returns empty when nothing changed', () => {
  expect(computeFieldDiff({ a: 1 }, { a: 1 }, ['a'])).toEqual({});
});
