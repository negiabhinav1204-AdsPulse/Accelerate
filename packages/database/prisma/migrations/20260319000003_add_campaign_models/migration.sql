-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'reviewing', 'paused', 'live', 'ended');

-- AlterTable ConnectedAdAccount
ALTER TABLE "ConnectedAdAccount" ADD COLUMN "currency" VARCHAR(10), ADD COLUMN "timezone" VARCHAR(100), ADD COLUMN "accountType" VARCHAR(100), ADD COLUMN "accountMetadata" JSONB;

-- CreateTable Campaign
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sourceUrl" VARCHAR(2048),
    "objective" VARCHAR(100) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "totalBudget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetAudience" JSONB,
    "agentOutputs" JSONB,
    "mediaPlan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PK_Campaign" PRIMARY KEY ("id")
);

-- CreateTable PlatformCampaign
CREATE TABLE "PlatformCampaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "adTypes" TEXT[],
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "platformCampaignId" VARCHAR(255),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PK_PlatformCampaign" PRIMARY KEY ("id")
);

-- CreateTable AdGroup
CREATE TABLE "AdGroup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platformCampaignId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "adType" VARCHAR(100) NOT NULL,
    "targeting" JSONB,
    "bidStrategy" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "platformAdGroupId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PK_AdGroup" PRIMARY KEY ("id")
);

-- CreateTable Ad
CREATE TABLE "Ad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adGroupId" UUID NOT NULL,
    "adType" VARCHAR(100) NOT NULL,
    "headlines" TEXT[],
    "descriptions" TEXT[],
    "imageUrls" TEXT[],
    "videoUrl" VARCHAR(2048),
    "ctaText" VARCHAR(100),
    "destinationUrl" VARCHAR(2048),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "platformAdId" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PK_Ad" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "FK_Campaign_Organization" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCampaign" ADD CONSTRAINT "FK_PlatformCampaign_Campaign" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGroup" ADD CONSTRAINT "FK_AdGroup_PlatformCampaign" FOREIGN KEY ("platformCampaignId") REFERENCES "PlatformCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "FK_Ad_AdGroup" FOREIGN KEY ("adGroupId") REFERENCES "AdGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "IX_Campaign_organizationId" ON "Campaign"("organizationId");
CREATE INDEX "IX_Campaign_createdBy" ON "Campaign"("createdBy");
CREATE INDEX "IX_PlatformCampaign_campaignId" ON "PlatformCampaign"("campaignId");
CREATE INDEX "IX_AdGroup_platformCampaignId" ON "AdGroup"("platformCampaignId");
CREATE INDEX "IX_Ad_adGroupId" ON "Ad"("adGroupId");
