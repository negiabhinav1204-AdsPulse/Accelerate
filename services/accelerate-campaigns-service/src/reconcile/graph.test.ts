import { test, expect } from 'vitest';
import { buildPlatformGraph } from './graph';

test('builds budget -> campaign -> adgroup -> ad with deps', () => {
  const nodes = buildPlatformGraph({
    platform: 'meta',
    campaignLocalId: 'c1',
    campaignDesired: { name: 'C', objective: 'SALES' },
    budget: { localId: 'b1', desired: { amount: 100 } },
    adGroups: [
      { localId: 'ag1', desired: { name: 'AG' }, ads: [{ localId: 'ad1', desired: { headlines: ['h'] } }] },
    ],
  });
  const byType = (t: string) => nodes.filter((n) => n.type === t);
  expect(byType('budget')).toHaveLength(1);
  expect(byType('campaign')[0].deps).toContain('b1');
  expect(byType('adgroup')[0].deps).toContain('c1');
  expect(byType('ad')[0].deps).toContain('ag1');
});
