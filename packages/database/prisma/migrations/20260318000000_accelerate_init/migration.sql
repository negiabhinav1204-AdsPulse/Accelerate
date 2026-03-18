-- Accelerate Init Migration Part 1: Enum values only
-- (PostgreSQL requires new enum values to be committed before use in same transaction)

-- Update Role enum: add new values
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'marketer';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'analyst';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'developer';
