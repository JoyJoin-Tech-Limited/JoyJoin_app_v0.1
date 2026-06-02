-- Add partner venue onboarding fields to venues table
-- Created: 2026-06-02

-- Add onboarding status and partner business fields
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS partner_company_name text,
  ADD COLUMN IF NOT EXISTS business_license_no text,
  ADD COLUMN IF NOT EXISTS partner_email text,
  ADD COLUMN IF NOT EXISTS bank_account_info text,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date;

-- Backfill existing venues: any venue that was already operational gets 'active'
UPDATE venues
  SET onboarding_status = 'active'
  WHERE onboarding_status IS NULL;

-- Add check constraint for valid onboarding status values
-- (skip if already exists to make idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_onboarding_status_check'
    AND conrelid = 'venues'::regclass
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_onboarding_status_check
      CHECK (onboarding_status IN ('draft', 'pending_review', 'active', 'suspended'));
  END IF;
END $$;
