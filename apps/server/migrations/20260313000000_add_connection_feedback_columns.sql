-- Add optional per-user connection feedback enrichment columns to the connections table.
-- These columns store structured reason chips (text array, max 3) and a next-step preference
-- for each party independently. Both sides are nullable; feedback is enrichment, not gating.

ALTER TABLE "connections"
  ADD COLUMN IF NOT EXISTS "user_a_connection_reasons" text[],
  ADD COLUMN IF NOT EXISTS "user_a_next_step_preference" varchar,
  ADD COLUMN IF NOT EXISTS "user_b_connection_reasons" text[],
  ADD COLUMN IF NOT EXISTS "user_b_next_step_preference" varchar;
