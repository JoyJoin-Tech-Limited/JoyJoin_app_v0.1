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

Use this skill when you are:

- investigating or fixing a slow API route, repository method, or Drizzle query
- adding a new query that reads from high-volume tables (`eventPoolRegistrations`, `users`, `eventAttendance`, `chatMessages`)
- reviewing a PR that introduces loops over database calls, unbounded `SELECT *`, or unindexed filters
- choosing between `inArray` batch loading vs. repeated point lookups
- deciding whether a new column needs an index, a composite index, or a partial index
- working with transactions and need to decide when to pass `tx` vs. use the global `db`
- interpreting request latency metrics (`dbCount`, `dbMs`, `dbMax`) from the per-request perf store

## When NOT to use this skill

Do not use this skill when:

- the task is purely about schema design, migrations, or backfills (use `database-migration-safety`)
- the task is about choosing column types, constraints, or relations (use `backend-models-standards`)
- the task is only about adding a new route with trivial single-row lookups
- the change is local seed data, fixtures, or test-only queries

## Core content

### 1. Repository boundary rule

New persistence logic belongs in `apps/server/src/repositories/`. Do not add query logic to `storage.ts` or `legacyStorageRepo.ts`. Each repository should expose a narrow, typed interface and keep Drizzle DSL internal.

### 2. N+1 detection and batch loading

**Anti-pattern (N+1):**
```typescript
// BAD: one query per item inside a loop
for (const event of events) {
  const participants = await db.select().from(eventAttendance).where(eq(eventAttendance.eventId, event.id));
  // ...
}
```

**Correct pattern (batch with `inArray`):**
```typescript
// GOOD: one query for all items
const rows = await db
  .select()
  .from(eventAttendance)
  .where(inArray(eventAttendance.eventId, eventIds));
// Build a Map in memory
const participantsByEvent = new Map<string, typeof rows>();
for (const row of rows) {
  const list = participantsByEvent.get(row.eventId) ?? [];
  list.push(row);
  participantsByEvent.set(row.eventId, list);
}
```

The repo already uses `preloadUserInterests(userIds)` in `poolMatchingService.ts` as the canonical batch-preload example.

### 3. Index strategy in `packages/shared/src/schema.ts`

- **Foreign keys** should usually have an index (Drizzle does not auto-create them for PostgreSQL).
- **Composite indexes** should lead with the most selective column: `(poolId, userId)` not `(userId, poolId)` when the dominant filter is `poolId`.
- **Partial indexes** are useful for status columns with skew (e.g. `WHERE match_status = 'pending'`).
- **Covering indexes** (Drizzle `index().on().on()`) help when the query only needs columns in the index.
- Large tables currently lacking indexes: `eventAttendance` has no indexes at all; add at minimum `eventId` and `userId` indexes.

### 4. Column selection — always project narrow sets

Avoid `select()` with no column list on wide tables (especially `users`).

```typescript
// BAD
const [user] = await db.select().from(users).where(eq(users.id, id));

// GOOD
const [user] = await db
  .select({ id: users.id, displayName: users.displayName, archetype: users.archetype })
  .from(users)
  .where(eq(users.id, id));
```

### 5. Join discipline

- Prefer `innerJoin` when both sides are required; use `leftJoin` only when the right side is optional.
- Avoid joining wide tables (`users`) just to fetch one or two columns; project only what you need.
- Be cautious with self-joins on `users` (e.g. chat reports); they are easy to write but expensive at scale.

### 6. Transaction scope

- Pass `tx: DatabaseLike` (from `drizzle-orm/neon-serverless`) into repository helpers that must run inside a transaction.
- Do not mix `db` and `tx` in the same logical unit of work.
- `eventCreditsRepo.ts` is the canonical example: `grantCreditsForPayment`, `consumeCreditForPoolRegistration`, and `reverseCreditsForPayment` all accept `tx`.

### 7. Observability

- The server wraps `db` in `db_proxy.ts`, which tracks `dbCount` (number of DB operations) and `dbMs` / `dbMax` (total and max latency) per request via `perfStorage`.
- If a route has high `dbCount` relative to the response payload, it is a strong signal of N+1 or redundant queries.
- Prometheus metrics (`http_request_duration_ms`) are also available at `/api/metrics`.

### 8. Subqueries and CTEs

- Drizzle supports raw `sql` fragments and subqueries. Use them when a single round-trip is cheaper than multiple simpler queries.
- Example: `eventCreditsRepo.getAvailableCreditCountInternal` uses an aggregate subquery with `coalesce(sum(...), 0)::int`.

## Quick Examples

### Example 1: Replacing an N+1 participant loader with a batched join

