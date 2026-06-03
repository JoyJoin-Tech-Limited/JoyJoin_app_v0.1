---
name: database-migration-safety
description: >-
  Safe schema evolution, idempotent migration scripts, pre and post verification,
  and rollout planning for database changes. Use when writing migrations,
  renaming columns, tightening constraints, backfilling data, or deciding whether
  db:push is enough. Trigger phrases: "plan a migration", "rename a column
  safely", "backfill data", "fix a constraint", "db:push vs migration".
---

# Database Migration Safety

## Purpose

This skill covers safe schema evolution for live data: when to use an explicit
migration, how to keep migration scripts idempotent, and how to verify before
and after state instead of trusting a schema push blindly.

## When to use this skill

Use this skill when you are:

- planning or writing a migration script or migration SQL
- renaming columns or moving from an old name to a new canonical name
- tightening constraints on tables that already contain data
- backfilling or cleaning data before adding a constraint or dropping old fields
- deciding whether `npm run db:push` is enough or an explicit migration is required

## Core workflow

1. Classify the change before touching the database.
   Additive schema-only changes may be compatible with `db:push`.
   Renames, backfills, constraint cleanup, and destructive changes need an explicit migration plan.

2. **Postgres MCP:** Before writing any migration, use the **Postgres MCP server** (`postgres`) to inspect the live database schema — table structures, column types, existing constraints, indexes, and approximate row counts. Do not rely solely on `schema.ts` or local assumptions when the production database may differ.

3. Prefer expand, verify, then contract.
   For non-trivial live-data changes, design the rollout so the app can survive intermediate states instead of assuming a one-shot cutover.

4. Make migration scripts idempotent and environment-aware.
   Require `DATABASE_URL`, check that the target tables or columns actually exist, and make re-runs safe whenever practical.

5. Verify before and after state explicitly.
   Count duplicates before cleanup, confirm the constraint or new column exists afterward, and fail loudly when postconditions are not met.

6. Keep rollback thinking attached to the plan.
   Even when the script itself is one-way, document the abort condition, the compatibility window, and what must be checked before contracting old fields away.

## Grill-me stress-test

Run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests classification, idempotency, compatibility windows, verification queries, and rollback plans.

## Current repo patterns

- Migration helper scripts in `scripts/` require `DATABASE_URL` and exit early when the target tables do not exist yet.
- Existing scripts read checked-in SQL and then verify postconditions such as duplicate removal, constraint presence, or renamed columns.
- Re-running a migration should not corrupt the database; treat idempotency as a feature, not a convenience.

## Decision guide

- **Use `db:push` only** when the change is additive and does not require data cleanup, backfill, or a compatibility window.
- **Use an explicit migration** when you are renaming fields, fixing duplicate data, tightening uniqueness, or changing a live contract that old rows already violate.
- **Split rollout steps** when application code and schema cannot move safely in one instant.

## Quick examples

- **Rename role columns to archetype columns**: write a migration that renames the database shape, then verify no old `*_role` columns remain.
- **Fix duplicate rows before a uniqueness constraint**: count duplicates first, remove or consolidate them deterministically, then add the constraint and verify it exists.
- **Add a new required column to live data**: expand with a nullable or backfilled path first, update code, then contract once the data is clean.

## Troubleshooting

**`db:push` looks easier than a migration**
If existing data must be transformed or validated, `db:push` alone is not the right tool. Write the migration plan explicitly.

**The script fails on a new or empty database**
Guard the script with table or column existence checks so fresh environments skip safely until the schema exists.

**The migration seems successful but the app still breaks**
Check the compatibility window. The schema may have changed safely while the application code still assumes the old contract.

**A re-run behaves differently from the first run**
Treat that as a migration bug. Idempotent scripts should converge on the same valid final state.

## Review checklist

- [ ] The change is classified correctly as additive, rename/backfill, constraint cleanup, or contract change
- [ ] An explicit migration is used when live data must be transformed or validated
- [ ] The script or plan is safe to re-run or fails safely with clear guards
- [ ] Preconditions and postconditions are verified explicitly
- [ ] The rollout order keeps application code compatible with intermediate schema states
- [ ] Rollback or abort conditions are documented for non-trivial changes
- [ ] Grill-me interview completed for any rename, constraint, backfill, or destructive change (see `references/grill-me-checklist.md`)

## Related files

- [`packages/shared/src/schema.ts`](../../packages/shared/src/schema.ts)
- [`scripts/verify-db-alignment.mjs`](../../scripts/verify-db-alignment.mjs) — CI gate: compares schema.ts against live DB
- [`scripts/verify-journal-sync.mjs`](../../scripts/verify-journal-sync.mjs) — ensures all .sql migrations are tracked in _journal.json
- [`scripts/rebuild-journal.mjs`](../../scripts/rebuild-journal.mjs) — rebuilds _journal.json from migration files
- [`backend-models-standards/SKILL.md`](../backend-models-standards/SKILL.md)
