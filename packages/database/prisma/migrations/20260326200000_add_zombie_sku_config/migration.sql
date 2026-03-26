-- Add zombieSkuConfig column to ShoppingFeedSettings
ALTER TABLE "ShoppingFeedSettings" ADD COLUMN IF NOT EXISTS "zombieSkuConfig" JSONB;
