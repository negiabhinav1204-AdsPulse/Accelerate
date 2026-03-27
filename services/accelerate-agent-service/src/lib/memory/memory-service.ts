/**
 * Memory Service — persistent self-learning context for the campaign chat.
 *
 * Stores per-org and per-user memory nodes in OrgMemoryNode (pgvector).
 * Supports semantic search, upsert-merge, confidence decay, and archiving.
 */

import { prisma } from '../db';
import { generateEmbedding, vectorToSql } from './embedding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryNodeType =
  | 'brand_profile'       // brand colors, fonts, tone, country, industry (org-level)
  | 'lpu_profile'         // landing page type, pixel status, trust signals (org-level)
  | 'campaign_preference' // preferred platform, budget, duration, objective (user-level)
  | 'competitor_snapshot' // competitor landscape (org-level)
  | 'trend_snapshot'      // industry trends, seasonal signals (org-level, 30-day TTL)
  | 'media_plan_feedback' // what user changed in media plan (user-level)
  | 'seasonal_intent'     // user-stated seasonal campaigns like Diwali (user-level)
  | 'creative_preference';// which creative variations user preferred/rejected (user-level)

export type MemoryNode = {
  id: string;
  orgId: string;
  userId: string | null;
  type: MemoryNodeType;
  key: string;
  summary: string;
  content: Record<string, unknown>;
  confidence: number;
  accessCount: number;
  sourceUrl: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertMemoryParams = {
  orgId: string;
  userId?: string;
  type: MemoryNodeType;
  key: string;
  summary: string;
  content: Record<string, unknown>;
  sourceUrl?: string;
  confidenceDelta?: number; // positive = boost, negative = reduce
};

// ---------------------------------------------------------------------------
// Brand cache staleness
// ---------------------------------------------------------------------------

const BRAND_CACHE_TTL_DAYS = 90;
const TREND_CACHE_TTL_DAYS = 30;

export function isBrandCacheValid(node: MemoryNode): boolean {
  if (node.confidence < 0.5) return false;
  const ageMs = Date.now() - node.updatedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < BRAND_CACHE_TTL_DAYS;
}

export function isTrendCacheValid(node: MemoryNode): boolean {
  if (node.confidence < 0.5) return false;
  const ageMs = Date.now() - node.updatedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < TREND_CACHE_TTL_DAYS;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Get a single memory node by exact type+key lookup.
 */
export async function getMemoryNode(
  orgId: string,
  userId: string | undefined,
  type: MemoryNodeType,
  key: string
): Promise<MemoryNode | null> {
  try {
    const row = await prisma.orgMemoryNode.findFirst({
      where: {
        orgId,
        userId: userId ?? null,
        type,
        key,
        archivedAt: null
      }
    });
    if (!row) return null;

    // Increment access count (fire-and-forget)
    void prisma.orgMemoryNode.update({
      where: { id: row.id },
      data: { accessCount: { increment: 1 } }
    });

    return row as unknown as MemoryNode;
  } catch {
    return null;
  }
}

/**
 * Upsert a memory node — creates if new, merges content if existing.
 * Generates embedding for the summary for future semantic search.
 */
export async function upsertMemoryNode(params: UpsertMemoryParams): Promise<void> {
  const { orgId, userId, type, key, summary, content, sourceUrl, confidenceDelta = 0 } = params;

  // Generate embedding (non-blocking on failure)
  const embeddingValues = await generateEmbedding(summary);

  try {
    const existing = await prisma.orgMemoryNode.findFirst({
      where: { orgId, userId: userId ?? null, type, key, archivedAt: null }
    });

    if (existing) {
      // Merge content with existing
      const mergedContent = { ...(existing.content as Record<string, unknown>), ...content };
      const newConfidence = Math.min(1.0, Math.max(0.0, existing.confidence + confidenceDelta));

      const updateData: Record<string, unknown> = {
        summary,
        content: mergedContent,
        confidence: newConfidence,
        sourceUrl: sourceUrl ?? existing.sourceUrl,
        updatedAt: new Date()
      };

      if (embeddingValues) {
        // Use raw SQL to update the vector field
        await prisma.$executeRawUnsafe(
          `UPDATE "OrgMemoryNode" SET summary = $1, content = $2::jsonb, confidence = $3, "sourceUrl" = $4, "updatedAt" = NOW(), embedding = $5::vector WHERE id = $6`,
          summary,
          JSON.stringify(mergedContent),
          newConfidence,
          sourceUrl ?? existing.sourceUrl,
          vectorToSql(embeddingValues),
          existing.id
        );
      } else {
        await prisma.orgMemoryNode.update({
          where: { id: existing.id },
          data: updateData as Parameters<typeof prisma.orgMemoryNode.update>[0]['data']
        });
      }
    } else {
      const id = crypto.randomUUID();
      const newConfidence = Math.min(1.0, Math.max(0.1, 1.0 + confidenceDelta));

      if (embeddingValues) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "OrgMemoryNode" (id, "orgId", "userId", type, key, summary, content, embedding, confidence, "accessCount", "sourceUrl", "createdAt", "updatedAt")
           VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb, $8::vector, $9, 0, $10, NOW(), NOW())`,
          id,
          orgId,
          userId ?? null,
          type,
          key,
          summary,
          JSON.stringify(content),
          vectorToSql(embeddingValues),
          newConfidence,
          sourceUrl ?? null
        );
      } else {
        await prisma.orgMemoryNode.create({
          data: {
            orgId,
            userId: userId ?? null,
            type,
            key,
            summary,
            content: content as Parameters<typeof prisma.orgMemoryNode.create>[0]['data']['content'],
            confidence: newConfidence,
            sourceUrl: sourceUrl ?? null
          }
        });
      }
    }
  } catch (err) {
    console.error('[memory] upsertMemoryNode failed', err);
  }
}

/**
 * Semantic search — find the most relevant memory nodes for a query.
 */
export async function searchMemory(
  orgId: string,
  userId: string | undefined,
  query: string,
  topK = 5
): Promise<MemoryNode[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    // Fall back to recency-based retrieval without vector search
    const rows = await prisma.orgMemoryNode.findMany({
      where: { orgId, archivedAt: null, OR: [{ userId: null }, { userId: userId ?? null }] },
      orderBy: { updatedAt: 'desc' },
      take: topK
    });
    return rows as unknown as MemoryNode[];
  }

  try {
    const rows = await prisma.$queryRawUnsafe<MemoryNode[]>(
      `SELECT id, "orgId", "userId", type, key, summary, content, confidence, "accessCount", "sourceUrl", "archivedAt", "createdAt", "updatedAt",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "OrgMemoryNode"
       WHERE "orgId" = $2::uuid
         AND "archivedAt" IS NULL
         AND ("userId" IS NULL OR "userId" = $3::uuid)
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      vectorToSql(embedding),
      orgId,
      userId ?? null,
      topK
    );
    return rows;
  } catch (err) {
    console.error('[memory] searchMemory failed', err);
    return [];
  }
}

/**
 * Load all active memory nodes for an org (for injecting into agent context).
 */
export async function loadOrgMemory(
  orgId: string,
  userId: string | undefined,
  types?: MemoryNodeType[]
): Promise<MemoryNode[]> {
  try {
    const rows = await prisma.orgMemoryNode.findMany({
      where: {
        orgId,
        archivedAt: null,
        OR: [{ userId: null }, { userId: userId ?? null }],
        ...(types ? { type: { in: types } } : {})
      },
      orderBy: { updatedAt: 'desc' }
    });
    return rows as unknown as MemoryNode[];
  } catch {
    return [];
  }
}

/**
 * Prune low-confidence nodes (confidence < 0.2) by archiving them.
 * Also decays confidence for nodes not accessed in 30+ days.
 */
export async function pruneMemory(orgId: string): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Archive very low confidence nodes
    await prisma.orgMemoryNode.updateMany({
      where: { orgId, confidence: { lt: 0.2 }, archivedAt: null },
      data: { archivedAt: now }
    });

    // Decay confidence for stale nodes (not accessed in 30 days)
    await prisma.$executeRaw`
      UPDATE "OrgMemoryNode"
      SET confidence = GREATEST(0.0, confidence - 0.05)
      WHERE "orgId" = ${orgId}
        AND "archivedAt" IS NULL
        AND "updatedAt" < ${thirtyDaysAgo}
    `;
  } catch (err) {
    console.error('[memory] pruneMemory failed', err);
  }
}

/**
 * Delete a specific memory node (for user-initiated deletion from settings).
 */
export async function deleteMemoryNode(id: string, orgId: string): Promise<void> {
  await prisma.orgMemoryNode.deleteMany({ where: { id, orgId } });
}

/**
 * Update a memory node's content (for user-initiated edits from settings).
 */
export async function updateMemoryNodeContent(
  id: string,
  orgId: string,
  content: Record<string, unknown>,
  summary: string
): Promise<void> {
  const embedding = await generateEmbedding(summary);
  if (embedding) {
    await prisma.$executeRawUnsafe(
      `UPDATE "OrgMemoryNode" SET content = $1::jsonb, summary = $2, embedding = $3::vector, "updatedAt" = NOW() WHERE id = $4 AND "orgId" = $5::uuid`,
      JSON.stringify(content),
      summary,
      vectorToSql(embedding),
      id,
      orgId
    );
  } else {
    await prisma.orgMemoryNode.updateMany({
      where: { id, orgId },
      data: { content: content as Parameters<typeof prisma.orgMemoryNode.updateMany>[0]['data']['content'], summary }
    });
  }
}
