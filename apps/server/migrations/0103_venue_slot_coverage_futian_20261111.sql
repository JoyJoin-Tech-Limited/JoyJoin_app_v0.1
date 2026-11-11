-- 福田酒吧时段覆盖修复（2026-11-11，D5 场地供给闸的前置数据）
--
-- 现状（dev/prod 同步的种子数据）：
--   Batch & Co  | 20 座 | 每日 20:00–23:59，max_concurrent_events = 1
--   Bruma       | 12 座 | 仅周日/周三/周四 18:00–23:00，max_concurrent_events = 2
--   Max Shenzhen| 12 座 | 每日 18:00–23:00，max_concurrent_events = 2
-- 于是「周五/周六 19:00」只有 Max 一家可承接：两桌酒局在供给闸下会被判为不可上架，
-- 而实际 1–2 桌在福田这三家店都能坐得下。
--
-- 本迁移只补数据，不改 schema：
--   1. Batch & Co 的每日时段提前到 18:00（原来 20:00 起，覆盖不到常规开局）
--   2. Batch & Co 允许同时 2 桌（20 座，max_concurrent_events 1 → 2）
--   3. Bruma 补周五(5)/周六(6) 18:00–23:00
-- 幂等：全部带 WHERE 条件，可重复执行。
-- 有意不做：清理 Bruma/Max 的重复时段行 —— 重复行不改变可用性判断，删除却有
-- 触碰既有 booking 引用的风险，留待单独的数据清理任务。

BEGIN;

UPDATE venue_time_slots s
SET start_time = '18:00'
FROM venues v
WHERE s.venue_id = v.id
  AND v.name = 'Batch & Co'
  AND s.is_active
  AND s.start_time = '20:00';

UPDATE venue_time_slots s
SET max_concurrent_events = 2
FROM venues v
WHERE s.venue_id = v.id
  AND v.name = 'Batch & Co'
  AND s.is_active
  AND s.max_concurrent_events < 2;

INSERT INTO venue_time_slots (venue_id, day_of_week, start_time, end_time, is_active, max_concurrent_events)
SELECT v.id, d.dow, '18:00', '23:00', true, 2
FROM venues v
CROSS JOIN (VALUES (5), (6)) AS d(dow)
WHERE v.name = 'Bruma'
  AND NOT EXISTS (
    SELECT 1 FROM venue_time_slots s
    WHERE s.venue_id = v.id
      AND s.day_of_week = d.dow
      AND s.is_active
  );

COMMIT;
