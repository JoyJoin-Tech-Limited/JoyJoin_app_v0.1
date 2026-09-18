-- =============================================================================
-- Migration: 0094_budget_tier_registration_retag
-- Task:      T1c (docs/design/budget-tier-implementation-plan-20260916.md §7.10)
-- Date:      2026-09-16
--
-- DATA-ONLY migration (no DDL, no schema change, no code). Retags
-- `event_pool_registrations.budget_range` (饭局 / dining namespace) and
-- `bar_budget_range` (酒局 / drinks namespace) from LEGACY labels to canonical
-- namespaced tier ids from packages/shared/src/budgetTiers.ts.
--
-- MUST NOT SHIP ALONE: paired with 0093 (venue retag) and the server-side L1
-- write + read normalization. See 0093's header for the full rationale.
--
-- Mapping (same registry as the write path):
--   饭局 budget_range:     150以下 -> dining_150_below
--                          150-200 -> dining_150_200
--                          200-300 -> dining_200_300
--                          300-500 -> dining_300_500
--   酒局 bar_budget_range: 80以下  -> drinks_80_below
--                          80-150  -> drinks_80_150
--
-- ⚠️ `150-200` is NOT a valid 酒局 value: the registry deliberately withholds
--    `drinks_150_200` (reserved, `per_person`, order 2). Any `bar_budget_range`
--    element equal to `150-200` is UNMAPPABLE and is LEFT UNTOUCHED here. The
--    pre-flight query below enumerates them; they are residual risk to be
--    re-verified by ops (spec §13 B2/B3), NOT coerced.
--
-- ⚠️ The blind-box vocabulary `100-200` (decision B3) is likewise unmappable and
--    is preserved untouched (the ELSE branch rebuilds the element verbatim).
--
-- Idempotency: each UPDATE is scoped with `&&` against the LEGACY labels, so a
-- second run matches 0 rows; the IS DISTINCT FROM guard removes any no-op
-- rewrite. Arrays are rebuilt element-wise, preserving order and any
-- unmappable element.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PRE-FLIGHT (run BEFORE the updates; every row returned is UNMAPPABLE and will
-- be left untouched — review before applying)
-- -----------------------------------------------------------------------------
-- (a) budget_range values with no dining mapping and not already a dining id:
SELECT DISTINCT v AS unmappable_budget_range
FROM event_pool_registrations, LATERAL unnest(budget_range) AS v
WHERE v IS NOT NULL
  AND v NOT IN ('150以下', '150-200', '200-300', '300-500')
  AND v NOT LIKE 'dining\_%'
ORDER BY 1;

-- (b) bar_budget_range values with no drinks mapping and not already a drinks id
--     (expected leftover: `150-200`):
SELECT DISTINCT v AS unmappable_bar_budget_range
FROM event_pool_registrations, LATERAL unnest(bar_budget_range) AS v
WHERE v IS NOT NULL
  AND v NOT IN ('80以下', '80-150')
  AND v NOT LIKE 'drinks\_%'
ORDER BY 1;

BEGIN;

-- -----------------------------------------------------------------------------
-- (1) budget_range  — 饭局 namespace
-- -----------------------------------------------------------------------------
UPDATE event_pool_registrations AS r
SET budget_range = mapped.rewritten
FROM (
  SELECT r2.id,
         array_agg(
           CASE t.v
             WHEN '150以下' THEN 'dining_150_below'
             WHEN '150-200' THEN 'dining_150_200'
             WHEN '200-300' THEN 'dining_200_300'
             WHEN '300-500' THEN 'dining_300_500'
             ELSE t.v
           END
           ORDER BY t.ord
         ) AS rewritten
  FROM event_pool_registrations r2
  CROSS JOIN LATERAL unnest(r2.budget_range) WITH ORDINALITY AS t(v, ord)
  WHERE r2.budget_range && ARRAY['150以下', '150-200', '200-300', '300-500']::text[]
  GROUP BY r2.id
) AS mapped
WHERE r.id = mapped.id
  AND r.budget_range IS DISTINCT FROM mapped.rewritten;

