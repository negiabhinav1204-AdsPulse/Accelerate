-- CreateTable: AudienceList
CREATE TABLE IF NOT EXISTS "AudienceList" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "type" VARCHAR(50) NOT NULL DEFAULT 'retarget',
    "platforms" TEXT[] NOT NULL DEFAULT '{}',
    "rules" JSONB NOT NULL DEFAULT '[]',
    "estimatedSize" INTEGER,
    "syncStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "historicalImportDone" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AudienceList_organizationId_idx" ON "AudienceList"("organizationId");

-- AddForeignKey
ALTER TABLE "AudienceList" ADD CONSTRAINT "AudienceList_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
