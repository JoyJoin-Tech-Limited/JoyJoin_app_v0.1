---
name: database-query-optimization
description: >-
  Drizzle ORM query patterns, index strategy, N+1 avoidance, batch loading,
  and query-plan review for PostgreSQL in the JoyJoin server. Use when a route
  or repository is slow, when adding new queries that touch high-volume tables,
  or when reviewing joins, subqueries, and Drizzle DSL usage for efficiency.
  Trigger phrases: "slow query", "N+1", "optimize this query", "missing index",
  "batch load", "inArray", "preloadUserInterests", "db proxy", "query plan".
---

# Database Query Optimization

## When to use this skill

- Investigating or fixing a slow API route, repository method, or Drizzle query
- Adding a new query that reads from high-volume tables (`eventPoolRegistrations`, `users`, `eventAttendance`, `chatMessages`)
- Reviewing a PR that introduces loops over database calls, unbounded `SELECT *`, or unindexed filters
- Choosing between `inArray` batch loading vs. repeated point lookups
- Deciding whether a new column needs an index, a composite index, or a partial index
- Interpreting request latency metrics (`dbCount`, `dbMs`, `dbMax`) from the per-request perf store

## When NOT to use this skill

- Schema design, migrations, or backfills → use `database-migration-safety`
- Choosing column types, constraints, or relations → use `backend-models-standards`
- Trivial single-row lookups or test-only queries

## Core rules

1. **Repository boundary** — New persistence logic belongs in `apps/server/src/repositories/`. Do not add query logic to `storage.ts` or `legacyStorageRepo.ts`.
2. **N+1 detection** — Never query inside a loop. Batch with `inArray` and build Maps in memory.
3. **Narrow projection** — Always pass a column list to `.select({ ... })` on wide tables (especially `users`).
4. **Join discipline** — Prefer `innerJoin` when both sides are required; `leftJoin` only when optional. Project only needed columns.
5. **Transaction scope** — Pass `tx: DatabaseLike` into helpers that must run inside a transaction. Do not mix `db` and `tx` in the same unit of work.

## Index strategy overview

- **Foreign keys** should usually have an index (Drizzle does not auto-create them for PostgreSQL).
- **Composite indexes** should lead with the most selective column: `(poolId, userId)` not `(userId, poolId)` when the dominant filter is `poolId`.
- **Partial indexes** are useful for status columns with skew (e.g. `WHERE match_status = 'pending'`).
- **Covering indexes** help when the query only needs columns in the index.
- Large tables currently lacking indexes: `eventAttendance` has no indexes at all; add at minimum `eventId` and `userId` indexes.

## Observability

- The server wraps `db` in `db_proxy.ts`, which tracks `dbCount`, `dbMs`, and `dbMax` per request.
- High `dbCount` relative to the response payload is a strong signal of N+1 or redundant queries.
- Prometheus metrics are available at `/api/metrics`.

## Quick examples

**Replacing an N+1 participant loader:**

```typescript
const rows = await db
  .select({ eventId: eventAttendance.eventId, displayName: users.displayName })
  .from(eventAttendance)
  .innerJoin(users, eq(eventAttendance.userId, users.id))
  .where(inArray(eventAttendance.eventId, eventIds));

const byEvent = new Map<string, typeof rows>();
for (const r of rows) {
  const list = byEvent.get(r.eventId) ?? [];
  list.push(r);
  byEvent.set(r.eventId, list);
}
```

## Troubleshooting

- **A route is slow but the query looks simple** — Check per-request `dbCount` and `dbMax`. A simple handler may trigger hidden N+1 loops inside helpers. Use `inArray` batching or pre-load related data in one query.
- **Drizzle query returns too much data** — Always pass a column projection to `.select({ ... })` instead of `.select()` on wide tables.
- **Index added to schema but query is still slow** — Ensure the index column order matches the query filter order. Run `EXPLAIN` to verify index usage.
- **Transaction timeout or deadlock** — Keep transactions short. Do not perform LLM calls, external HTTP requests, or long computations inside a `tx` block.

## Review checklist

- [ ] New queries project only the columns they need (no unbounded `SELECT *` on wide tables)
- [ ] No database calls inside loops or `Promise.all(map(...))` without batching
- [ ] Batch lookups use `inArray` instead of repeated point queries
- [ ] Joins use `innerJoin` when the relationship is required and `leftJoin` only when optional
- [ ] New filters on high-volume tables have corresponding indexes in `schema.ts`
- [ ] Transaction helpers accept `tx: DatabaseLike` and do not mix `db` and `tx`
- [ ] Raw `sql` fragments are parameterized and not constructed with string interpolation
- [ ] Query changes are verified against per-request `dbCount` / `dbMs` telemetry or Prometheus latency histograms

## References

- [`references/patterns.md`](references/patterns.md) — Drizzle DSL examples, batch loading code, query-plan review guide, `inArray` and `preloadUserInterests` patterns, transaction-passing examples
