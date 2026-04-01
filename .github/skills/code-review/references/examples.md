# Code Review — Practical Examples

Concrete examples of applying the Harness Engineering Framework during a PR review. Each example shows what changed, what to inspect, which pillars are affected, and what feedback to give.

---

## Example 1: Matching PR that is functionally correct but violates deterministic scoring boundaries

### What changed

A developer adds a new "recent activity" scoring factor to the pool matching algorithm. The factor reads from `user_activity_events` — a table that also backs interest-signal analytics — and adds a small score boost for users who were active in the last 24 hours.

```typescript
// apps/server/src/routes/domains/matching.ts
const activityBoost = await db.query.userActivityEvents.findFirst({
  where: eq(userActivityEvents.userId, userId),
  orderBy: desc(userActivityEvents.createdAt),
});
score += activityBoost ? 0.05 : 0;
```

### What to inspect

- Does `user_activity_events` sit on the interest-signal side of the signal boundary?
- Is the scoring factor deterministic given the same inputs, or does it vary based on timing?
- Is the new factor documented in the scoring weight table?
- Does the matching domain skill explicitly prohibit mixing interest signals into the deterministic score?

### Harness pillars affected

- **Reliability** — the boost is time-dependent; two runs on the same data at different times produce different scores, breaking determinism.
- **Maintainability / architecture fit** — `matching-domain` skill defines a strict signal boundary: interest signals must not enter the deterministic scoring path.
- **Observability** — the new factor is invisible; if scores change unexpectedly, there is no log to explain why.

### Feedback to give

> **Blocking — signal boundary violation**
>
> `user_activity_events` sits on the interest-signal side of the signal boundary defined in the `matching-domain` skill. Mixing it into the deterministic scoring path violates the invariant that score output must be reproducible given the same inputs.
>
> Additionally, the factor is time-dependent (`last 24 hours`), which breaks determinism — two scoring runs on identical user data at different times will produce different results.
>
> **Requested changes:**
> - Remove the activity boost from the deterministic scoring path.
> - If recency should influence matching, route it through the AI explanation layer, not the score itself.
> - See `.github/skills/matching-domain/SKILL.md` — signal boundary invariant.
>
> **Harness pillar verdicts:**
> - reliability: Concern (non-deterministic scoring)
> - scalability: Pass
> - security: Pass
> - observability: Concern (no logging of factor contribution)
> - maintainability / architecture fit: Fail (signal boundary violation)

---

## Example 2: Stateful payment route that lacks idempotency and atomicity

### What changed

A new `/api/payments/apply-promo` route applies a promotional credit to a user's account. It writes the credit balance, then sends a confirmation email, then marks the promo code as used.

```typescript
// apps/server/src/routes/domains/payments.ts
router.post('/apply-promo', requireAuth, async (req, res) => {
  const { promoCode } = req.body;
  await db.update(userCredits).set({ balance: sql`balance + 10` }).where(eq(userCredits.userId, req.user.id));
  await sendPromoConfirmationEmail(req.user.email);
  await db.update(promoCodes).set({ usedAt: new Date() }).where(eq(promoCodes.code, promoCode));
  res.json({ ok: true });
});
```

### What to inspect

- Are all three writes wrapped in a transaction?
- What happens if the email send fails — is the credit already applied and the promo not yet marked used?
- What happens if the client retries after a 5xx — will the user receive double credit?
- Is the promo application logged for audit purposes?
- Is there an idempotency key or guard preventing double-application?

### Harness pillars affected

- **Reliability** — side effect (email) fires before the promo is marked used; partial failure leaves inconsistent state.
- **Security** — no idempotency guard means a retry or duplicate request applies the credit twice.
- **Observability** — no structured log of the promo application for audit or support purposes.

### Feedback to give

> **Blocking — atomicity and idempotency missing**
>
> This route has two reliability problems:
>
> 1. The email send happens between two DB writes. If `sendPromoConfirmationEmail` throws, the credit is applied but the promo code is not marked used — allowing re-use. Side effects must happen **after** all persistence is committed (see `reliability-and-state-integrity` skill).
>
> 2. There is no idempotency guard. A network retry or duplicate POST will apply the credit again. At minimum, check that the promo code has not already been used before applying the credit.
>
> **Requested changes:**
> - Wrap both DB writes in a single transaction.
> - Move `sendPromoConfirmationEmail` to after the transaction commits.
> - Add a guard: check `promoCodes.usedAt` is null before proceeding, and return a clear error if already used.
> - Add a structured log: `{ event: 'promo_applied', userId, promoCode, creditAdded: 10 }`.
>
> **Harness pillar verdicts:**
> - reliability: Fail (side effect before commit, no atomicity)
> - scalability: Pass
> - security: Concern (double-application via retry)
> - observability: Concern (no audit log)
> - maintainability / architecture fit: Pass

---

## Example 3: New server endpoint that works but has no observability

### What changed

A new `/api/admin/export-user-data` endpoint is added for the admin panel. It queries all users matching a filter and streams a CSV response. The route is gated behind `requireAdminAuth`.

```typescript
// apps/server/src/routes/domains/admin.ts
router.get('/export-user-data', requireAdminAuth, async (req, res) => {
  const { filter } = req.query;
  const users = await db.select().from(usersTable).where(buildFilter(filter));
  res.setHeader('Content-Type', 'text/csv');
  res.send(buildCsv(users));
});
```

### What to inspect

- Is the export action logged with the acting admin's identity and the filter used?
- Is there any rate limiting or size guard on the export?
- Is the request ID propagated through the handler?
- Are sensitive fields (e.g., phone numbers, emails) included in the CSV, and is that intentional and documented?
- What happens if `buildFilter` receives unexpected input — is SQL injection possible?

### Harness pillars affected

- **Observability** — no audit log of who exported what data and when; this is a high-value audit event.
- **Security** — bulk data export without audit logging is a data-leak risk; also need to verify `buildFilter` is safe.
- **Scalability** — no size guard means a single request could export the full user table into memory.

### Feedback to give

> **Blocking — missing audit log and missing scalability guard**
>
> This endpoint exports bulk user data — a high-value audit event — with no record of who ran it, what filter was used, or how much data was returned. Per the `platform-observability-and-ops` skill, actions with data-access or compliance significance must be audit-logged.
>
> Additionally, loading all matching users into memory before streaming is a scalability risk as the user base grows.
>
> **Requested changes:**
> - Add a structured audit log before returning: `{ event: 'admin_user_export', adminId: req.user.id, filter, rowCount: users.length }`.
> - Add a row-count guard (e.g., reject or paginate if result exceeds 10 000 rows).
> - Verify `buildFilter` uses parameterised queries, not string interpolation.
> - Confirm which fields are intentionally included in the CSV and whether any should be redacted.
>
> **Harness pillar verdicts:**
> - reliability: Pass
> - scalability: Concern (unbounded memory load)
> - security: Concern (no audit trail for bulk data export; verify filter safety)
> - observability: Fail (no audit log for a high-value data-access event)
> - maintainability / architecture fit: Pass
