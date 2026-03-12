-- Migration: Remove deprecated user fields
-- Date: 2026-03-11
-- Removes fields that are no longer collected in onboarding and have no matching value.
-- All columns are guarded with IF EXISTS so the migration is safe to run multiple times.

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS age;
ALTER TABLE users DROP COLUMN IF EXISTS has_kids;
ALTER TABLE users DROP COLUMN IF EXISTS children;
ALTER TABLE users DROP COLUMN IF EXISTS has_pets;
ALTER TABLE users DROP COLUMN IF EXISTS pet_types;
ALTER TABLE users DROP COLUMN IF EXISTS has_siblings;

COMMIT;
