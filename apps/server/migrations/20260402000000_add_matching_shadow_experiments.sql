CREATE TABLE IF NOT EXISTS "matching_shadow_experiments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "pool_id" varchar NOT NULL REFERENCES "event_pools"("id"),
  "mode" varchar NOT NULL DEFAULT 'batch',
  "model_version" varchar NOT NULL,
  "deterministic_group_count" integer NOT NULL DEFAULT 0,
  "deterministic_average_score" integer,
  "outcome_sample_count" integer NOT NULL DEFAULT 0,
  "outcome_positive_rate" numeric(5, 4) DEFAULT '0',
  "average_confidence" numeric(5, 4) DEFAULT '0',
  "rank_agreement_rate" numeric(5, 4) DEFAULT '0',
  "average_score_delta" integer DEFAULT 0,
  "results" jsonb NOT NULL,
  "summary" jsonb NOT NULL,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_matching_shadow_experiments_pool"
  ON "matching_shadow_experiments" ("pool_id");

CREATE INDEX IF NOT EXISTS "idx_matching_shadow_experiments_created_at"
  ON "matching_shadow_experiments" ("created_at");
