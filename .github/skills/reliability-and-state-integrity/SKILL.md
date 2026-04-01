---
name: Reliability and State Integrity
description: Transactions, idempotency, execution guards, recovery/re-entry semantics, explicit expiry handling, and separation of critical writes from side effects. Use when implementing stateful operations, payment flows, session lifecycle, or any multi-step server action.
---

# Reliability and State Integrity

**Core rule:** Critical writes must be atomic. Side effects (notifications, AI enrichment, analytics) happen after the critical write succeeds — never as part of the same transaction.

## When to use this skill

- Implementing a multi-step server operation (payment, matching, session creation)
- Adding or modifying a flow that must be re-entrant (user can retry or reconnect)
- Designing state that expires or has a time-bounded lifecycle
- Reviewing a flow for atomicity or idempotency gaps

## Transactions

Wrap critical multi-table writes in a database transaction:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(orders).values(orderData);
  await tx.update(pools).set({ status: 'matched' }).where(...);
});
// Side effects happen here, outside the transaction
await sendMatchNotification(matchedGroup);
```

- If any step inside the transaction fails, the entire write rolls back
- Side effects (notifications, AI calls, analytics writes) must happen outside the transaction body
- Never nest transactions — flatten the critical write and move side effects out

## Idempotency

Operations that can be retried or replayed must be idempotent:

- Payment confirmation: check for existing confirmed payment before processing
- Pool join: check for existing registration before inserting
- Session creation: check for an active session before creating a new one
- Use unique constraints or explicit existence checks to guard against duplicate inserts

```typescript
// Check-then-insert pattern (within a transaction for safety)
const existing = await tx.select().from(registrations)
  .where(and(eq(registrations.userId, userId), eq(registrations.poolId, poolId)));
if (existing.length > 0) return existing[0]; // idempotent return
await tx.insert(registrations).values(...);
```

## Execution guards

For operations that must not run concurrently (matching, scheduled tasks):

- Use a database-level lock or a flag-based guard (`isRunning`, `lockedAt`)
- Check the guard at the start and release it at the end (including on error)
- Log and skip if already running — do not queue a second execution silently

## Recovery and re-entry

Users will reconnect, retry, and resume. Design flows to handle this:

- On reconnect, restore state from the server — do not depend on client-side memory
- Expose a re-entry endpoint that returns the current state without side effects
- Session joins must be idempotent: joining an already-joined session returns current state, not an error
- Partial completions must be resumable: check which steps are done before re-executing

## Explicit expiry handling

State with a time boundary must be handled explicitly:

- Expired state should be detected on read and handled (return error or redirect)
- Do not silently return stale or expired data as if it were current
- Log expiry events with enough context to debug user-facing issues

## Separation: critical writes vs side effects

| Category | Examples | Timing |
|----------|----------|--------|
| Critical writes | Registration, payment, match group creation | Inside transaction |
| Side effects | Push notifications, AI generation, analytics, email | After transaction commits |
| Audit logs | Admin action records | After transaction commits (can be best-effort) |

Side effects that fail must not roll back a committed critical write. Consider best-effort retry or a background queue for side effects that matter.

## Common mistakes to avoid

- Sending a notification inside a database transaction (side effect before commit)
- Assuming a payment webhook fires exactly once — always handle duplicates idempotently
- Leaving a matching execution guard set to `true` permanently on an error (always release in `finally`)
- Returning 200 before the critical write succeeds (response should follow the write, not precede it)
- Using client-sent timestamps as authoritative for expiry decisions — use server-side `Date.now()`

## Related files

- `apps/server/src/poolMatchingService.ts` — matching execution with grouping logic
- `apps/server/src/poolRealtimeMatchingService.ts` — scheduled matching orchestration
- `apps/server/src/routes/domains/` — domain route handlers with transaction patterns
- `apps/server/src/repositories/` — repository-layer data access
- `packages/shared/src/schema.ts` — schema constraints (unique, not null)
- `.github/skills/testing-and-regression-guardrails/SKILL.md` — testing these patterns
