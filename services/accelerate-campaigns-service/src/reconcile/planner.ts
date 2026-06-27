import type { ResourceNode } from './types';

export function topoSort(nodes: ResourceNode[]): ResourceNode[] {
  const byId = new Map(nodes.map((n) => [n.localId, n]));
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const node of nodes) indeg.set(node.localId, 0);
  for (const node of nodes) {
    for (const dep of node.deps) {
      if (!byId.has(dep)) continue;
      indeg.set(node.localId, (indeg.get(node.localId) ?? 0) + 1);
      dependents.set(dep, [...(dependents.get(dep) ?? []), node.localId]);
    }
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const out: ResourceNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(byId.get(id)!);
    for (const d of dependents.get(id) ?? []) {
      indeg.set(d, (indeg.get(d) ?? 0) - 1);
      if (indeg.get(d) === 0) queue.push(d);
    }
  }
  if (out.length !== nodes.length) throw new Error('cycle detected');
  return out;
}
