/*
  Warnings:

  - The values [member] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `connectedStoreId` on the `DeliverySpeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `connectedStoreId` on the `FeedProduct` table. All the data in the column will be lost.
  - You are about to drop the column `shopifyProductId` on the `FeedProduct` table. All the data in the column will be lost.
  - You are about to drop the column `shopifyVariantId` on the `FeedProduct` table. All the data in the column will be lost.
  - You are about to drop the column `channels` on the `FeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `connectedStoreId` on the `FeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `FeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `FeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `FeedRule` table. All the data in the column will be lost.
  - You are about to drop the column `connectedStoreId` on the `MerchantPromotion` table. All the data in the column will be lost.
  - You are about to drop the column `externalIds` on the `MerchantPromotion` table. All the data in the column will be lost.
  - You are about to drop the column `connectedStoreId` on the `ShoppingFeedSettings` table. All the data in the column will be lost.
  - You are about to drop the column `connectedStoreId` on the `StoreLocation` table. All the data in the column will be lost.
  - You are about to drop the `AudienceList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConnectedStore` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShopifyMarket` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[acceId]` on the table `Campaign` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[connectorId,externalProductId,externalVariantId]` on the table `FeedProduct` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[connectorId]` on the table `ShoppingFeedSettings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `connectorId` to the `DeliverySpeedRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connectorId` to the `FeedProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalProductId` to the `FeedProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `feedId` to the `FeedRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connectorId` to the `MerchantPromotion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connectorId` to the `ShoppingFeedSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connectorId` to the `StoreLocation` table without a default value. This is not possible if the table is not empty.
  - Made the column `firstName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "CommercePlatform" AS ENUM ('shopify', 'woocommerce', 'wix', 'bigcommerce', 'magento', 'custom', 'manual', 'csv');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'syncing', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "IdentitySource" AS ENUM ('shopify', 'woocommerce', 'wix', 'pixel', 'crm', 'upload', 'meta', 'google', 'bing');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('draft', 'running', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "AllocationMode" AS ENUM ('random', 'bandit');

-- CreateEnum
CREATE TYPE "FeedChannel" AS ENUM ('google_mc', 'meta_catalog', 'bing_mc', 'tiktok', 'pinterest');

-- CreateEnum
CREATE TYPE "FormHosting" AS ENUM ('own_domain', 'shopify', 'typeform', 'hubspot');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('draft', 'active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('winner', 'learner', 'underperformer', 'bleeder');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('admin', 'marketer', 'analyst', 'finance', 'developer');
ALTER TABLE "Invitation" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT 'marketer';
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'marketer';
COMMIT;

-- DropForeignKey
ALTER TABLE "AudienceList" DROP CONSTRAINT "AudienceList_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ConnectedStore" DROP CONSTRAINT "ConnectedStore_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "FeedProduct" DROP CONSTRAINT "FeedProduct_connectedStoreId_fkey";

-- DropForeignKey
ALTER TABLE "FeedRule" DROP CONSTRAINT "FeedRule_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ShopifyMarket" DROP CONSTRAINT "ShopifyMarket_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingFeedSettings" DROP CONSTRAINT "ShoppingFeedSettings_connectedStoreId_fkey";

-- DropIndex
DROP INDEX "FeedProduct_connectedStoreId_idx";

-- DropIndex
DROP INDEX "FeedProduct_connectedStoreId_shopifyProductId_shopifyVariantId_";

-- DropIndex
DROP INDEX "FeedRule_connectedStoreId_idx";

-- DropIndex
DROP INDEX "FeedRule_organizationId_idx";

-- DropIndex
DROP INDEX "MerchantPromotion_connectedStoreId_idx";

-- DropIndex
DROP INDEX "OrgMemoryNode_embedding_idx";

-- DropIndex
DROP INDEX "ShoppingFeedSettings_connectedStoreId_key";

-- AlterTable
ALTER TABLE "Ad" RENAME CONSTRAINT "PK_Ad" TO "Ad_pkey";
ALTER TABLE "Ad" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AdGroup" RENAME CONSTRAINT "PK_AdGroup" TO "AdGroup_pkey";
ALTER TABLE "AdGroup" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AdPlatformReport" RENAME CONSTRAINT "PK_AdPlatformReport" TO "AdPlatformReport_pkey";
ALTER TABLE "AdPlatformReport"
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "fetchedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Campaign" RENAME CONSTRAINT "PK_Campaign" TO "Campaign_pkey";
ALTER TABLE "Campaign" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChatMessage" RENAME CONSTRAINT "PK_ChatMessage" TO "ChatMessage_pkey";
ALTER TABLE "ChatMessage"
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatSession" RENAME CONSTRAINT "PK_ChatSession" TO "ChatSession_pkey";
ALTER TABLE "ChatSession"
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConnectedAdAccount" RENAME CONSTRAINT "PK_ConnectedAdAccount" TO "ConnectedAdAccount_pkey";
ALTER TABLE "ConnectedAdAccount"
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "lastSyncAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DeliverySpeedRule" DROP COLUMN "connectedStoreId",
ADD COLUMN     "connectorId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FeedProduct" DROP COLUMN "connectedStoreId",
DROP COLUMN "shopifyProductId",
DROP COLUMN "shopifyVariantId",
ADD COLUMN     "connectorId" UUID NOT NULL,
ADD COLUMN     "externalProductId" VARCHAR(255) NOT NULL,
ADD COLUMN     "externalVariantId" VARCHAR(255),
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "additionalImages" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FeedRule" DROP COLUMN "channels",
DROP COLUMN "connectedStoreId",
DROP COLUMN "createdAt",
DROP COLUMN "organizationId",
DROP COLUMN "updatedAt",
ADD COLUMN     "feedId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT 'marketer';

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'marketer';

-- AlterTable
ALTER TABLE "MerchantPromotion" DROP COLUMN "connectedStoreId",
DROP COLUMN "externalIds",
ADD COLUMN     "connectorId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "channels" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'pending',
ALTER COLUMN "productIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrgMemoryNode" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformCampaign" RENAME CONSTRAINT "PK_PlatformCampaign" TO "PlatformCampaign_pkey";
ALTER TABLE "PlatformCampaign" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShoppingFeedSettings" DROP COLUMN "connectedStoreId",
ADD COLUMN     "connectorId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoreLocation" DROP COLUMN "connectedStoreId",
ADD COLUMN     "connectorId" UUID NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "firstName" SET DEFAULT '',
ALTER COLUMN "lastName" SET NOT NULL,
ALTER COLUMN "lastName" SET DEFAULT '';

-- DropTable
DROP TABLE "AudienceList";

-- DropTable
DROP TABLE "ConnectedStore";

-- DropTable
DROP TABLE "ShopifyMarket";

-- CreateTable
CREATE TABLE "CommerceConnector" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "platform" "CommercePlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'pending',
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "additionalImages" TEXT[],
    "handle" TEXT,
    "brand" TEXT,
    "googleCategory" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "inventoryQty" INTEGER,
    "tags" TEXT[],
    "customLabels" JSONB NOT NULL DEFAULT '{}',
    "salesVelocity" DOUBLE PRECISION,
    "revenueL30d" DECIMAL(12,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sku" TEXT,
    "inventory" INTEGER,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceOrder" (
    "id" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "channel" TEXT,
    "status" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "externalProductId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRevenueSummary" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "orders" INTEGER NOT NULL,
    "channel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "DailyRevenueSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedTransformRule" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "channels" TEXT[],
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedTransformRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceMarket" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "marketName" VARCHAR(255) NOT NULL,
    "targetCountry" VARCHAR(10) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "totalSpend" DECIMAL(12,2),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "firstOrderAt" TIMESTAMP(3),
    "ltv" DECIMAL(12,2),
    "aov" DECIMAL(10,2),
    "tags" TEXT[],
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "isLapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "source" "IdentitySource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEvent" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSegment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "type" VARCHAR(50) NOT NULL DEFAULT 'retarget',
    "platforms" TEXT[],
    "rules" JSONB NOT NULL DEFAULT '[]',
    "estimatedSize" INTEGER,
    "syncStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "syncedPlatforms" TEXT[],
    "historicalImportDone" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSegmentMembership" (
    "profileId" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSegmentMembership_pkey" PRIMARY KEY ("profileId","segmentId")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationZone" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "defaultHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizationZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVariant" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'draft',
    "trafficSplit" INTEGER NOT NULL DEFAULT 50,
    "holdoutPct" INTEGER NOT NULL DEFAULT 0,
    "allocationMode" "AllocationMode" NOT NULL DEFAULT 'random',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerVariantId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariantAllocation" (
    "experimentId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "ExperimentVariantAllocation_pkey" PRIMARY KEY ("experimentId","variantId")
);

-- CreateTable
CREATE TABLE "ExperimentResult" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeed" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "channel" "FeedChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "healthScore" INTEGER,
    "lastPushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCenterAccount" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "merchantId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantCenterAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadForm" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "incentive" TEXT,
    "fields" JSONB NOT NULL,
    "hostingType" "FormHosting" NOT NULL,
    "publishedUrl" TEXT,
    "externalFormId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSubmission" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "ipAddress" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignHealthScore" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "category" "CampaignCategory" NOT NULL,
    "roas" DECIMAL(8,2),
    "cpa" DECIMAL(8,2),
    "spend" DECIMAL(10,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationRecommendation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "agentType" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionPayload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptimizationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journey" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "JourneyStatus" NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyStep" (
    "id" UUID NOT NULL,
    "journeyId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "JourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordResearch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "seedKeywords" TEXT[],
    "results" JSONB NOT NULL,
    "clusters" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordResearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommerceConnector_organizationId_idx" ON "CommerceConnector"("organizationId");

-- CreateIndex
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_connectorId_externalId_key" ON "Product"("connectorId", "externalId");

-- CreateIndex
CREATE INDEX "CommerceOrder_organizationId_placedAt_idx" ON "CommerceOrder"("organizationId", "placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceOrder_connectorId_externalId_key" ON "CommerceOrder"("connectorId", "externalId");

-- CreateIndex
CREATE INDEX "DailyRevenueSummary_organizationId_date_idx" ON "DailyRevenueSummary"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRevenueSummary_connectorId_date_channel_key" ON "DailyRevenueSummary"("connectorId", "date", "channel");

-- CreateIndex
CREATE INDEX "FeedTransformRule_organizationId_idx" ON "FeedTransformRule"("organizationId");

-- CreateIndex
CREATE INDEX "FeedTransformRule_connectorId_idx" ON "FeedTransformRule"("connectorId");

-- CreateIndex
CREATE INDEX "CommerceMarket_organizationId_idx" ON "CommerceMarket"("organizationId");

-- CreateIndex
CREATE INDEX "CustomerProfile_organizationId_idx" ON "CustomerProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_source_externalId_key" ON "CustomerIdentity"("source", "externalId");

-- CreateIndex
CREATE INDEX "CustomerEvent_orgId_occurredAt_idx" ON "CustomerEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "AudienceSegment_organizationId_idx" ON "AudienceSegment"("organizationId");

-- CreateIndex
CREATE INDEX "SitePage_organizationId_idx" ON "SitePage"("organizationId");

-- CreateIndex
CREATE INDEX "Experiment_organizationId_idx" ON "Experiment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResult_experimentId_variantId_date_key" ON "ExperimentResult"("experimentId", "variantId", "date");

-- CreateIndex
CREATE INDEX "ProductFeed_organizationId_idx" ON "ProductFeed"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCenterAccount_organizationId_merchantId_key" ON "MerchantCenterAccount"("organizationId", "merchantId");

-- CreateIndex
CREATE INDEX "LeadSubmission_formId_submittedAt_idx" ON "LeadSubmission"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "CampaignHealthScore_organizationId_date_idx" ON "CampaignHealthScore"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignHealthScore_campaignId_date_key" ON "CampaignHealthScore"("campaignId", "date");

-- CreateIndex
CREATE INDEX "OptimizationRecommendation_organizationId_status_createdAt_idx" ON "OptimizationRecommendation"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Journey_organizationId_idx" ON "Journey"("organizationId");

-- CreateIndex
CREATE INDEX "KeywordResearch_organizationId_idx" ON "KeywordResearch"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_acceId_key" ON "Campaign"("acceId");

-- CreateIndex
CREATE INDEX "FeedProduct_connectorId_idx" ON "FeedProduct"("connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedProduct_connectorId_externalProductId_externalVariantId_key" ON "FeedProduct"("connectorId", "externalProductId", "externalVariantId");

-- CreateIndex
CREATE INDEX "MerchantPromotion_connectorId_idx" ON "MerchantPromotion"("connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingFeedSettings_connectorId_key" ON "ShoppingFeedSettings"("connectorId");

-- RenameForeignKey
ALTER TABLE "Ad" RENAME CONSTRAINT "FK_Ad_AdGroup" TO "Ad_adGroupId_fkey";

-- RenameForeignKey
ALTER TABLE "AdGroup" RENAME CONSTRAINT "FK_AdGroup_PlatformCampaign" TO "AdGroup_platformCampaignId_fkey";

-- RenameForeignKey
ALTER TABLE "AdPlatformReport" RENAME CONSTRAINT "FK_AdPlatformReport_connectedAccountId" TO "AdPlatformReport_connectedAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AdPlatformReport" RENAME CONSTRAINT "FK_AdPlatformReport_organizationId" TO "AdPlatformReport_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "Campaign" RENAME CONSTRAINT "FK_Campaign_Organization" TO "Campaign_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "ChatMessage" RENAME CONSTRAINT "FK_ChatMessage_sessionId" TO "ChatMessage_sessionId_fkey";

-- RenameForeignKey
ALTER TABLE "ChatSession" RENAME CONSTRAINT "FK_ChatSession_organizationId" TO "ChatSession_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "ChatSession" RENAME CONSTRAINT "FK_ChatSession_userId" TO "ChatSession_userId_fkey";

-- RenameForeignKey
ALTER TABLE "ConnectedAdAccount" RENAME CONSTRAINT "FK_ConnectedAdAccount_Organization" TO "ConnectedAdAccount_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "PlatformCampaign" RENAME CONSTRAINT "FK_PlatformCampaign_Campaign" TO "PlatformCampaign_campaignId_fkey";

-- AddForeignKey
ALTER TABLE "CommerceConnector" ADD CONSTRAINT "CommerceConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRevenueSummary" ADD CONSTRAINT "DailyRevenueSummary_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingFeedSettings" ADD CONSTRAINT "ShoppingFeedSettings_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedProduct" ADD CONSTRAINT "FeedProduct_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTransformRule" ADD CONSTRAINT "FeedTransformRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTransformRule" ADD CONSTRAINT "FeedTransformRule_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPromotion" ADD CONSTRAINT "MerchantPromotion_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreLocation" ADD CONSTRAINT "StoreLocation_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceMarket" ADD CONSTRAINT "CommerceMarket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceMarket" ADD CONSTRAINT "CommerceMarket_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverySpeedRule" ADD CONSTRAINT "DeliverySpeedRule_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEvent" ADD CONSTRAINT "CustomerEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceSegment" ADD CONSTRAINT "AudienceSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSegmentMembership" ADD CONSTRAINT "CustomerSegmentMembership_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSegmentMembership" ADD CONSTRAINT "CustomerSegmentMembership_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "AudienceSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationZone" ADD CONSTRAINT "PersonalizationZone_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVariant" ADD CONSTRAINT "PageVariant_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "PersonalizationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "PersonalizationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariantAllocation" ADD CONSTRAINT "ExperimentVariantAllocation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariantAllocation" ADD CONSTRAINT "ExperimentVariantAllocation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PageVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PageVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeed" ADD CONSTRAINT "ProductFeed_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "CommerceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeed" ADD CONSTRAINT "ProductFeed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRule" ADD CONSTRAINT "FeedRule_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "ProductFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCenterAccount" ADD CONSTRAINT "MerchantCenterAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadForm" ADD CONSTRAINT "LeadForm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignHealthScore" ADD CONSTRAINT "CampaignHealthScore_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationRecommendation" ADD CONSTRAINT "OptimizationRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordResearch" ADD CONSTRAINT "KeywordResearch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "IX_Ad_adGroupId" RENAME TO "Ad_adGroupId_idx";

-- RenameIndex
ALTER INDEX "IX_AdGroup_platformCampaignId" RENAME TO "AdGroup_platformCampaignId_idx";

-- RenameIndex
ALTER INDEX "IX_AdPlatformReport_connectedAccountId" RENAME TO "AdPlatformReport_connectedAccountId_idx";

-- RenameIndex
ALTER INDEX "IX_AdPlatformReport_organizationId" RENAME TO "AdPlatformReport_organizationId_idx";

-- RenameIndex
ALTER INDEX "IX_AdPlatformReport_platform_reportType" RENAME TO "AdPlatformReport_platform_reportType_idx";

-- RenameIndex
ALTER INDEX "IX_Campaign_archivedAt" RENAME TO "Campaign_archivedAt_idx";

-- RenameIndex
ALTER INDEX "IX_Campaign_createdBy" RENAME TO "Campaign_createdBy_idx";

-- RenameIndex
ALTER INDEX "IX_Campaign_organizationId" RENAME TO "Campaign_organizationId_idx";

-- RenameIndex
ALTER INDEX "IX_Campaign_source" RENAME TO "Campaign_source_idx";

-- RenameIndex
ALTER INDEX "IX_ChatMessage_sessionId" RENAME TO "ChatMessage_sessionId_idx";

-- RenameIndex
ALTER INDEX "IX_ChatSession_organizationId" RENAME TO "ChatSession_organizationId_idx";

-- RenameIndex
ALTER INDEX "IX_ChatSession_userId" RENAME TO "ChatSession_userId_idx";

-- RenameIndex
ALTER INDEX "IX_ConnectedAdAccount_organizationId" RENAME TO "ConnectedAdAccount_organizationId_idx";

-- RenameIndex
ALTER INDEX "memory_node_unique" RENAME TO "OrgMemoryNode_orgId_userId_type_key_key";

-- RenameIndex
ALTER INDEX "IX_PlatformCampaign_campaignId" RENAME TO "PlatformCampaign_campaignId_idx";
