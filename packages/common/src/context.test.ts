import { test, expect } from 'vitest';
import { runWithContext, getContext } from './context';

test('defaults to system actor outside any scope', () => {
  expect(getContext()).toEqual({ actorType: 'system' });
});

test('exposes context inside scope', () => {
  const out = runWithContext(
    { actorId: 'u1', actorType: 'user', orgId: 'o1', requestId: 'r1' },
    () => getContext(),
  );
  expect(out).toEqual({ actorId: 'u1', actorType: 'user', orgId: 'o1', requestId: 'r1' });
});