-- -----------------------------------------------------------------------------
-- (2) bar_budget_range  — 酒局 namespace
-- -----------------------------------------------------------------------------
UPDATE event_pool_registrations AS r
SET bar_budget_range = mapped.rewritten
FROM (
  SELECT r2.id,
         array_agg(
           CASE t.v
             WHEN '80以下' THEN 'drinks_80_below'
             WHEN '80-150' THEN 'drinks_80_150'
             ELSE t.v
           END
           ORDER BY t.ord
         ) AS rewritten
  FROM event_pool_registrations r2
  CROSS JOIN LATERAL unnest(r2.bar_budget_range) WITH ORDINALITY AS t(v, ord)
  WHERE r2.bar_budget_range && ARRAY['80以下', '80-150']::text[]
  GROUP BY r2.id
) AS mapped
WHERE r.id = mapped.id
  AND r.bar_budget_range IS DISTINCT FROM mapped.rewritten;

COMMIT;

-- -----------------------------------------------------------------------------
-- POST-VERIFY (run after COMMIT)
-- -----------------------------------------------------------------------------
-- (a) Any residual non-dining value in budget_range (expected: only B3
--     leftovers such as `100-200`, if any rows carried one):
SELECT DISTINCT v AS residual_budget_range
FROM event_pool_registrations, LATERAL unnest(budget_range) AS v
WHERE v IS NOT NULL
  AND v NOT LIKE 'dining\_%'
ORDER BY 1;

-- (b) Any residual non-drinks value in bar_budget_range (expected: `150-200`
--     rows, which are intentionally unmapped):
SELECT DISTINCT v AS residual_bar_budget_range
FROM event_pool_registrations, LATERAL unnest(bar_budget_range) AS v
WHERE v IS NOT NULL
  AND v NOT LIKE 'drinks\_%'
ORDER BY 1;

-- (c) Distribution after the retag:
SELECT budget_range, bar_budget_range, count(*) AS rows
FROM event_pool_registrations
GROUP BY 1, 2
ORDER BY 3 DESC;

-- =============================================================================
-- DOWN / INVERSE  (commented out -- NOT executed by the up-migration)
-- -----------------------------------------------------------------------------
-- Restores the legacy labels. Only the canonical ids introduced by T1c are
-- reversed; unmappable leftovers (`150-200` in the drinks namespace, `100-200`)
-- were never touched and need no reversal.
--
-- BEGIN;
--
-- UPDATE event_pool_registrations
-- SET budget_range = (
--   SELECT array_agg(
--            CASE t.v
--              WHEN 'dining_150_below' THEN '150以下'
--              WHEN 'dining_150_200' THEN '150-200'
--              WHEN 'dining_200_300' THEN '200-300'
--              WHEN 'dining_300_500' THEN '300-500'
--              ELSE t.v
--            END
--            ORDER BY t.ord)
--   FROM unnest(budget_range) WITH ORDINALITY AS t(v, ord)
-- )
-- WHERE budget_range && ARRAY[
--   'dining_150_below', 'dining_150_200', 'dining_200_300', 'dining_300_500'
-- ]::text[];
--
-- UPDATE event_pool_registrations
-- SET bar_budget_range = (
--   SELECT array_agg(
--            CASE t.v
--              WHEN 'drinks_80_below' THEN '80以下'
--              WHEN 'drinks_80_150' THEN '80-150'
--              ELSE t.v
--            END
--            ORDER BY t.ord)
--   FROM unnest(bar_budget_range) WITH ORDINALITY AS t(v, ord)
-- )
-- WHERE bar_budget_range && ARRAY['drinks_80_below', 'drinks_80_150']::text[];
--
-- COMMIT;
-- =============================================================================
