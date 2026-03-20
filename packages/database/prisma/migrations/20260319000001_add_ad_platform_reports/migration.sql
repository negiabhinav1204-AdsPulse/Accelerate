-- Add AdPlatformReport table for Tier 1 data pipeline results
-- and lastSyncAt to ConnectedAdAccount

ALTER TABLE "ConnectedAdAccount" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "AdPlatformReport" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"     UUID         NOT NULL,
  "connectedAccountId" UUID         NOT NULL,
  "platform"           VARCHAR(50)  NOT NULL,
  "reportType"         VARCHAR(100) NOT NULL,
  "dateRange"          VARCHAR(20)  NOT NULL,
  "data"               JSONB        NOT NULL,
  "fetchedAt"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "PK_AdPlatformReport" PRIMARY KEY ("id"),
  CONSTRAINT "FK_AdPlatformReport_organizationId"     FOREIGN KEY ("organizationId")     REFERENCES "Organization"("id")        ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FK_AdPlatformReport_connectedAccountId" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAdAccount"("id")  ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_AdPlatformReport_organizationId"     ON "AdPlatformReport"("organizationId");
CREATE INDEX IF NOT EXISTS "IX_AdPlatformReport_connectedAccountId" ON "AdPlatformReport"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "IX_AdPlatformReport_platform_reportType" ON "AdPlatformReport"("platform", "reportType");
