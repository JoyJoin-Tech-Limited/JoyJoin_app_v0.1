-- Privacy-safe IP geolocation tables for admin geographical heatmap
-- QQwry self-hosted mainland-China lookup; no raw IP storage.

CREATE TABLE IF NOT EXISTS "user_location_snapshots" (
  "id" varchar DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" varchar(32) NOT NULL,
  "hashed_ip" varchar(64) NOT NULL,
  "anonymized_ip" varchar(40) NOT NULL,
  "ip_salt_date" date NOT NULL,
  "country" varchar(60),
  "province" varchar(60),
  "city" varchar(60),
  "district" varchar(60),
  "isp" varchar(120),
  "is_mainland" boolean DEFAULT false NOT NULL,
  "lookup_source" varchar(20) DEFAULT 'qqwry' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_user_location_snapshots_user"
  ON "user_location_snapshots"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_location_snapshots_event_type"
  ON "user_location_snapshots"("event_type");
CREATE INDEX IF NOT EXISTS "idx_user_location_snapshots_created_at"
  ON "user_location_snapshots"("created_at");
CREATE INDEX IF NOT EXISTS "idx_user_location_snapshots_city"
  ON "user_location_snapshots"("city");
CREATE INDEX IF NOT EXISTS "idx_user_location_snapshots_mainland"
  ON "user_location_snapshots"("is_mainland");

CREATE TABLE IF NOT EXISTS "user_location_aggregates" (
  "id" varchar DEFAULT gen_random_uuid() PRIMARY KEY,
  "date" date NOT NULL,
  "province" varchar(60) NOT NULL,
  "city" varchar(60) NOT NULL,
  "event_type" varchar(32) NOT NULL,
  "unique_hashed_ips" integer DEFAULT 0 NOT NULL,
  "total_snapshots" integer DEFAULT 0 NOT NULL,
  "anonymous_snapshots" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_location_aggregates_unique"
    UNIQUE ("date", "province", "city", "event_type")
);

CREATE INDEX IF NOT EXISTS "idx_user_location_aggregates_date"
  ON "user_location_aggregates"("date");
CREATE INDEX IF NOT EXISTS "idx_user_location_aggregates_city"
  ON "user_location_aggregates"("city");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_location_aggregates_unique"
  ON "user_location_aggregates"("date", "province", "city", "event_type");
