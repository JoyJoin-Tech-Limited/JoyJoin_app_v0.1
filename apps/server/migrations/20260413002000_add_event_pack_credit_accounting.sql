CREATE TABLE IF NOT EXISTS "event_credit_grants" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "payment_id" varchar NOT NULL REFERENCES "payments"("id"),
  "plan_type" varchar NOT NULL,
  "granted_credits" integer NOT NULL,
  "remaining_credits" integer NOT NULL,
  "expires_at" timestamp,
  "refunded_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_event_credit_grants_payment_id"
  ON "event_credit_grants" ("payment_id");

CREATE INDEX IF NOT EXISTS "idx_event_credit_grants_user_expiry"
  ON "event_credit_grants" ("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "event_credit_redemptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "grant_id" varchar NOT NULL REFERENCES "event_credit_grants"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "pool_id" varchar NOT NULL REFERENCES "event_pools"("id"),
  "registration_id" varchar NOT NULL REFERENCES "event_pool_registrations"("id"),
  "credits_used" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_event_credit_redemptions_registration_id"
  ON "event_credit_redemptions" ("registration_id");

CREATE INDEX IF NOT EXISTS "idx_event_credit_redemptions_user_pool"
  ON "event_credit_redemptions" ("user_id", "pool_id");
