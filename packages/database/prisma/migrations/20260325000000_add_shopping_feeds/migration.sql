-- CreateTable: ConnectedStore
CREATE TABLE IF NOT EXISTS "ConnectedStore" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL DEFAULT 'shopify',
    "shopDomain" VARCHAR(255) NOT NULL,
    "storeName" VARCHAR(255) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'connected',
    "planName" VARCHAR(100),
    "currency" VARCHAR(10),
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "storeMetadata" JSONB,

    CONSTRAINT "ConnectedStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShoppingFeedSettings
CREATE TABLE IF NOT EXISTS "ShoppingFeedSettings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "connectedStoreId" UUID NOT NULL,
    "titlePreference" VARCHAR(50) NOT NULL DEFAULT 'default',
    "descriptionPreference" VARCHAR(50) NOT NULL DEFAULT 'default',
    "variantPreference" VARCHAR(50) NOT NULL DEFAULT 'all',
    "appendVariantToTitle" BOOLEAN NOT NULL DEFAULT false,
    "inventoryPolicy" VARCHAR(50) NOT NULL DEFAULT 'ignore',
    "useSecondImage" BOOLEAN NOT NULL DEFAULT false,
    "submitAdditionalImages" BOOLEAN NOT NULL DEFAULT false,
    "richDescriptions" BOOLEAN NOT NULL DEFAULT false,
    "enableSalePrice" BOOLEAN NOT NULL DEFAULT true,
    "enableUtmTracking" BOOLEAN NOT NULL DEFAULT true,
    "utmSource" VARCHAR(100) NOT NULL DEFAULT 'accelerate',
    "utmMedium" VARCHAR(100) NOT NULL DEFAULT 'cpc',
    "productIdFormat" VARCHAR(50) NOT NULL DEFAULT 'global',
    "defaultGoogleCategory" VARCHAR(500),
    "defaultAgeGroup" VARCHAR(50),
    "channels" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingFeedSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeedProduct
CREATE TABLE IF NOT EXISTS "FeedProduct" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "connectedStoreId" UUID NOT NULL,
    "shopifyProductId" VARCHAR(255) NOT NULL,
    "shopifyVariantId" VARCHAR(255),
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "availability" VARCHAR(50) NOT NULL DEFAULT 'in stock',
    "condition" VARCHAR(50) NOT NULL DEFAULT 'new',
    "brand" VARCHAR(255),
    "imageUrl" VARCHAR(2048),
    "additionalImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productUrl" VARCHAR(2048),
    "googleCategory" VARCHAR(500),
    "productType" VARCHAR(255),
    "sku" VARCHAR(255),
    "barcode" VARCHAR(255),
    "color" VARCHAR(100),
    "size" VARCHAR(100),
    "itemGroupId" VARCHAR(255),
    "customLabels" JSONB,
    "channelStatus" JSONB,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeedRule
CREATE TABLE IF NOT EXISTS "FeedRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "connectedStoreId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MerchantPromotion
CREATE TABLE IF NOT EXISTS "MerchantPromotion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "connectedStoreId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "offerType" VARCHAR(50) NOT NULL,
    "couponCode" VARCHAR(100),
    "discountType" VARCHAR(50) NOT NULL,
    "discountValue" DECIMAL(12,2),
    "minimumPurchaseAmount" DECIMAL(12,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "externalIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedStore_organizationId_shopDomain_key" ON "ConnectedStore"("organizationId", "shopDomain");
CREATE INDEX IF NOT EXISTS "ConnectedStore_organizationId_idx" ON "ConnectedStore"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingFeedSettings_connectedStoreId_key" ON "ShoppingFeedSettings"("connectedStoreId");
CREATE INDEX IF NOT EXISTS "ShoppingFeedSettings_organizationId_idx" ON "ShoppingFeedSettings"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "FeedProduct_connectedStoreId_shopifyProductId_shopifyVariantId_key" ON "FeedProduct"("connectedStoreId", "shopifyProductId", "shopifyVariantId");
CREATE INDEX IF NOT EXISTS "FeedProduct_organizationId_idx" ON "FeedProduct"("organizationId");
CREATE INDEX IF NOT EXISTS "FeedProduct_connectedStoreId_idx" ON "FeedProduct"("connectedStoreId");

CREATE INDEX IF NOT EXISTS "FeedRule_organizationId_idx" ON "FeedRule"("organizationId");
CREATE INDEX IF NOT EXISTS "FeedRule_connectedStoreId_idx" ON "FeedRule"("connectedStoreId");

CREATE INDEX IF NOT EXISTS "MerchantPromotion_organizationId_idx" ON "MerchantPromotion"("organizationId");

-- AddForeignKey
ALTER TABLE "ConnectedStore" ADD CONSTRAINT "ConnectedStore_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShoppingFeedSettings" ADD CONSTRAINT "ShoppingFeedSettings_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShoppingFeedSettings" ADD CONSTRAINT "ShoppingFeedSettings_connectedStoreId_fkey"
    FOREIGN KEY ("connectedStoreId") REFERENCES "ConnectedStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedProduct" ADD CONSTRAINT "FeedProduct_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedProduct" ADD CONSTRAINT "FeedProduct_connectedStoreId_fkey"
    FOREIGN KEY ("connectedStoreId") REFERENCES "ConnectedStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedRule" ADD CONSTRAINT "FeedRule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantPromotion" ADD CONSTRAINT "MerchantPromotion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
