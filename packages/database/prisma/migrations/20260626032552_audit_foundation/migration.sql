-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "lastAppliedState" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AdGroup" ADD COLUMN     "lastAppliedState" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PlatformCampaign" ADD COLUMN     "lastAppliedState" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorId" UUID,
    "actorType" VARCHAR(16) NOT NULL DEFAULT 'user',
    "entityType" VARCHAR(64) NOT NULL,
    "entityId" UUID NOT NULL,
    "operation" VARCHAR(16) NOT NULL,
    "diff" JSONB NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "requestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
