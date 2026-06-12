-- Migration: content_filter_logs
-- Description: Table to record every blocked content submission for admin ops visibility

CREATE TABLE IF NOT EXISTS "content_filter_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users" ("id"),
  "field" varchar(64) NOT NULL,
  "violation_type" varchar(32) NOT NULL,
  "severity" varchar(16) NOT NULL,
  "matched_keywords" jsonb DEFAULT '[]'::jsonb,
  "input_preview" varchar(200),
  "source" varchar(128),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_content_filter_logs_user_id" ON "content_filter_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_content_filter_logs_created_at" ON "content_filter_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_content_filter_logs_violation_type" ON "content_filter_logs" ("violation_type");
