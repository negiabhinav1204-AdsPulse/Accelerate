-- MerchantPromotion table was created in add_shopping_feeds migration.
-- This migration adds the extra columns and index introduced later.

ALTER TABLE "MerchantPromotion"
    ADD COLUMN IF NOT EXISTS "applicableProducts" VARCHAR(50) NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS "productIds"         TEXT[]      NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "platformPromotionId" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "MerchantPromotion_connectedStoreId_idx" ON "MerchantPromotion"("connectedStoreId");
