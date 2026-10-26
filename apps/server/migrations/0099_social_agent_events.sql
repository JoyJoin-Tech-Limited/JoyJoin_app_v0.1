-- Xiaoyue agent M1: bounded, per-session episode facts (not cross-session memory).
-- Intentionally no session/user FK: rows outlive session tombstones and are
-- removed only by the independent 90-day retention job.
CREATE TABLE IF NOT EXISTS "social_agent_events" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "social_session_id" varchar(80) NOT NULL,
  "phase" varchar(40) NOT NULL,
  "kind" varchar(32) NOT NULL,
  "ask_id" varchar(80),
  "idempotency_key" varchar(80),
  "actor_user_id" varchar(128),
  "signals" jsonb,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ck_social_agent_events_kind" CHECK ("kind" IN (
    'signal_snapshot', 'ask_created', 'ask_decision',
    'action_commit', 'action_failed', 'policy_changed'
  )),
  CONSTRAINT "ck_social_agent_events_idempotency_claim" CHECK ((
    ("kind" = 'action_commit' AND "idempotency_key" IS NOT NULL)
    OR ("kind" <> 'action_commit' AND "idempotency_key" IS NULL)
  ))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_social_agent_events_session_created"
  ON "social_agent_events" USING btree ("social_session_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_social_agent_events_ask"
  ON "social_agent_events" USING btree ("ask_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_social_agent_events_retention"
  ON "social_agent_events" USING btree ("created_at");
--> statement-breakpoint
-- Only action_commit writes idempotency_key. ask_decision/action_failed keep
-- this column NULL and carry their retry key in payload, so failed -> retry ->
-- succeeded is never blocked by this claim.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_social_agent_events_action_commit_idempotency"
  ON "social_agent_events" USING btree ("social_session_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
