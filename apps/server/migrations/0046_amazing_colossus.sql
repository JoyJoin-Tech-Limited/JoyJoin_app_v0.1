-- Custom SQL migration: create run_plan_templates table
-- Icebreaker Vibe Reframe — Sprint 1

CREATE TABLE IF NOT EXISTS "run_plan_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"vibe" varchar NOT NULL,
	"tier" varchar NOT NULL,
	"player_count_min" integer DEFAULT 2 NOT NULL,
	"player_count_max" integer DEFAULT 12 NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_run_plan_templates_vibe_tier" ON "run_plan_templates" ("vibe","tier");
