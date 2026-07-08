-- Link event_pool_groups to the generated events/blind-box events so rejected operator reviews can clean them up.
ALTER TABLE "event_pool_groups"
  ADD COLUMN IF NOT EXISTS "event_id" varchar,
  ADD COLUMN IF NOT EXISTS "blind_box_event_id" varchar;

ALTER TABLE "event_pool_groups"
  ADD CONSTRAINT "event_pool_groups_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "event_pool_groups"
  ADD CONSTRAINT "event_pool_groups_blind_box_event_id_blind_box_events_id_fk"
  FOREIGN KEY ("blind_box_event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_event_pool_groups_event_id" ON "event_pool_groups" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_event_pool_groups_blind_box_event_id" ON "event_pool_groups" ("blind_box_event_id");
