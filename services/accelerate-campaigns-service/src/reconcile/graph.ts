import type { Platform, ResourceNode } from './types';

export interface GraphAdInput {
  localId: string;
  externalId?: string;
  desired: Record<string, unknown>;
  lastApplied?: Record<string, unknown> | null;
}

export interface GraphAdGroupInput {
  localId: string;
  externalId?: string;
  desired: Record<string, unknown>;
  lastApplied?: Record<string, unknown> | null;
  ads: GraphAdInput[];
}

export interface PlatformGraphInput {
  platform: Platform;
  campaignLocalId: string;
  campaignExternalId?: string;
  campaignDesired: Record<string, unknown>;
  campaignLastApplied?: Record<string, unknown> | null;
  budget: {
    localId: string;
    externalId?: string;
    desired: Record<string, unknown>;
    lastApplied?: Record<string, unknown> | null;
  };
  adGroups: GraphAdGroupInput[];
}

export function buildPlatformGraph(input: PlatformGraphInput): ResourceNode[] {
  const nodes: ResourceNode[] = [];

  // Budget node
  nodes.push({
    type: 'budget',
    localId: input.budget.localId,
    externalId: input.budget.externalId,
    desired: input.budget.desired,
    lastApplied: input.budget.lastApplied ?? null,
    deps: [],
  });

  // Campaign node - depends on budget
  nodes.push({
    type: 'campaign',
    localId: input.campaignLocalId,
    externalId: input.campaignExternalId,
    desired: input.campaignDesired,
    lastApplied: input.campaignLastApplied ?? null,
    deps: [input.budget.localId],
  });

  // AdGroup nodes - depend on campaign; Ad nodes - depend on adgroup
  for (const ag of input.adGroups) {
    nodes.push({
      type: 'adgroup',
      localId: ag.localId,
      externalId: ag.externalId,
      desired: ag.desired,
      lastApplied: ag.lastApplied ?? null,
      deps: [input.campaignLocalId],
    });

    for (const ad of ag.ads) {
      nodes.push({
        type: 'ad',
        localId: ad.localId,
        externalId: ad.externalId,
        desired: ad.desired,
        lastApplied: ad.lastApplied ?? null,
        deps: [ag.localId],
      });
    }
  }

  return nodes;
}
