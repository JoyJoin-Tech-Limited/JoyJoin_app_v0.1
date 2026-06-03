# Grill-Me — Database Migration Safety

> Stress-test schema change assumptions. One question per turn.
> One bad migration = production outage. Every assumption must survive scrutiny.

## Classify First

Ask before any schema change:

**Q1:** Is this change additive (new column/table), a rename, a constraint tightening, or a destructive change (drop column)?
- Recommended: Classified explicitly. Additive → `db:push` may be sufficient. Rename/constraint/destructive → explicit migration required.

**Q2:** Does existing live data violate the new constraint or schema? Have you checked the production database via Postgres MCP?
- Recommended: Live DB inspected. Row counts, existing values, duplicates checked. Migration plan accounts for real data.

## Migration Design

Ask when writing migration SQL:

**Q3:** Can this migration be run twice safely? What happens on re-run? Is it idempotent?
- Recommended: Idempotent. Uses `IF EXISTS` / `IF NOT EXISTS`. Checks preconditions before modifying. Converges to same final state.

**Q4:** What's the compatibility window? Can old application code survive the intermediate schema state during rollout?
- Recommended: Expand → verify → contract. Old code works with expanded schema. New code works after contract. No instant cutover without compatibility check.

**Q5:** If the migration fails mid-way, what's the database state? Partial changes? Rollback possible?
- Recommended: Transaction-wrapped where possible. Failure → full rollback. For non-transactional DDL (e.g., PostgreSQL `ADD COLUMN`), documented abort state.

## Verification

Ask after writing migration:

**Q6:** What preconditions does this migration verify before running? What postconditions does it check after?
- Recommended: Pre: table/column existence, row counts. Post: constraint presence, data integrity, no orphans. Loud failure on mismatch.

**Q7:** How do you know the migration succeeded? What's the verification query?
- Recommended: Explicit verification query. "SELECT count(*) WHERE old_value IS NOT NULL" → 0. "SHOW constraint" → exists. Assertion, not assumption.

## Rollback & Recovery

Ask for non-trivial migrations:

**Q8:** If this migration causes a production issue, what's the rollback plan? Can we undo it?
- Recommended: Rollback script documented (even if manual). Abort conditions listed. Recovery steps clear.

**Q9:** What happens if the migration runs on an empty/fresh database (new dev environment)?
- Recommended: Guarded with existence checks. Fresh DB skips safely. Migration doesn't assume pre-existing data.

## Data Backfill

Ask when transforming existing data:

**Q10:** How many rows will this backfill touch? What's the estimated runtime? Tested on a copy of production?
- Recommended: Row count known. Runtime estimated. Tested on production-sized dataset. Batched if > 100K rows.

**Q11:** During backfill, can the application still read/write safely? Or does this need a maintenance window?
- Recommended: Backfill is read-safe. New column is nullable during backfill. Application reads old + new column until backfill complete.

## Contract Changes

Ask when changing column types or constraints:

**Q12:** Are there any application code paths that still reference the old column name or old type?
- Recommended: Code search completed. Old references updated or documented with migration order. `npm run guardrails` passes.
