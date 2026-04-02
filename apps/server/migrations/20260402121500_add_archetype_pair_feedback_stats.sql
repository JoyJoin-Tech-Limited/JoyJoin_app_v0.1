-- Aggregate per-archetype-pair empirical chemistry calibration derived from post-event pair outcomes.
-- The unique pair key keeps storage symmetric, while bounded deltas preserve explainability.

CREATE TABLE IF NOT EXISTS "archetype_pair_feedback_stats" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "archetype_a" varchar(50) NOT NULL,
  "archetype_b" varchar(50) NOT NULL,
  "base_score" integer NOT NULL,
  "sample_count" integer NOT NULL DEFAULT 0,
  "avg_meet_again" numeric(4, 3),
  "avg_atmosphere" numeric(4, 3),
  "empirical_score" numeric(5, 2),
  "applied_delta" numeric(5, 2) NOT NULL DEFAULT 0,
  "calibrated_score" numeric(5, 2) NOT NULL,
  "last_aggregated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_archetype_pair_feedback_stats_pair"
  ON "archetype_pair_feedback_stats" ("archetype_a", "archetype_b");

CREATE INDEX IF NOT EXISTS "idx_archetype_pair_feedback_stats_samples"
  ON "archetype_pair_feedback_stats" ("sample_count");
