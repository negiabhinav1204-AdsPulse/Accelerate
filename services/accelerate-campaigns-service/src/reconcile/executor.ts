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
  const created: { externalId: string }[] = [];
  let campaignExternalId: string | undefined;

  try {
    for (const node of ordered) {
      const plan = diffNode(node);
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
        created.push({ externalId });
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
    await recordItem({ platform, resourceType: 'campaign', operation: 'CREATE', status: 'FAILED', error: message });
    // best-effort rollback in reverse creation order
    for (const c of created.reverse()) {
      try { await adapter.delete(c.externalId, ctx); await recordItem({ platform, resourceType: 'campaign', externalId: c.externalId, operation: 'DELETE', status: 'ROLLED_BACK' }); }
      catch (rbErr) { console.error(`[reconcile] rollback failed for ${c.externalId}:`, rbErr); }
    }
    return { platform, success: false, error: message };
  }
}

import { prisma } from '@workspace/database/client';

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
