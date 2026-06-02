-- Seed 5 partner venues from Dianping research + default 15% off deals
-- Run: psql "$DATABASE_URL" -f seed_venue_partners_20260602.sql

-- Note: Uses explicit UUIDs so venue_deals can reference them
-- Capacity: 2 tables per venue (4-6 per group x 2 = max 12)
-- Bruma: Wed/Thu/Sun nights only (per venue partner constraint)

INSERT INTO venues (
  id, name, venue_type, address, city, area,
  contact_person, contact_phone, commission_rate,
  tags, cuisines, price_range, budget_categories,
  capacity, seating_capacity, is_active,
  bar_themes, alcohol_options, vibe_descriptor,
  partner_status, partner_since,
  onboarding_status, partner_company_name, business_license_no,
  partner_email, bank_account_info, contract_start_date, contract_end_date
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001', '弥所', 'bar',
  '深圳湾科技生态园2栋A座3楼305（一出客梯即是）', '深圳', '南山区',
  NULL, NULL, 20,
  ARRAY['cozy', 'upscale'], ARRAY['西餐'], '150-200', ARRAY['150-200'],
  2, 12, true,
  ARRAY['清吧', '私密调酒·Homebar'], ARRAY['可以喝酒', '微醺就好'], '科技园片区精品鸡尾酒吧，环境安静适合商务小酌。运营配置：2张桌子，每桌4-6人，时间灵活。',
  'active', CURRENT_DATE,
  'draft', '深圳市弥所餐饮管理有限公司', NULL,
  NULL, NULL, NULL, NULL
),
(
  '550e8400-e29b-41d4-a716-446655440002', 'T馆·艺术餐厅', 'restaurant',
  '香山东街华侨城创意文化园北区B3栋1楼101号', '深圳', '南山区',
  NULL, NULL, 20,
  ARRAY['upscale', 'casual'], ARRAY['西餐', '粤菜'], '200-300', ARRAY['200-300'],
  2, 12, true,
  ARRAY['清吧'], ARRAY['可以喝酒', '微醺就好'], '艺术餐厅与轻酒吧结合，创意园文艺氛围浓厚。运营配置：2张桌子，每桌4-6人，时间灵活。',
  'active', CURRENT_DATE,
  'draft', '深圳市T馆餐饮文化有限公司', NULL,
  NULL, NULL, NULL, NULL
),
(
  '550e8400-e29b-41d4-a716-446655440003', 'Bruma', 'bar',
  '福华五路卓越世纪中心3号楼B座26楼2611号（今夜大排档、胜记酒家楼上）', '深圳', '福田区',
  NULL, '18926448485', 20,
  ARRAY['upscale', 'cozy'], ARRAY['西餐'], '150-200', ARRAY['150-200'],
  2, 12, true,
  ARRAY['清吧', '私密调酒·Homebar'], ARRAY['可以喝酒', '微醺就好'], '意式极简高空鸡尾酒吧，CBD夜景，特调酒单定期更新。运营配置：2张桌子，每桌4-6人。仅周三、周四、周日晚间可保证留位，其他时间需提前确认。',
  'active', CURRENT_DATE,
  'draft', '深圳市布鲁马餐饮管理有限公司', NULL,
  NULL, NULL, NULL, NULL
),
(
  '550e8400-e29b-41d4-a716-446655440004', 'Max Shenzhen', 'bar',
  '福华五路卓悦INTOWN购物中心南门旁', '深圳', '福田区',
  NULL, '18124713066', 20,
  ARRAY['lively', 'upscale'], ARRAY['西餐'], '300-500', ARRAY['300-500'],
  2, 12, true,
  ARRAY['精酿'], ARRAY['可以喝酒'], '大型电音夜店，DJ现场，年轻人群体，高能量氛围。运营配置：2张桌子，每桌4-6人，时间灵活。',
  'active', CURRENT_DATE,
  'draft', '深圳市迈克斯娱乐有限公司', NULL,
  NULL, NULL, NULL, NULL
),
(
  '550e8400-e29b-41d4-a716-446655440005', 'Delete Bar大喇叭精酿', 'bar',
  '南油东滨路与南光路交汇处永新时代广场负一层下沉广场1-B17', '深圳', '南山区',
  NULL, NULL, 20,
  ARRAY['casual', 'lively'], ARRAY['西餐'], '80-150', ARRAY['80-150'],
  2, 12, true,
  ARRAY['精酿'], ARRAY['可以喝酒', '微醺就好'], '社区精酿啤酒吧，轻松随意，适合朋友聚会。运营配置：2张桌子，每桌4-6人，时间灵活。',
  'active', CURRENT_DATE,
  'draft', '深圳市大喇叭精酿餐饮有限公司', NULL,
  NULL, NULL, NULL, NULL
);

-- Default 15% off deal for all partner venues (85折, show page to redeem)
INSERT INTO venue_deals (
  venue_id, title, discount_type, discount_value, description,
  redemption_method, per_person_limit, valid_from, valid_until, terms, is_active
) VALUES
('550e8400-e29b-41d4-a716-446655440001', '悦聚专属85折', 'percentage', 15, 'JoyJoin会员专享全场85折优惠', 'show_page', false, '2026-01-01', '2027-01-01', '向店员出示JoyJoin会员页面即可享85折优惠。不与其他优惠同用。', true),
('550e8400-e29b-41d4-a716-446655440002', '悦聚专属85折', 'percentage', 15, 'JoyJoin会员专享全场85折优惠', 'show_page', false, '2026-01-01', '2027-01-01', '向店员出示JoyJoin会员页面即可享85折优惠。不与其他优惠同用。', true),
('550e8400-e29b-41d4-a716-446655440003', '悦聚专属85折', 'percentage', 15, 'JoyJoin会员专享全场85折优惠', 'show_page', false, '2026-01-01', '2027-01-01', '向店员出示JoyJoin会员页面即可享85折优惠。不与其他优惠同用。', true),
('550e8400-e29b-41d4-a716-446655440004', '悦聚专属85折', 'percentage', 15, 'JoyJoin会员专享全场85折优惠', 'show_page', false, '2026-01-01', '2027-01-01', '向店员出示JoyJoin会员页面即可享85折优惠。不与其他优惠同用。', true),
('550e8400-e29b-41d4-a716-446655440005', '悦聚专属85折', 'percentage', 15, 'JoyJoin会员专享全场85折优惠', 'show_page', false, '2026-01-01', '2027-01-01', '向店员出示JoyJoin会员页面即可享85折优惠。不与其他优惠同用。', true);
