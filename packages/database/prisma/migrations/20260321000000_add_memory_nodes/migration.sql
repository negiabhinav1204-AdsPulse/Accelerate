-- CreateTable: OrgMemoryNode (core, without vector column — works without pgvector locally)
CREATE TABLE "OrgMemoryNode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orgId" UUID NOT NULL,
    "userId" UUID,
    "type" VARCHAR(64) NOT NULL,
    "key" VARCHAR(512) NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" VARCHAR(2048),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMemoryNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memory_node_unique" ON "OrgMemoryNode"("orgId", "userId", "type", "key");
CREATE INDEX "OrgMemoryNode_orgId_type_idx" ON "OrgMemoryNode"("orgId", "type");
CREATE INDEX "OrgMemoryNode_orgId_userId_type_idx" ON "OrgMemoryNode"("orgId", "userId", "type");

ALTER TABLE "OrgMemoryNode" ADD CONSTRAINT "OrgMemoryNode_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgMemoryNode" ADD CONSTRAINT "OrgMemoryNode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
