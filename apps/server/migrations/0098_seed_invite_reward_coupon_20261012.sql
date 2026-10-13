-- Seed the invite reward coupon: INVITE_REWARD — fixed ¥50 off (2026-10-12)
-- Run: psql "$DATABASE_URL" -f 0098_seed_invite_reward_coupon_20261012.sql
--
-- Purpose: gives the invitation reward pipeline a coupon row to grant. The
-- reward processor (apps/server/src/poolMatchingInvitationRewards.ts) issues
-- one coupon to the inviter when inviter+invitee are matched into the same
-- group; it silently skips when no active INVITE_REWARD row exists — this seed
-- turns the mechanism on. Canon value ¥50 per PRODUCT_REQUIREMENTS.md §4
-- (Invitation & Viral Growth System: "Auto-issue ¥50 INVITE_REWARD coupon").
--
-- Anchor safety (2026-10-12 generalized invariant): ¥50 fixed is NOT
-- anchor-safe (cap = ¥20), so this coupon can never auto-apply to the ¥88
-- 单场局票 anchor. It applies to 连局包/悦聚卡 plans (blanket-eligible), which
-- is where a reward discount belongs.
--
-- Idempotent: INSERT ... ON CONFLICT (code) DO UPDATE — re-running resets the
-- canonical value. valid_until stays NULL (no expiry; reward issuance is
-- once-per-invitation_use via the rewardIssued flag).

INSERT INTO coupons (
  code, discount_type, discount_value, valid_from, valid_until, usage_limit, is_active
) VALUES (
  'INVITE_REWARD', 'fixed_amount', 5000, now(), NULL, NULL, true
)
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  is_active = EXCLUDED.is_active;
