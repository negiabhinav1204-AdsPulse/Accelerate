export type Platform = 'google' | 'meta' | 'bing';
export type ResourceType = 'budget' | 'campaign' | 'adgroup' | 'ad';
export type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP';

export interface ResourceNode {
  type: ResourceType;
  localId: string;
  externalId?: string;
  desired: Record<string, unknown>;
  lastApplied?: Record<string, unknown> | null;
  deps: string[]; // localIds this node depends on
}

export interface PlannedOp {
  node: ResourceNode;
  operation: Operation;
  changedFields: string[];
}
