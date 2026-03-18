-- Accelerate Init Migration Part 2: Schema extensions + data migration

-- Update User table: add Accelerate fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneCode" VARCHAR(10);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessUrl" VARCHAR(2048);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isFirstLogin" BOOLEAN NOT NULL DEFAULT true;

-- Update Organization table: add Accelerate fields
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "contactEmail" VARCHAR(255);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "location" VARCHAR(255);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "businessUrl" VARCHAR(2048);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoUrl" VARCHAR(2048);

-- Create ConnectedAdAccount table
CREATE TABLE IF NOT EXISTS "ConnectedAdAccount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "accountId" VARCHAR(255) NOT NULL,
    "accountName" VARCHAR(255) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'connected',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ConnectedAdAccount" PRIMARY KEY ("id")
);

ALTER TABLE "ConnectedAdAccount" ADD CONSTRAINT "FK_ConnectedAdAccount_Organization"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "IX_ConnectedAdAccount_organizationId" ON "ConnectedAdAccount"("organizationId");

-- Data migration: update existing 'member' roles to 'marketer'
UPDATE "Membership" SET "role" = 'marketer' WHERE "role" = 'member';
UPDATE "Invitation" SET "role" = 'marketer' WHERE "role" = 'member';
