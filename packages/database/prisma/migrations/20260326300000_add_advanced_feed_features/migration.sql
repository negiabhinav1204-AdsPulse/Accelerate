-- Add advanced feed toggles to ShoppingFeedSettings
ALTER TABLE "ShoppingFeedSettings"
  ADD COLUMN IF NOT EXISTS "buyOnGoogleEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "localInventoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: StoreLocation
CREATE TABLE IF NOT EXISTS "StoreLocation" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"   UUID        NOT NULL,
    "connectedStoreId" UUID        NOT NULL,
    "storeCode"        VARCHAR(100) NOT NULL,
    "name"             VARCHAR(255) NOT NULL,
    "address"          VARCHAR(500) NOT NULL,
    "city"             VARCHAR(100) NOT NULL,
    "state"            VARCHAR(100),
    "country"          VARCHAR(10)  NOT NULL,
    "postalCode"       VARCHAR(20)  NOT NULL,
    "phone"            VARCHAR(50),
    "hours"            JSONB        NOT NULL DEFAULT '{}',
    "isActive"         BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreLocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StoreLocation_organizationId_idx" ON "StoreLocation"("organizationId");
ALTER TABLE "StoreLocation" ADD CONSTRAINT "StoreLocation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ShopifyMarket
CREATE TABLE IF NOT EXISTS "ShopifyMarket" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"   UUID         NOT NULL,
    "connectedStoreId" UUID         NOT NULL,
    "marketName"       VARCHAR(255) NOT NULL,
    "targetCountry"    VARCHAR(10)  NOT NULL,
    "language"         VARCHAR(10)  NOT NULL,
    "currency"         VARCHAR(10)  NOT NULL,
    "isEnabled"        BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopifyMarket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShopifyMarket_organizationId_idx" ON "ShopifyMarket"("organizationId");
ALTER TABLE "ShopifyMarket" ADD CONSTRAINT "ShopifyMarket_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DeliverySpeedRule
CREATE TABLE IF NOT EXISTS "DeliverySpeedRule" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"   UUID          NOT NULL,
    "connectedStoreId" UUID          NOT NULL,
    "countryCode"      VARCHAR(10)   NOT NULL,
    "carrier"          VARCHAR(100)  NOT NULL,
    "service"          VARCHAR(100)  NOT NULL,
    "minTransitDays"   INTEGER       NOT NULL,
    "maxTransitDays"   INTEGER       NOT NULL,
    "cutoffHour"       INTEGER       NOT NULL DEFAULT 17,
    "price"            DECIMAL(10,2),
    "isActive"         BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliverySpeedRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliverySpeedRule_organizationId_idx" ON "DeliverySpeedRule"("organizationId");
ALTER TABLE "DeliverySpeedRule" ADD CONSTRAINT "DeliverySpeedRule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
