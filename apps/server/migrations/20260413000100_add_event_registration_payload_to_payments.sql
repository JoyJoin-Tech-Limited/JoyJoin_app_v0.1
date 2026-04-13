ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "event_registration_payload" jsonb;