import type { ResourceNode, PlannedOp } from './types';

function changedFields(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
  return out.sort();
}

const isEmpty = (o?: Record<string, unknown> | null) => !o || Object.keys(o).length === 0;

export function diffNode(node: ResourceNode, _live?: Record<string, unknown>): PlannedOp {
  // _live reserved for 3-way; 2-way uses lastApplied only.
  // Fix #10: missing externalId always means CREATE — you can't UPDATE/DELETE a resource
  // with no platform id, even if lastApplied is set (e.g. after a failed prior create that
  // recorded state without persisting the externalId).
  if (!node.externalId) {
    return { node, operation: 'CREATE', changedFields: Object.keys(node.desired).sort() };
  }
  if (isEmpty(node.desired)) {
    return { node, operation: 'DELETE', changedFields: [] };
  }
  const fields = changedFields(node.desired, node.lastApplied ?? {});
  return { node, operation: fields.length ? 'UPDATE' : 'NOOP', changedFields: fields };
}
