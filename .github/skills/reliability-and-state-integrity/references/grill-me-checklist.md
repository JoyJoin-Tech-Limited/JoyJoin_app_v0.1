# Grill-Me — Reliability and State Integrity

> Stress-test stateful operations. One question per turn.
> Silent data corruption starts with an unexamined retry assumption.

## Transactions

Ask when implementing multi-table writes:

**Q1:** List every table this operation writes to. Which writes are in the same transaction? Which are NOT?
- Recommended: Critical writes (state mutation, foreign key dependencies) in one transaction. Side effects (notifications, AI, analytics) outside.

**Q2:** If the transaction fails mid-way, what state does the database end up in? Is partial state possible?
- Recommended: Full rollback. No partial writes. PostgreSQL transaction guarantees atomicity.

**Q3:** Are there any nested transactions? If so, flatten them — outer transaction succeeds → side effects run → finish.
- Recommended: No nested transactions. One flat transaction per critical write path.

## Idempotency

Ask when operations can be retried:

**Q4:** What natural key makes this operation idempotent? What prevents duplicate rows on retry?
- Recommended: UNIQUE constraint on natural key (e.g., `userId + poolId` for pool registration). Existence check before insert inside transaction.

**Q5:** If the client times out and retries, does the server re-execute side effects (notifications, AI calls)?
- Recommended: No. Existence check returns existing result. Side effects only fire on first successful execution.

**Q6:** After a crash between write success and response, the client retries. Does the server return the original result or create a duplicate?
- Recommended: Returns original result. Idempotency key or existence check prevents re-execution.

## Execution Guards

Ask when operations must not run concurrently:

**Q7:** What prevents this operation from running twice concurrently? Show me the guard.
- Recommended: Execution guard (DB row lock or `FOR UPDATE`). Guard acquired before work, released in `finally`.

**Q8:** If the process crashes while holding the guard, does the guard release automatically? Or is there a stuck-state recovery path?
- Recommended: Timeout-based guard reset. `finally` block releases on normal exit. Stale guard detection + reset on crash recovery.

## Expiry

Ask when state has a time-bounded lifecycle:

**Q9:** What's the expiry policy? Is expiry checked on read (server-side timestamp) or only on write/sweep?
- Recommended: Expiry checked on every read. `Date.now() > expiresAt` → return expired error. Sweep is cleanup, not enforcement.

**Q10:** If the expiry sweep fails or is delayed, do users see expired state as if it's still valid?
- Recommended: No. Read-time expiry check prevents this. Sweep is a garbage-collection optimization, not the enforcement mechanism.

## Side Effects

Ask when triggering non-transactional work:

**Q11:** List every side effect (notification, WebSocket broadcast, AI enrichment, analytics event). Do any of these fire BEFORE the critical write commits?
- Recommended: All side effects fire after transaction commit. Order: commit → side effects. Never: side effect → commit.
