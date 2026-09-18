-- =============================================================================
-- Migration: 0092_budget_tier_venue_activation
-- Task:      T1a (docs/design/budget-tier-implementation-plan-20260916.md:36, §7.10)
-- Date:      2026-09-16
--
-- DATA-ONLY migration. No application code, no validation/schema change, and NO
-- change to any venues.budget_categories VALUE (that is T1b, which must ship
-- together with T6 + T7 -- plan §7.10).
--
-- Closes the two ground-truth blockers recorded in
-- docs/design/budget-tier-t0-venue-truth-worksheet-20260916.md §2.3 / §6:
--   (1) all 6 seeded venues were inserted as onboarding_status='draft', while
--       venue assignment requires 'active' (venueAssignmentService.ts:344,352)
--       -> the assignment candidate set was empty;
--   (2) Batch & Co's seeded 20:00-02:00 window is cross-midnight and therefore
--       unsatisfiable under the lexicographic predicate
--       (start_time <= t AND end_time >= t; venueAssignmentService.ts:128-129,140-141).
--
-- Idempotent: safe to re-run on local / staging / production.
-- The inverse (DOWN) is documented as a commented block at the end of this file.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- (1) Activate the 6 seeded partner venues
-- -----------------------------------------------------------------------------
-- Ids verified directly against the two historical seed files (NOT guessed):
--   seed_venue_partners_20260602.sql    -> ids ...0001..0005 (lines 19/30/41/52/63)
--   seed_venue_batch_and_co_20260608.sql -> id  ...0006      (line 18)
-- Scoped to exactly those 6 ids -- deliberately NOT a blanket
-- `UPDATE venues SET onboarding_status='active'`. The guard keeps re-runs no-ops.
UPDATE venues
SET onboarding_status = 'active'
WHERE id IN (
  '550e8400-e29b-41d4-a716-446655440001', -- 弥所
  '550e8400-e29b-41d4-a716-446655440002', -- T馆·艺术餐厅
  '550e8400-e29b-41d4-a716-446655440003', -- Bruma
  '550e8400-e29b-41d4-a716-446655440004', -- Max Shenzhen
  '550e8400-e29b-41d4-a716-446655440005', -- Delete Bar大喇叭精酿
  '550e8400-e29b-41d4-a716-446655440006'  -- Batch & Co
)
AND onboarding_status IS DISTINCT FROM 'active';

-- -----------------------------------------------------------------------------
-- (2) Replace the stale COMMENT ON COLUMN venues.budget_categories
-- -----------------------------------------------------------------------------
-- The legacy comment (20260203000000_add_venue_budget_categories.sql:40) still
-- documented the deprecated vocabulary. Documentation only -- no value is rewritten.
COMMENT ON COLUMN venues.budget_categories IS
  'Per-person budget ranges for a venue. The canonical ordered tier registry (namespaced ids such as dining_150_200 / drinks_80_150) lives in packages/shared/src/budgetTiers.ts. Values in this column are still LEGACY labels (e.g. 150-200, 80-150) pending the coordinated namespace migration (T1b) -- they are NOT yet namespaced tier ids.';

-- -----------------------------------------------------------------------------
-- (3) Repair Batch & Co's permanently-unmatchable time-slot window
-- -----------------------------------------------------------------------------
-- Seeded as 20:00-02:00 (seed_venue_batch_and_co_20260608.sql:46-52). Because
-- start_time/end_time are varchar compared lexicographically, a window with
-- start_time > end_time matches NO value of t -> the venue was permanently
-- slot-less. Ops decision = worksheet §6 option (a): rewrite to the SAME-DAY
-- subset 20:00-23:59, which stays within the venue's real 20:00-02:00 hours and
-- IS matchable. Pre-20:00 events cannot be hosted at this venue.
-- Idempotent: delete-then-insert keyed on venue_id (7 rows, days 0..6).
DELETE FROM venue_time_slots
WHERE venue_id = '550e8400-e29b-41d4-a716-446655440006';

INSERT INTO venue_time_slots
  (venue_id, day_of_week, start_time, end_time, max_concurrent_events, is_active, notes)
VALUES
  ('550e8400-e29b-41d4-a716-446655440006', 0, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 1, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 2, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 3, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 4, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 5, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）'),
  ('550e8400-e29b-41d4-a716-446655440006', 6, '20:00', '23:59', 1, true, '整店包场模式，建议4-8人/场（同日窗口 20:00-23:59；真实营业至次日 02:00）');

COMMIT;

-- =============================================================================
-- DOWN / INVERSE  (commented out -- NOT executed by the up-migration)
-- -----------------------------------------------------------------------------
-- Restores the pre-T1a state: the 6 venues back to 'draft', Batch & Co's
-- original cross-midnight window, and the original column comment.
-- Apply by uncommenting and running through psql (or run T1b's replacement if
-- the namespace migration has already shipped).
--
-- BEGIN;
--
-- UPDATE venues
-- SET onboarding_status = 'draft'
-- WHERE id IN (
--   '550e8400-e29b-41d4-a716-446655440001',
--   '550e8400-e29b-41d4-a716-446655440002',
--   '550e8400-e29b-41d4-a716-446655440003',
--   '550e8400-e29b-41d4-a716-446655440004',
--   '550e8400-e29b-41d4-a716-446655440005',
--   '550e8400-e29b-41d4-a716-446655440006'
-- );
--
-- DELETE FROM venue_time_slots
-- WHERE venue_id = '550e8400-e29b-41d4-a716-446655440006';
--
-- INSERT INTO venue_time_slots
--   (venue_id, day_of_week, start_time, end_time, max_concurrent_events, is_active, notes)
-- VALUES
--   ('550e8400-e29b-41d4-a716-446655440006', 0, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 1, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 2, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 3, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 4, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 5, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场'),
--   ('550e8400-e29b-41d4-a716-446655440006', 6, '20:00', '02:00', 1, true, '整店包场模式，建议4-8人/场');
--
-- COMMENT ON COLUMN venues.budget_categories IS
--   'Standardized budget ranges: ["150以下","150-200","200-300","300-500"] for restaurants, ["80以下","80-150"] for bars';
--
-- COMMIT;
-- =============================================================================