**Before (legacyStorageRepo.ts pattern):**
```typescript
const eventsWithParticipants = await Promise.all(
  result.map(async (r) => {
    const participants = await db.select(...).from(eventAttendance).where(eq(eventAttendance.eventId, r.event.id));
    return { ...r.event, participants };
  })
);
```

**After:**
```typescript
const eventIds = result.map((r) => r.event.id);
const allParticipants = await db
  .select({ eventId: eventAttendance.eventId, displayName: users.displayName })
  .from(eventAttendance)
  .innerJoin(users, eq(eventAttendance.userId, users.id))
  .where(inArray(eventAttendance.eventId, eventIds));

const byEvent = new Map<string, typeof allParticipants>();
for (const p of allParticipants) {
  const list = byEvent.get(p.eventId) ?? [];
  list.push(p);
  byEvent.set(p.eventId, list);
}

const eventsWithParticipants = result.map((r) => ({
  ...r.event,
  participants: byEvent.get(r.event.id) ?? [],
}));
```

### Example 2: Adding a composite index for a pool-registration query

**Query pattern:**
```typescript
db.select()
  .from(eventPoolRegistrations)
  .where(and(eq(eventPoolRegistrations.poolId, poolId), eq(eventPoolRegistrations.matchStatus, "pending")));
```

**Index in schema.ts:**
```typescript
export const eventPoolRegistrations = pgTable("event_pool_registrations", {
  // ...columns...
}, (table) => [
  unique("event_pool_registrations_pool_user_unique").on(table.poolId, table.userId),
  index("idx_event_pool_registrations_pool_status").on(table.poolId, table.matchStatus),
]);
```

## Troubleshooting

**A route is slow but the query looks simple**
Check the per-request `dbCount` and `dbMax` in logs. A simple-looking handler may trigger hidden N+1 loops inside helper functions or repository calls. Use `inArray` batching or pre-load related data in one query.

**Drizzle query returns too much data**
Always pass a column projection to `.select({ ... })` instead of `.select()` on wide tables. The `users` table has 100+ columns; fetching all of them for a list view wastes memory and network bandwidth.

**Index added to schema but query is still slow**
Ensure the index column order matches the query filter order. For composite indexes, the leading column must be the one with the highest selectivity or the one used in equality filters. Run `EXPLAIN` (via `db.execute(sql`EXPLAIN ...`)`) to verify index usage.

**Transaction timeout or deadlock**
Keep transactions short. Do not perform LLM calls, external HTTP requests, or long computations inside a `tx` block. Acquire locks in a consistent order if multiple rows are updated.

**Multiple small queries vs. one large join**
If the join produces a Cartesian explosion (e.g. many-to-many with large intermediate tables), two smaller queries with in-memory assembly can be faster than one massive join. Benchmark when in doubt (`performance-benchmark`).

## Review checklist

- [ ] New queries project only the columns they need (no unbounded `SELECT *` on wide tables)
- [ ] No database calls inside loops or `Promise.all(map(...))` without batching
- [ ] Batch lookups use `inArray` instead of repeated point queries
- [ ] Joins use `innerJoin` when the relationship is required and `leftJoin` only when optional
- [ ] New filters on high-volume tables have corresponding indexes in `schema.ts`
- [ ] Transaction helpers accept `tx: DatabaseLike` and do not mix `db` and `tx` in the same unit of work
- [ ] Raw `sql` fragments are parameterized and not constructed with string interpolation
- [ ] Query changes are verified against the per-request `dbCount` / `dbMs` telemetry or Prometheus latency histograms

## Related skills

| Skill | When to hand off or co-load |
|-------|----------------------------|
| `database-migration-safety` | Adding or altering indexes requires a safe rollout plan for live data |
| `backend-models-standards` | Deciding column types, constraints, and initial index strategy for new tables |
| `server-domain-architecture` | Where to place new repository files and how to wire them into routes |
| `reliability-and-state-integrity` | Transactions, idempotency, and execution guards for multi-step writes |
| `performance-benchmark` | Measuring before/after query latency with repeatable baselines |
| `platform-observability-and-ops` | Interpreting Prometheus metrics and adding structured query logs |

## Canonical References

- `apps/server/src/repositories/` — all new query logic lives here
- `packages/shared/src/schema.ts` — Drizzle schema, indexes, and constraints
- `apps/server/src/db.ts` — database client initialization (`Pool` + `drizzle`)
- `apps/server/src/db_proxy.ts` — per-request DB operation tracking wrapper
- `apps/server/src/perf.ts` — `perfStorage`, `trackDbOp`, per-request metrics
- `apps/server/src/middleware/metrics.ts` — Prometheus HTTP latency histograms
- `apps/server/src/poolMatchingService.ts` — `preloadUserInterests` batch pattern
- `apps/server/src/repositories/eventCreditsRepo.ts` — transaction-passing (`tx`) pattern
