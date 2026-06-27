import { prisma } from '@workspace/database/client';
import { topoSort } from './planner';
import { diffNode } from './diff';
import type { ResourceNode, Platform } from './types';
import type { PlatformAdapter, AdapterCtx } from './adapters/types';

export interface RunItem {
  platform: Platform; resourceType: string; localId?: string; externalId?: string;
  operation: string; status: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'NOOP'; error?: string; durationMs?: number;
}
export interface PlatformOutcome { platform: Platform; success: boolean; externalId?: string; error?: string }

export interface ReconcilePlatformArgs {
  platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx; runId: string;
  recordItem: (item: RunItem) => Promise<void>;
}

export async function reconcilePlatform(args: ReconcilePlatformArgs): Promise<PlatformOutcome> {
  const { platform, adapter, ctx, recordItem } = args;
  const ordered = topoSort(args.nodes);
  const created: { externalId: string; resourceType: string }[] = [];
  let campaignExternalId: string | undefined;

  // Fix 2: non-throwing wrapper so catch/rollback path can never escape and strand the run
  const safeRecord = async (item: RunItem) => {
    try { await recordItem(item); } catch (e) { console.error('[reconcile] recordItem failed:', e); }
  };

  // Fix 1: track currently-executing node + operation outside the loop so the catch block has context
  let currentNode: ResourceNode | undefined;
  let currentOp: string = 'unknown';

  try {
    for (const node of ordered) {
      const plan = diffNode(node);
      currentNode = node;
      currentOp = plan.operation;
      const isChild = node.type === 'adgroup' || node.type === 'ad';
      // Tree-create platforms build children inside the campaign create call.
      if (adapter.treeCreate && isChild && plan.operation === 'CREATE') {
        await recordItem({ platform, resourceType: node.type, localId: node.localId, operation: 'NOOP', status: 'NOOP' });
        continue;
      }
      const started = Date.now();
      if (plan.operation === 'NOOP') {
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'NOOP', status: 'NOOP' });
        continue;
      }
      if (plan.operation === 'CREATE') {
        const { externalId } = await adapter.create(node, ctx);
        created.push({ externalId, resourceType: node.type });
        if (node.type === 'campaign') campaignExternalId = externalId;
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId, operation: 'CREATE', status: 'SUCCESS', durationMs: Date.now() - started });
      } else if (plan.operation === 'UPDATE') {
        await adapter.update(node, node.externalId!, plan.changedFields, ctx);
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'UPDATE', status: 'SUCCESS', durationMs: Date.now() - started });
      } else if (plan.operation === 'DELETE') {
        await adapter.delete(node.externalId!, ctx);
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'DELETE', status: 'SUCCESS', durationMs: Date.now() - started });
      }
    }
    return { platform, success: true, externalId: campaignExternalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Fix 1: use currentNode/currentOp for real resource context; Fix 2: use safeRecord so this cannot throw
    await safeRecord({ platform, resourceType: currentNode?.type ?? 'unknown', localId: currentNode?.localId, operation: currentOp, status: 'FAILED', error: message });
    // best-effort rollback in reverse creation order
    for (const c of [...created].reverse()) {
      try {
        await adapter.delete(c.externalId, ctx);
        // Fix 2: use safeRecord for rollback records so a DB failure here cannot strand the run
        await safeRecord({ platform, resourceType: c.resourceType, externalId: c.externalId, operation: 'DELETE', status: 'ROLLED_BACK' });
      } catch (rbErr) { console.error(`[reconcile] rollback failed for ${c.externalId}:`, rbErr); }
    }
    return { platform, success: false, error: message };
  }
}

export interface RunReconcileArgs {
  campaignId: string; organizationId: string; trigger: 'publish' | 'edit' | 'retry';
  platforms: { platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx }[];
}
export interface RunSummary { runId: string; status: 'SUCCESS' | 'PARTIAL' | 'FAILED'; platformResults: PlatformOutcome[] }

export async function runReconcile(args: RunReconcileArgs): Promise<RunSummary> {
  const run = await prisma.campaignRun.create({
    data: { campaignId: args.campaignId, organizationId: args.organizationId, trigger: args.trigger, status: 'RUNNING' },
  });
  const recordItem = (item: RunItem) => prisma.campaignRunItem.create({ data: { runId: run.id, ...item } }).then(() => {});
  const results = await Promise.all(
    args.platforms.map((p) => reconcilePlatform({ ...p, runId: run.id, recordItem })),
  );
  const ok = results.filter((r) => r.success).length;
  const status = ok === results.length ? 'SUCCESS' : ok === 0 ? 'FAILED' : 'PARTIAL';
  await prisma.campaignRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date() } });
  return { runId: run.id, status, platformResults: results };
}
