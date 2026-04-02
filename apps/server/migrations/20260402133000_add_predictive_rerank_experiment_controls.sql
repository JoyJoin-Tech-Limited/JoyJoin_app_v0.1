ALTER TABLE "event_pools"
  ADD COLUMN IF NOT EXISTS "predictive_rerank_enabled_override" boolean;

COMMENT ON COLUMN "event_pools"."predictive_rerank_enabled_override" IS
  'Tri-state override: true forces pool into global rerank eligibility, false force-disables rerank for the pool, null follows the global experiment config.';

ALTER TABLE "event_pool_groups"
  ADD COLUMN IF NOT EXISTS "predictive_experiment_arm" varchar(20),
  ADD COLUMN IF NOT EXISTS "predictive_model_version" varchar(50),
  ADD COLUMN IF NOT EXISTS "predictive_rerank_applied" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_audit" jsonb;

ALTER TABLE "matching_thresholds"
  ADD COLUMN IF NOT EXISTS "predictive_rerank_enabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_exposure_percent" integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_max_position_shift" integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_confidence_threshold" integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_auto_disable_enabled" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_min_shadow_experiments" integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_auto_disabled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_auto_disabled_reason" text;

ALTER TABLE "pool_matching_logs"
  ADD COLUMN IF NOT EXISTS "predictive_experiment_arm" varchar(20),
  ADD COLUMN IF NOT EXISTS "predictive_rerank_applied" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "predictive_rerank_summary" jsonb;
