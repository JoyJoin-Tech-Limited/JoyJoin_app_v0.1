ALTER TABLE "matching_weights_history"
  ADD COLUMN IF NOT EXISTS "shadow_metadata" jsonb;
