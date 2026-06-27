-- CreateTable
CREATE TABLE "CampaignRun" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "trigger" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRunItem" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "resourceType" VARCHAR(50) NOT NULL,
    "localId" UUID,
    "externalId" VARCHAR(255),
    "operation" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "CampaignRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignRun_campaignId_idx" ON "CampaignRun"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignRunItem_runId_idx" ON "CampaignRunItem"("runId");

-- AddForeignKey
ALTER TABLE "CampaignRunItem" ADD CONSTRAINT "CampaignRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CampaignRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
