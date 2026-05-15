-- Add social_icebreaker_phase_metrics table for Q2 pilot instrumentation
CREATE TABLE IF NOT EXISTS "social_icebreaker_phase_metrics" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "social_session_id" varchar NOT NULL REFERENCES "social_icebreaker_sessions"("id") ON DELETE cascade,
  "phase" varchar NOT NULL,
  "dwell_time_ms" integer,
  "started_at" timestamp,
  "ended_at" timestamp,
  "participant_count" integer,
  "action_count" integer,
  "created_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_phase_metrics_session_phase" ON "social_icebreaker_phase_metrics" ("social_session_id", "phase");
CREATE INDEX IF NOT EXISTS "idx_phase_metrics_session" ON "social_icebreaker_phase_metrics" ("social_session_id");
CREATE INDEX IF NOT EXISTS "idx_phase_metrics_phase" ON "social_icebreaker_phase_metrics" ("phase");
