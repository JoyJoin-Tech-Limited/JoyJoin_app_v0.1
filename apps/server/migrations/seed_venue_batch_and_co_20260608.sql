-- Seed Batch & Co (宾聚堂 Batch&Co) as a Meilin venue partner
-- Researched from Apple Maps / Dianping (4.5★, 70 reviews)
-- Commission rate TBD — set to default 20 for now
-- 15% exclusive discount on all drinks (悦聚专属85折)
-- Run: psql "$DATABASE_URL" -f seed_venue_batch_and_co_20260608.sql

INSERT INTO venues (
  id, name, venue_type, address, city, area,
  cluster_id, district_id,
  contact_person, contact_phone, commission_rate,
  tags, cuisines, price_range, budget_categories,
  capacity, seating_capacity, is_active,
  bar_themes, alcohol_options, vibe_descriptor,
  partner_status, partner_since,
  onboarding_status, partner_company_name, business_license_no,
  partner_email, bank_account_info, contract_start_date, contract_end_date
) VALUES (
  '550e8400-e29b-41d4-a716-446655440006', 'Batch & Co', 'bar',
  '广东省深圳市福田区广厦路16号之一', '深圳', '福田区',
  'futian', 'meilin',
  NULL, '19328768918', 20,
  ARRAY['cozy', 'upscale'], ARRAY[]::text[], '80-150', ARRAY['80-150'],
  1, 20, true,
  ARRAY['清吧', '私密调酒·Homebar'], ARRAY['可以喝酒', '微醺就好'], '福田梅林精品鸡尾酒吧，位于安静居民区，氛围静谧惬意。特调鸡尾酒单丰富，调酒师技艺精湛，适合朋友小聚微醺。营业时间20:00-02:00。运营配置：整店可容纳约20人，建议每场活动4-8人。佣金率待定。',
  'active', CURRENT_DATE,
  'draft', NULL, NULL,
  NULL, NULL, NULL, NULL
);

-- 15% exclusive discount on all drinks for JoyJoin members
INSERT INTO venue_deals (
  venue_id, title, discount_type, discount_value, description,
  redemption_method, per_person_limit, valid_from, valid_until, terms, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440006',
  '悦聚专属85折（酒水）', 'percentage', 15,
  'JoyJoin会员专享全单酒水85折优惠',
  'show_page', false,
  '2026-06-08', '2027-06-08',
  '向店员出示JoyJoin会员页面即可享酒水85折优惠。仅限酒水类消费，不与其他优惠同用。',
  true
);

-- Time slots: daily 20:00-02:00 (matching venue's operating hours)
INSERT INTO venue_time_slots (venue_id, day_of_week, start_time, end_time, max_concurrent_events, is_active, notes) VALUES
('550e8400-e29b-41d4-a716-446655440006', 0, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 1, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 2, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 3, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 4, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 5, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
('550e8400-e29b-41d4-a716-446655440006', 6, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场');
