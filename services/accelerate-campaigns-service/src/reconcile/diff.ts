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
  const last = node.lastApplied;
  if (isEmpty(last) && !node.externalId) {
    return { node, operation: 'CREATE', changedFields: Object.keys(node.desired) };
  }
  if (isEmpty(node.desired) && !isEmpty(last)) {
    return { node, operation: 'DELETE', changedFields: [] };
  }
  const fields = changedFields(node.desired, last ?? {});
  return { node, operation: fields.length ? 'UPDATE' : 'NOOP', changedFields: fields };
}
