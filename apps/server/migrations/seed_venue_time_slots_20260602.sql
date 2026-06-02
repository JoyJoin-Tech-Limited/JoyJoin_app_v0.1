-- Seed venue_time_slots for 5 partner venues
-- Flexible venues: all days 18:00-23:00, max 2 concurrent events (2 tables)
-- Bruma: Wed(3)/Thu(4)/Sun(0) only, 18:00-23:00

INSERT INTO venue_time_slots (venue_id, day_of_week, start_time, end_time, max_concurrent_events, is_active, notes) VALUES
-- 弥所 - flexible, all days
('550e8400-e29b-41d4-a716-446655440001', 0, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 1, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 2, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 3, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 4, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 5, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440001', 6, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),

-- T馆·艺术餐厅 - flexible, all days
('550e8400-e29b-41d4-a716-446655440002', 0, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 1, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 2, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 3, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 4, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 5, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440002', 6, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),

-- Bruma - Wed(3)/Thu(4)/Sun(0) ONLY
('550e8400-e29b-41d4-a716-446655440003', 0, '18:00', '23:00', 2, true, '2 tables, 4-6 per group. Wed/Thu/Sun only'),
('550e8400-e29b-41d4-a716-446655440003', 3, '18:00', '23:00', 2, true, '2 tables, 4-6 per group. Wed/Thu/Sun only'),
('550e8400-e29b-41d4-a716-446655440003', 4, '18:00', '23:00', 2, true, '2 tables, 4-6 per group. Wed/Thu/Sun only'),

-- Max Shenzhen - flexible, all days
('550e8400-e29b-41d4-a716-446655440004', 0, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 1, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 2, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 3, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 4, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 5, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440004', 6, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),

-- Delete Bar大喇叭精酿 - flexible, all days
('550e8400-e29b-41d4-a716-446655440005', 0, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 1, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 2, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 3, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 4, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 5, '18:00', '23:00', 2, true, '2 tables, 4-6 per group'),
('550e8400-e29b-41d4-a716-446655440005', 6, '18:00', '23:00', 2, true, '2 tables, 4-6 per group');
