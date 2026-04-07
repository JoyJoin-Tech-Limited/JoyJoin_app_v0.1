CREATE TABLE IF NOT EXISTS "participation_experiment_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE set null,
  "session_id" varchar,
  "event_type" varchar(80) NOT NULL,
  "pool_id" varchar,
  "metadata" jsonb,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pex_user_id"
  ON "participation_experiment_events" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_pex_event_type"
  ON "participation_experiment_events" ("event_type");

CREATE INDEX IF NOT EXISTS "idx_pex_pool_id"
  ON "participation_experiment_events" ("pool_id");

CREATE INDEX IF NOT EXISTS "idx_pex_timestamp"
  ON "participation_experiment_events" ("timestamp");
