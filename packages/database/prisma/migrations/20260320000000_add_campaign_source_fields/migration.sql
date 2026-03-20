-- Add FAILED status to CampaignStatus enum
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'failed';

-- Add source fields and archivedAt to Campaign
ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "source"             VARCHAR(50)  NOT NULL DEFAULT 'accelerate',
  ADD COLUMN IF NOT EXISTS "acceId"             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "externalCampaignId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "archivedAt"         TIMESTAMP(3);

-- Unique index on acceId (partial — only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Campaign_acceId"
  ON "Campaign"("acceId") WHERE "acceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IX_Campaign_source"
  ON "Campaign"("source");

CREATE INDEX IF NOT EXISTS "IX_Campaign_archivedAt"
  ON "Campaign"("archivedAt");
