# Database Query Optimization Patterns Reference

## Drizzle DSL Examples

### Column selection — always project narrow sets

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

### Join discipline

- Prefer `innerJoin` when both sides are required; use `leftJoin` only when the right side is optional.
- Avoid joining wide tables (`users`) just to fetch one or two columns; project only what you need.
- Be cautious with self-joins on `users` (e.g. chat reports); they are easy to write but expensive at scale.

### Subqueries and CTEs

- Drizzle supports raw `sql` fragments and subqueries. Use them when a single round-trip is cheaper than multiple simpler queries.
- Example: `eventCreditsRepo.getAvailableCreditCountInternal` uses an aggregate subquery with `coalesce(sum(...), 0)::int`.

## Batch Loading with `inArray`

**Anti-pattern (N+1):**
```typescript
for (const event of events) {
  const participants = await db.select().from(eventAttendance).where(eq(eventAttendance.eventId, event.id));
}
```

**Correct pattern:**
```typescript
const rows = await db
  .select()
  .from(eventAttendance)
  .where(inArray(eventAttendance.eventId, eventIds));

const participantsByEvent = new Map<string, typeof rows>();
for (const row of rows) {
  const list = participantsByEvent.get(row.eventId) ?? [];
  list.push(row);
  participantsByEvent.set(row.eventId, list);
}
```

The repo already uses `preloadUserInterests(userIds)` in `poolMatchingService.ts` as the canonical batch-preload example.

## `preloadUserInterests` Pattern

When you need user interests for a set of users, batch-load them in one query instead of per-user lookups:

```typescript
const interests = await db
  .select({ userId: userInterests.userId, interestId: userInterests.interestId })
  .from(userInterests)
  .where(inArray(userInterests.userId, userIds));

const byUser = new Map<string, number[]>();
for (const row of interests) {
  const list = byUser.get(row.userId) ?? [];
  list.push(row.interestId);
  byUser.set(row.userId, list);
}
```

## Query-Plan Review Guide

1. Run `EXPLAIN` via `db.execute(sql`EXPLAIN ...`)` to verify index usage
2. Check the per-request `dbCount` and `dbMax` in logs — high counts signal N+1
3. For composite indexes, the leading column must be the one with highest selectivity or the equality filter
4. If a join produces a Cartesian explosion, two smaller queries with in-memory assembly may be faster

## Transaction Scope

- Pass `tx: DatabaseLike` (from `drizzle-orm/neon-serverless`) into repository helpers that must run inside a transaction.
- Do not mix `db` and `tx` in the same logical unit of work.
- `eventCreditsRepo.ts` is the canonical example: `grantCreditsForPayment`, `consumeCreditForPoolRegistration`, and `reverseCreditsForPayment` all accept `tx`.

## Observability

- The server wraps `db` in `db_proxy.ts`, which tracks `dbCount` (number of DB operations) and `dbMs` / `dbMax` (total and max latency) per request via `perfStorage`.
- If a route has high `dbCount` relative to the response payload, it is a strong signal of N+1 or redundant queries.
- Prometheus metrics (`http_request_duration_ms`) are also available at `/api/metrics`.
