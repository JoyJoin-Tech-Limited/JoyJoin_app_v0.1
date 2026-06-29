-- Custom SQL migration file, put your code below! --
-- Enforce one welcome coupon (or any coupon) per user to prevent duplicate awards under concurrency.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_coupons_user_id_coupon_id"
  ON "user_coupons" ("user_id", "coupon_id");
