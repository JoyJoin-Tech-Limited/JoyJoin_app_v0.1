-- Seed canonical pricing plans (悦聚卡/连局包/单场局票 naming, 2026-08-05)
-- Run: psql "$DATABASE_URL" -f seed_pricing_plans_20260805.sql
--
-- Purpose: creates the 5 active pricing_settings rows that were missing from
-- staging/production, so /api/pricing + checkout read DB prices instead of
-- falling back to code constants. Also fixes the display-name drift where the
-- DB would show legacy names (月度会员/季度会员/单次活动) if rows existed.
--
-- plan_type values are consumed as-is by /api/pricing (adminBilling.ts) and by
-- checkout (payments.ts, eventCreditsRepo.ts). The mini-program matches
-- 'vip_monthly'/'vip_quarterly' via alias normalization in pricing.ts.
--
-- Idempotent: INSERT ... ON CONFLICT (plan_type) DO UPDATE. Re-running resets
-- display fields AND prices to these canonical values (prices per "stick to
-- current pricing strategy" consensus — do NOT change prices here without the
-- payment-entitlement-authority domain owner).
--
-- original_price_in_cents stays NULL (no fake strikethrough discounts).
-- Not journaled in _journal.json (data seed, same convention as venue seeds);
-- does not write pricing_history (no admin audit trail needed for seed data).

INSERT INTO pricing_settings (
  plan_type, display_name, display_name_en, description,
  price_in_cents, original_price_in_cents, duration_days,
  is_active, is_featured, sort_order
) VALUES
  ('monthly',      '悦聚月卡', 'YueJu Monthly', '每月 6 场局，说走就走',               9800,  NULL, 30,  true, false, 1),
  ('quarterly',    '悦聚季卡', 'YueJu Quarterly', '一季 18 场局，场场有人陪',          29400, NULL, 90,  true, true,  2),
  ('event_single', '单场局票', 'Single Pass', '一场局的入场券',                        8800,  NULL, NULL, true, false, 3),
  ('pack_3',       '三连局包', 'Triple Pack', '3 场局名额，先认识三桌新朋友',          21100, NULL, 90,  true, false, 4),
  ('pack_6',       '六连局包', 'Six Pack', '6 场局名额，慢慢玩成常客',                37000, NULL, 90,  true, false, 5)
ON CONFLICT (plan_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name_en = EXCLUDED.display_name_en,
  description = EXCLUDED.description,
  price_in_cents = EXCLUDED.price_in_cents,
  original_price_in_cents = EXCLUDED.original_price_in_cents,
  duration_days = EXCLUDED.duration_days,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order;
