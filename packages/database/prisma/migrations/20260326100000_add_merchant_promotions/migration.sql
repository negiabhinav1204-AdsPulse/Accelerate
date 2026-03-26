-- CreateTable: MerchantPromotion
CREATE TABLE IF NOT EXISTS "MerchantPromotion" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"        UUID NOT NULL,
    "connectedStoreId"      UUID NOT NULL,
    "title"                 VARCHAR(255) NOT NULL,
    "offerType"             VARCHAR(50) NOT NULL,
    "couponCode"            VARCHAR(100),
    "discountType"          VARCHAR(50) NOT NULL,
    "discountValue"         DECIMAL(12,2),
    "minimumPurchaseAmount" DECIMAL(12,2),
    "startDate"             TIMESTAMP(3) NOT NULL,
    "endDate"               TIMESTAMP(3) NOT NULL,
    "applicableProducts"    VARCHAR(50) NOT NULL DEFAULT 'all',
    "productIds"            TEXT[] NOT NULL DEFAULT '{}',
    "channels"              TEXT[] NOT NULL DEFAULT '{}',
    "status"                VARCHAR(50) NOT NULL DEFAULT 'pending',
    "platformPromotionId"   VARCHAR(255),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantPromotion_organizationId_idx" ON "MerchantPromotion"("organizationId");
CREATE INDEX IF NOT EXISTS "MerchantPromotion_connectedStoreId_idx" ON "MerchantPromotion"("connectedStoreId");

-- AddForeignKey
ALTER TABLE "MerchantPromotion" ADD CONSTRAINT "MerchantPromotion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
