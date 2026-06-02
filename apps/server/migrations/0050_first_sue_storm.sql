CREATE TABLE "run_plan_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vibe" varchar NOT NULL,
	"tier" varchar NOT NULL,
	"player_count_min" integer DEFAULT 2 NOT NULL,
	"player_count_max" integer DEFAULT 12 NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "onboarding_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "partner_company_name" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "business_license_no" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "partner_email" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "bank_account_info" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "contract_start_date" date;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "contract_end_date" date;--> statement-breakpoint
CREATE INDEX "idx_run_plan_templates_vibe_tier" ON "run_plan_templates" USING btree ("vibe","tier");--> statement-breakpoint
CREATE INDEX "idx_event_pool_groups_pool" ON "event_pool_groups" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_event_pool_groups_venue_status" ON "event_pool_groups" USING btree ("venue_assignment_status");--> statement-breakpoint
CREATE INDEX "idx_vtsb_slot_date_status" ON "venue_time_slot_bookings" USING btree ("time_slot_id","booking_date","status");--> statement-breakpoint
CREATE INDEX "idx_vtsb_group_status" ON "venue_time_slot_bookings" USING btree ("event_group_id","status");--> statement-breakpoint
CREATE INDEX "idx_vtsb_venue_date" ON "venue_time_slot_bookings" USING btree ("venue_id","booking_date","status");--> statement-breakpoint
CREATE INDEX "idx_venue_time_slots_lookup" ON "venue_time_slots" USING btree ("venue_id","day_of_week","is_active","start_time","end_time");--> statement-breakpoint
CREATE INDEX "idx_venue_time_slots_specific" ON "venue_time_slots" USING btree ("venue_id","specific_date","is_active","start_time","end_time");