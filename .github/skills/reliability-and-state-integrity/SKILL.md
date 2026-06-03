---
name: reliability-and-state-integrity
description: >
  Transactions, idempotency, execution guards, recovery/re-entry semantics, explicit expiry
  handling, and separation of critical writes from side effects. Use when implementing stateful
  operations, payment flows, session lifecycle, or any multi-step server action. Trigger phrases:
  "make this idempotent", "wrap in a transaction", "handle retry safely", "side effect after
  commit", "execution guard".
---

# Reliability and State Integrity

**Core rule:** Critical writes must be atomic. Side effects (notifications, AI enrichment, analytics) happen after the critical write succeeds — never as part of the same transaction.

## When to use this skill

- Implementing a multi-step server operation (payment, matching, session creation)
- Adding or modifying a flow that must be re-entrant (user can retry or reconnect)
- Designing state that expires or has a time-bounded lifecycle
- Reviewing a flow for atomicity or idempotency gaps

## Transaction overview

Wrap critical multi-table writes in a database transaction:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(orders).values(orderData);
  await tx.update(pools).set({ status: 'matched' }).where(...);
});
// Side effects happen here, outside the transaction
await sendMatchNotification(matchedGroup);
```

- If any step inside fails, the entire write rolls back
- Side effects must happen outside the transaction body
- Never nest transactions — flatten the critical write and move side effects out

## Grill-me stress-test

After implementing stateful operations, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests transactions, idempotency, execution guards, expiry enforcement, and side-effect ordering. Silent data corruption starts with an unexamined retry assumption.

## Idempotency principles

Operations that can be retried or replayed must be idempotent:

- Payment confirmation: check for existing confirmed payment before processing
- Pool join: check for existing registration before inserting
- Session creation: check for an active session before creating a new one
- Use unique constraints or explicit existence checks to guard against duplicate inserts

See [`references/patterns.md`](references/patterns.md) for execution guard examples, recovery/re-entry semantics, expiry handling, and side-effect ordering rules.

## Quick examples

**User says:** "The WeChat Pay webhook sometimes fires twice — how do I handle replay?"
**Apply this skill by:** Adding an existence check for the order's confirmed payment record before processing (inside a transaction). If already confirmed, return 200 without re-processing — do not re-run charge logic.
**Result:** Payment is idempotent; duplicate webhook deliveries are safely ignored.

---

**User says:** "A user refreshes mid-session join — how do I handle the rejoin?"
**Apply this skill by:** Making the `POST /api/social-icebreaker/start` handler idempotent: check for an existing session for that group, and return current state if found rather than erroring or creating a duplicate session.
**Result:** Reconnecting or refreshing restores the user to the current session state without side effects.

## Troubleshooting

- **Duplicate rows in a table after a retry** — the operation is not idempotent. Add a `UNIQUE` constraint on the natural key and handle `conflict` gracefully, or check for existence before inserting within a transaction.
- **Execution guard stuck at `isRunning = true` after a crash** — the guard was not released in a `finally` block. Add `finally { await releaseGuard() }` and add a timeout-based guard reset for recovery.
- **Side effect (notification, AI call) triggered before the transaction committed** — the side effect is inside the `db.transaction()` block. Move it outside: commit the transaction first, then run side effects.
- **Expired state returned to the user as if still valid** — expiry is not checked on read. Add a server-side `Date.now()` comparison against the expiry timestamp and return an appropriate error or redirect.

## Review checklist

- [ ] Critical multi-table writes are wrapped in `db.transaction()`
- [ ] Side effects (notifications, AI calls, analytics) happen after the transaction commits
- [ ] Retryable operations check for an existing result before re-executing (idempotency)
- [ ] Execution guards are released in a `finally` block
- [ ] Expiry is checked with a server-side timestamp, not client-provided data
- [ ] Response is sent only after the critical write succeeds — not before
- [ ] Grill-me interview completed for any multi-step operation (see `references/grill-me-checklist.md`)
