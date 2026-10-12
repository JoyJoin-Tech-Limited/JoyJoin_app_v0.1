-- Account-deletion retention Option B (2026-10-09):
-- financial rows survive account deletion, de-identified by detaching the user
-- link. See docs/design/account-deletion-retention-decision-20261006.md §3.
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_users_id_fk;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
