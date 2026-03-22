-- Optional migration: adds pgvector embedding column to OrgMemoryNode.
-- Run this ONLY on Neon (production) where pgvector is pre-installed.
-- Local dev works without this migration — memory falls back to recency-based search.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "OrgMemoryNode" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

CREATE INDEX IF NOT EXISTS "OrgMemoryNode_embedding_idx"
  ON "OrgMemoryNode" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 50);
