-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "type" VARCHAR(64) NOT NULL DEFAULT 'info';

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "phase" VARCHAR(16) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "triggeredBy" VARCHAR(20) NOT NULL,
    "overallScore" INTEGER,
    "scoreBreakdown" JSONB,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB,
    "savingsEstimate" JSONB,
    "accountsAudited" JSONB NOT NULL DEFAULT '[]',
    "dataWindowStart" TIMESTAMP(3),
    "dataWindowEnd" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IX_AuditReport_org_created" ON "AuditReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IX_Notification_userId_seenAt" ON "Notification"("userId", "seenAt");

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
