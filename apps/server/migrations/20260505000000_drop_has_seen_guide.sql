-- Migration: Drop has_seen_guide column
-- Date: 2026-05-05
-- Description: Removes the deprecated has_seen_guide column from users table.
--              The onboarding guide flow has been removed; this field is no longer used.

ALTER TABLE users DROP COLUMN IF EXISTS has_seen_guide;
