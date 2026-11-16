-- Seed AC HOOKAH LOUNGE (two Shenzhen branches: 蛇口 + 后海) as venue partners
-- Researched from public listings 2026-11-12 (Instagram soft-opening post, Amap)
-- Commission rate TBD — left at platform default 20 until the partner agreement lands
-- Exclusive deal is NOT yet negotiated. Both deal rows are seeded is_active = false.
--   Recommended structure (see docs/runbooks/venue-onboarding-ac-hookah.md):
--   gift = one shared hookah bucket per table, with a non-smoker swap clause.
-- Run: psql "$DATABASE_URL" -f seed_venue_ac_hookah_20261112.sql
--
-- Capacity envelope agreed with ops 2026-11-12: max 2 tables per venue per night,
-- 12 people seated at once => seating_capacity = 12, capacity (concurrent events) = 2.

BEGIN;

-- ---------------------------------------------------------------- venues
INSERT INTO venues (
  id, name, brand_name, venue_type, address, city, area,
  cluster_id, district_id,
  contact_person, contact_phone, commission_rate,
  tags, cuisines, price_range, budget_categories,
  capacity, seating_capacity, is_active,
  bar_themes, alcohol_options, vibe_descriptor, operating_hours,
  partner_status, partner_since,
  onboarding_status, partner_company_name, business_license_no,
  partner_email, bank_account_info, contract_start_date, contract_end_date,
  notes
) VALUES (
  '550e8400-e29b-41d4-a716-446655440007', 'AC Hookah Lounge 蛇口', 'AC HOOKAH LOUNGE', 'bar',
  '深圳市南山区招商街道太子路111号水湾1979商业楼自贸中心1楼', '深圳', '南山区',
  'nanshan', 'shekou',
  NULL, NULL, 20,
  ARRAY['lively', 'upscale'], ARRAY[]::text[], '80-150', ARRAY['drinks_80_150'],
  2, 12, true,
  ARRAY['清吧'], ARRAY['可以喝酒', '微醺就好', '无酒精饮品'],
  '水烟 · 鸡尾酒 · 音乐；双层空间，5 间 VIP 包厢', '19:00-02:30',
  'active', '2026-11-12',
  'active', NULL, NULL,
  NULL, NULL, NULL, NULL,
  '2026-11-12 建档（合作洽谈中）。分店：蛇口（太子路111号 水湾1979商业楼 自贸中心1楼）。运营口径：每店每晚最多 2 桌、同时 12 人。公开电话 13388568170 / 15118828006。待确认：联系人、独家优惠形式、佣金比例。'
), (
  '550e8400-e29b-41d4-a716-446655440008', 'AC Hookah Lounge 后海', 'AC HOOKAH LOUNGE', 'bar',
  '深圳市南山区海德一道88号中洲控股金融中心A栋101', '深圳', '南山区',
  'nanshan', 'houhai',
  NULL, NULL, 20,
  ARRAY['lively', 'upscale'], ARRAY[]::text[], '80-150', ARRAY['drinks_80_150'],
  2, 12, true,
  ARRAY['清吧'], ARRAY['可以喝酒', '微醺就好', '无酒精饮品'],
  '水烟 · 鸡尾酒 · 音乐', '19:00-02:30',
  'active', '2026-11-12',
  'active', NULL, NULL,
  NULL, NULL, NULL, NULL,
  '2026-11-12 建档（合作洽谈中）。分店：后海（海德一道88号 中洲控股金融中心A栋101）。运营口径：每店每晚最多 2 桌、同时 12 人。公开电话 13388568170 / 15118828006。待确认：联系人、独家优惠形式、佣金比例。'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- time slots
-- Weekly 18:00-23:59, 2 tables per night (matches the ops capacity envelope).
INSERT INTO venue_time_slots (venue_id, day_of_week, start_time, end_time, max_concurrent_events, is_active, notes)
SELECT v.id, d, '18:00'::time, '23:59'::time, 2, true, '悦聚常规酒局时段（2 桌/晚）'
FROM venues v
CROSS JOIN generate_series(0, 6) AS d
WHERE v.id IN ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008')
  AND NOT EXISTS (
    SELECT 1 FROM venue_time_slots s
    WHERE s.venue_id = v.id AND s.day_of_week = d
  );

-- ---------------------------------------------------------------- deals (draft)
-- is_active = false until the partner signs off. Flip to true (admin UI or one UPDATE) after.
INSERT INTO venue_deals (
  venue_id, title, discount_type, discount_value, description,
  redemption_method, per_person_limit, valid_from, valid_until, terms, is_active
)
SELECT v.id, '【待谈定】悦聚专属 · 共享桶装一份', 'gift', 1,
       '每桌赠送 3L 共享桶一份：精酿桶 / 鸡尾酒桶 / 无酒精特调桶，到店三选一',
       'show_page', false, '2026-11-12', '2027-11-11',
       '向店员出示悦聚活动页即可核销。每局限一桶，不可与其他优惠同享；6 人桌标配一桶，不足 6 人由商家按等值提供首杯；全桌不饮酒时默认提供无酒精特调桶。',
       false
FROM venues v
WHERE v.id IN ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008')
  AND NOT EXISTS (
    SELECT 1 FROM venue_deals d
    WHERE d.venue_id = v.id AND d.title LIKE '%悦聚专属%桶装%'
  );

COMMIT;

-- Verification
SELECT v.name, v.area, v.district_id, v.seating_capacity, v.capacity,
       (SELECT count(*) FROM venue_time_slots s WHERE s.venue_id = v.id) AS slots,
       (SELECT count(*) FROM venue_deals d WHERE d.venue_id = v.id) AS deals
FROM venues v
WHERE v.id IN ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008')
ORDER BY v.name;
