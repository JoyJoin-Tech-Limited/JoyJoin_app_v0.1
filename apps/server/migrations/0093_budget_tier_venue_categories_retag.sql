-- =============================================================================
-- Migration: 0093_budget_tier_venue_categories_retag
-- Task:      T1b (docs/design/budget-tier-implementation-plan-20260916.md §7.10)
-- Date:      2026-09-16
--
-- DATA-ONLY migration (no DDL, no schema change, no code). Retags the 6 seeded
-- partner venues' `venues.budget_categories` from LEGACY labels to canonical
-- namespaced tier ids from packages/shared/src/budgetTiers.ts.
--
-- MUST NOT SHIP ALONE: this file is part of the coordinated vocabulary cutover
-- (T1b + T6 write normalization + T7 read normalization). `venueAssignment`
-- compares budget values as strings (venueAssignmentService.ts) — retagging
-- venues onto ids while registrations still hold labels would hard-fail every
-- group with `budget_mismatch`. The read normalization in this same release is
-- what makes the mixed state safe.
--
-- Op-approved mapping (dispatch 2026-09-16):
--   ...0001 弥所              bar         {150-200}  -> {drinks_80_150}
--   ...0002 T馆·艺术餐厅       restaurant  {200-300}  -> {dining_200_300}
--   ...0003 Bruma             bar         {150-200}  -> {drinks_80_150}
--   ...0004 Max Shenzhen      bar         {300-500}  -> {drinks_80_150}
--   ...0005 Delete Bar大喇叭精酿 bar      {80-150}   -> {drinks_80_150}
--   ...0006 Batch & Co        bar         {80-150}   -> {drinks_80_150}
--
-- ⚠️ ASSUMED_PENDING_VERIFICATION: 弥所 / Bruma / Max Shenzhen were carrying
--    DINING labels on `bar` venues. Per ops decision (spec §13 B2) they are
--    tagged `≤150 per-person -> drinks_80_150` as an ASSUMPTION, not a verified
--    ground truth. They MUST be re-verified before launch; do not treat these
--    three rows as authoritative supply.
--
-- Idempotent: the UPDATE is guarded with IS DISTINCT FROM and is scoped to the
-- six ids below (never a blanket update). Re-running writes 0 rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PRE-FLIGHT (run BEFORE the update; review output, then apply)
-- -----------------------------------------------------------------------------
-- Current state of the six rows — confirm no unexpected drift or a 7th id:
SELECT id, name, venue_type, budget_categories
FROM venues
WHERE id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440006'
)
ORDER BY id;

BEGIN;

-- -----------------------------------------------------------------------------
-- Retag the six venues (values only)
-- -----------------------------------------------------------------------------
UPDATE venues AS v
SET budget_categories = m.target
FROM (VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::text, ARRAY['drinks_80_150']::text[]),  -- 弥所 [ASSUMED]
  ('550e8400-e29b-41d4-a716-446655440002'::text, ARRAY['dining_200_300']::text[]), -- T馆·艺术餐厅
  ('550e8400-e29b-41d4-a716-446655440003'::text, ARRAY['drinks_80_150']::text[]),  -- Bruma [ASSUMED]
  ('550e8400-e29b-41d4-a716-446655440004'::text, ARRAY['drinks_80_150']::text[]),  -- Max Shenzhen [ASSUMED]
  ('550e8400-e29b-41d4-a716-446655440005'::text, ARRAY['drinks_80_150']::text[]),  -- Delete Bar大喇叭精酿
  ('550e8400-e29b-41d4-a716-446655440006'::text, ARRAY['drinks_80_150']::text[])   -- Batch & Co
) AS m(id, target)
WHERE v.id = m.id
  AND v.budget_categories IS DISTINCT FROM m.target;

-- -----------------------------------------------------------------------------
-- Refresh the column comment: values are now canonical ids (T1a set the
-- "still legacy" wording; leaving it would be a second source of truth).
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN venues.budget_categories IS
  'Canonical per-person budget tier ids for a venue, from packages/shared/src/budgetTiers.ts (e.g. dining_150_200, drinks_80_150). Values are namespaced ids, NOT legacy labels.';

COMMIT;

-- -----------------------------------------------------------------------------
-- POST-VERIFY (run after COMMIT)
-- -----------------------------------------------------------------------------
-- (a) The six rows now carry canonical ids only:
SELECT id, name, venue_type, budget_categories
FROM venues
WHERE id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440006'
)
ORDER BY id;

-- (b) Namespace guard: no bar/homebar holds a dining_* id (spec AC-7):
SELECT id, name, venue_type, budget_categories
FROM venues
WHERE venue_type IN ('bar', 'homebar')
  AND budget_categories && ARRAY[
    'dining_150_below', 'dining_150_200', 'dining_200_300', 'dining_300_500'
  ]::text[];

-- (c) Any residual legacy label anywhere in the column (should be empty apart
--     from non-seeded rows outside this migration's scope):
SELECT id, name, venue_type, budget_categories
FROM venues
WHERE budget_categories && ARRAY[
  '150以下', '150-200', '200-300', '300-500', '80以下', '80-150'
]::text[];

-- =============================================================================
-- DOWN / INVERSE  (commented out -- NOT executed by the up-migration)
-- -----------------------------------------------------------------------------
-- Restores the six rows to their pre-T1b legacy labels and the pre-T1b comment.
--
-- BEGIN;
--
-- UPDATE venues AS v
-- SET budget_categories = m.target
-- FROM (VALUES
--   ('550e8400-e29b-41d4-a716-446655440001'::text, ARRAY['150-200']::text[]),
--   ('550e8400-e29b-41d4-a716-446655440002'::text, ARRAY['200-300']::text[]),
--   ('550e8400-e29b-41d4-a716-446655440003'::text, ARRAY['150-200']::text[]),
--   ('550e8400-e29b-41d4-a716-446655440004'::text, ARRAY['300-500']::text[]),
--   ('550e8400-e29b-41d4-a716-446655440005'::text, ARRAY['80-150']::text[]),
--   ('550e8400-e29b-41d4-a716-446655440006'::text, ARRAY['80-150']::text[])
-- ) AS m(id, target)
-- WHERE v.id = m.id
--   AND v.budget_categories IS DISTINCT FROM m.target;
--
-- COMMENT ON COLUMN venues.budget_categories IS
--   'Per-person budget ranges for a venue. The canonical ordered tier registry (namespaced ids such as dining_150_200 / drinks_80_150) lives in packages/shared/src/budgetTiers.ts. Values in this column are still LEGACY labels (e.g. 150-200, 80-150) pending the coordinated namespace migration (T1b) -- they are NOT yet namespaced tier ids.';
--
-- COMMIT;
-- =============================================================================
