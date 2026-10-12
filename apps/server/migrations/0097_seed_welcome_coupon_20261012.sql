-- Seed canonical welcome coupon: WELCOME20 — fixed ¥20 off (2026-10-12)
-- Run: psql "$DATABASE_URL" -f 0097_seed_welcome_coupon_20261012.sql
--
-- Purpose: replaces the legacy WELCOME50 (50% off) 见面礼 as the coupon the
-- server awards on first profile-review view / first test completion. On the
-- ¥88 单场局票 anchor the legacy coupon computed an effective price of ¥44
-- (立省 ¥44) — a culturally unlucky number in the Cantonese-speaking launch
-- market (四 ≈ 死). A fixed ¥20 deduction lands on ¥68 (6=禄, 8=发) and
-- raises first-order revenue at the same time.
--
-- Canonical award chain (server: routes/domains/auth.ts +
-- routes/domains/assessmentV4.ts): WELCOME20 → WELCOME50 → WELCOME40.
-- Legacy rows are intentionally NOT deactivated here: coupons already held by
-- testers stay redeemable; only new awards switch to WELCOME20.
--
-- DB-driven like all pricing (pricing_settings convention). Client display is
-- fixed-amount aware (FirstTimeCouponBanner / WelcomeGiftCard /
-- UnboxingCeremony), and both server discount calculators
-- (routes/domains/payments.ts, paymentService.ts) already handle
-- `fixed_amount` (value in cents).
--
-- Idempotent: INSERT ... ON CONFLICT (code) DO UPDATE. Re-running resets the
-- discount to the canonical value — do NOT change it without the
-- payment-entitlement-authority domain owner.
--
-- valid_until stays NULL (lifetime 见面礼, same posture as the legacy coupon);
-- server-side award is once-per-user (user_coupons unique pair), so NULL does
-- not create repeat-redemption risk.

INSERT INTO coupons (
  code, discount_type, discount_value, valid_from, valid_until, usage_limit, is_active
) VALUES (
  'WELCOME20', 'fixed_amount', 2000, now(), NULL, NULL, true
)
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  is_active = EXCLUDED.is_active;
