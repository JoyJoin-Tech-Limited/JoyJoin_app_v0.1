-- Forward-only V1.7 persistence for the pixel-avatar equipment economy and
-- the private, append-only personal story. Safe to re-run after success.

BEGIN;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "slot" varchar(20) NOT NULL,
  "rarity" varchar(20) DEFAULT 'common' NOT NULL,
  "asset_key" varchar(160) NOT NULL,
  "compatible_archetypes" text[],
  "is_initial" boolean DEFAULT false NOT NULL,
  "initial_archetype_id" varchar(50),
  "shop_available" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_equipment_items_slot"
    CHECK ("slot" IN ('top', 'bottom', 'shoes', 'accessory')),
  CONSTRAINT "chk_equipment_items_rarity"
    CHECK ("rarity" IN ('common', 'rare')),
  CONSTRAINT "chk_equipment_items_initial_archetype"
    CHECK (("is_initial" = false) OR ("initial_archetype_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_items_slug"
  ON "equipment_items" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_initial_archetype_slot"
  ON "equipment_items" ("initial_archetype_id", "slot")
  WHERE "is_initial" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_items_shop_active"
  ON "equipment_items" ("shop_available", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "equipment_pools" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(120) NOT NULL,
  "name" varchar(120) NOT NULL,
  "venue_id" varchar,
  "alang_mission_id" varchar,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "equipment_pools_venue_id_venues_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id"),
  CONSTRAINT "equipment_pools_alang_mission_id_alang_missions_id_fk"
    FOREIGN KEY ("alang_mission_id") REFERENCES "public"."alang_missions"("id"),
  CONSTRAINT "chk_equipment_pool_single_authority"
    CHECK (num_nonnulls("venue_id", "alang_mission_id") = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_pools_slug"
  ON "equipment_pools" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_pools_venue"
  ON "equipment_pools" ("venue_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_pools_alang_mission"
  ON "equipment_pools" ("alang_mission_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "equipment_pool_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_id" varchar NOT NULL,
  "item_id" varchar NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "equipment_pool_items_pool_id_equipment_pools_id_fk"
    FOREIGN KEY ("pool_id") REFERENCES "public"."equipment_pools"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_pool_items_item_id_equipment_items_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "chk_equipment_pool_item_weight" CHECK ("weight" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_pool_item"
  ON "equipment_pool_items" ("pool_id", "item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_pool_items_active"
  ON "equipment_pool_items" ("pool_id", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_equipment_inventory" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "item_id" varchar NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "source_id" varchar,
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_equipment_inventory_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_equipment_inventory_item_id_equipment_items_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "chk_user_equipment_source"
    CHECK ("source_type" IN ('initial', 'draw', 'shop'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_equipment_item"
  ON "user_equipment_inventory" ("user_id", "item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_equipment_recent"
  ON "user_equipment_inventory" ("user_id", "acquired_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_equipment_outfits" (
  "user_id" varchar PRIMARY KEY NOT NULL,
  "top_item_id" varchar,
  "bottom_item_id" varchar,
  "shoes_item_id" varchar,
  "accessory_item_id" varchar,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_equipment_outfits_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_equipment_outfits_top_item_id_equipment_items_id_fk"
    FOREIGN KEY ("top_item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "user_equipment_outfits_bottom_item_id_equipment_items_id_fk"
    FOREIGN KEY ("bottom_item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "user_equipment_outfits_shoes_item_id_equipment_items_id_fk"
    FOREIGN KEY ("shoes_item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "user_equipment_outfits_accessory_item_id_equipment_items_id_fk"
    FOREIGN KEY ("accessory_item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "chk_user_equipment_outfit_version" CHECK ("version" >= 1)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "equipment_draw_entitlements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "source_type" varchar(30) NOT NULL,
  "source_record_id" varchar NOT NULL,
  "pool_id" varchar NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "result_item_id" varchar,
  "result_kind" varchar(20),
  "fragments_awarded" integer DEFAULT 0 NOT NULL,
  "pity_before" integer,
  "pity_after" integer,
  "random_roll" real,
  "draw_version" varchar(40),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  CONSTRAINT "equipment_draw_entitlements_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_draw_entitlements_pool_id_equipment_pools_id_fk"
    FOREIGN KEY ("pool_id") REFERENCES "public"."equipment_pools"("id"),
  CONSTRAINT "equipment_draw_entitlements_result_item_id_equipment_items_id_fk"
    FOREIGN KEY ("result_item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "chk_equipment_entitlement_source_type"
    CHECK ("source_type" IN ('blind_box', 'alang')),
  CONSTRAINT "chk_equipment_entitlement_status"
    CHECK ("status" IN ('pending', 'resolved')),
  CONSTRAINT "chk_equipment_entitlement_result_kind"
    CHECK ("result_kind" IS NULL OR "result_kind" IN ('new', 'duplicate')),
  CONSTRAINT "chk_equipment_entitlement_fragments"
    CHECK ("fragments_awarded" >= 0),
  CONSTRAINT "chk_equipment_entitlement_resolution"
    CHECK (
      ("status" = 'pending' AND "result_item_id" IS NULL AND "resolved_at" IS NULL)
      OR
      ("status" = 'resolved' AND "result_item_id" IS NOT NULL
        AND "result_kind" IS NOT NULL AND "resolved_at" IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_entitlement_source"
  ON "equipment_draw_entitlements" ("user_id", "source_type", "source_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_entitlement_pending"
  ON "equipment_draw_entitlements" ("user_id", "status", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_equipment_wallets" (
  "user_id" varchar PRIMARY KEY NOT NULL,
  "fragment_balance" integer DEFAULT 0 NOT NULL,
  "pity_misses" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_equipment_wallets_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "chk_equipment_wallet_fragments_nonnegative"
    CHECK ("fragment_balance" >= 0),
  CONSTRAINT "chk_equipment_wallet_pity_range"
    CHECK ("pity_misses" BETWEEN 0 AND 3)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "equipment_fragment_ledger" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "transaction_type" varchar(30) NOT NULL,
  "delta" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "item_id" varchar,
  "entitlement_id" varchar,
  "idempotency_key" varchar(160) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "equipment_fragment_ledger_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_fragment_ledger_item_id_equipment_items_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "public"."equipment_items"("id"),
  CONSTRAINT "equipment_fragment_ledger_entitlement_id_equipment_draw_entitlements_id_fk"
    FOREIGN KEY ("entitlement_id") REFERENCES "public"."equipment_draw_entitlements"("id"),
  CONSTRAINT "chk_equipment_fragment_transaction_type"
    CHECK ("transaction_type" IN ('duplicate', 'shop')),
  CONSTRAINT "chk_equipment_fragment_balance_nonnegative"
    CHECK ("balance_after" >= 0),
  CONSTRAINT "chk_equipment_fragment_nonzero_delta" CHECK ("delta" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_equipment_fragment_ledger_idempotency"
  ON "equipment_fragment_ledger" ("user_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_fragment_ledger_user_created"
  ON "equipment_fragment_ledger" ("user_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "personal_story_novels" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "last_successful_update_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "personal_story_novels_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_story_novels_user"
  ON "personal_story_novels" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "personal_story_chapters" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "novel_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "chapter_number" integer NOT NULL,
  "source_type" varchar NOT NULL,
  "source_id" varchar NOT NULL,
  "source_occurred_at" timestamp NOT NULL,
  "title" varchar NOT NULL,
  "body" text NOT NULL,
  "fact_keywords" jsonb NOT NULL,
  "keyword_hash" varchar NOT NULL,
  "provider" varchar,
  "model" varchar,
  "prompt_version" varchar NOT NULL,
  "fallback_used" boolean DEFAULT false NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "personal_story_chapters_novel_id_personal_story_novels_id_fk"
    FOREIGN KEY ("novel_id") REFERENCES "public"."personal_story_novels"("id") ON DELETE CASCADE,
  CONSTRAINT "personal_story_chapters_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_story_chapter_source"
  ON "personal_story_chapters" ("novel_id", "source_type", "source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_story_chapter_number"
  ON "personal_story_chapters" ("novel_id", "chapter_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personal_story_chapters_user"
  ON "personal_story_chapters" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personal_story_chapters_occurred"
  ON "personal_story_chapters" ("source_occurred_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "personal_story_update_jobs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "novel_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "active_key" varchar,
  "source_snapshot" jsonb NOT NULL,
  "next_source_index" integer DEFAULT 0 NOT NULL,
  "generated_count" integer DEFAULT 0 NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "locked_at" timestamp,
  "lease_expires_at" timestamp,
  "lease_token" varchar(36),
  "error_code" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "personal_story_update_jobs_novel_id_personal_story_novels_id_fk"
    FOREIGN KEY ("novel_id") REFERENCES "public"."personal_story_novels"("id") ON DELETE CASCADE,
  CONSTRAINT "personal_story_update_jobs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
-- Keep re-runs convergent if this draft migration created the table before the
-- fencing-token column was introduced.
ALTER TABLE "personal_story_update_jobs"
  ADD COLUMN IF NOT EXISTS "lease_token" varchar(36);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_story_active_job"
  ON "personal_story_update_jobs" ("user_id", "active_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personal_story_jobs_status_lease"
  ON "personal_story_update_jobs" ("status", "lease_expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personal_story_jobs_user_created"
  ON "personal_story_update_jobs" ("user_id", "created_at");
--> statement-breakpoint
COMMIT;
