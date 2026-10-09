# Account deletion — financial-record retention decision

**Status:** 🔴 Decision required — blocks production use of `DELETE /api/admin/users/:id/data` for users with payment history
**Prepared:** 2026-10-09 · **Trigger:** §5.3 conflict discovered during HS-11 work (2026-10-06)
**Decision owners:** Legal (**mandatory sign-off**) + Product + Engineering
**Sources of record:** `docs/runbooks/account-deletion.md` §5.1–5.3 · `apps/server/src/routes/domains/adminUsers.ts:963-1027` · `apps/server/src/lib/fkCascadeDelete.ts` · `packages/shared/src/schema/_definitions.ts:1407-1546` · `packages/shared/src/legal/joyjoinTermsZh.ts:137-148` · HS-11 in `docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`

---

## 1. Problem statement

**What 账号注销 does today (verified in source 2026-10-06, re-verified 2026-10-09):**

The only deletion surface is the admin route `DELETE /api/admin/users/:id/data` (`adminUsers.ts:963`, operator/super_admin; no self-serve UI/route). In one transaction it calls `cascadeDeleteByIds(tx, "users", "id", [userId])` (`adminUsers.ts:1004`), which discovers every **non-`ON DELETE CASCADE`** FK from `users.id` and deletes dependents deepest-first (`fkCascadeDelete.ts:57-72, 166-186`). `payments.user_id` is `NOT NULL` with a default-action (NO ACTION) FK (`_definitions.ts:1432`), so a deletion request **destroys**:

| Table | Verified linkage | Deleted today |
|---|---|---|
| `payments` | `user_id` NOT NULL FK → `users.id` (`_definitions.ts:1432`) | Yes |
| `refund_attempts` | `payment_id` FK → `payments.id` (`_definitions.ts:1464`) | Yes (transitively) |
| `coupon_usage` | `user_id` + `payment_id` FKs (`_definitions.ts:1501-1502`) | Yes (transitively) |
| `subscriptions` | `user_id` FK → `users.id` (`_definitions.ts:1409`) | Yes |
| `event_credit_grants` / `event_credit_redemptions` | `user_id` (+ `payment_id` / `grant_id`) FKs (`_definitions.ts:1529, 1546`) | Yes |
| `user_coupons` | `user_id` FK → `users.id` (`_definitions.ts:1512`) | Yes |

The staging drill empirically confirmed the financial-row destruction (runbook §5.2). This is wider than §5.2's short list — every order/entitlement table with a user FK falls to the same cascade.

**Why this is a risk:**

1. **Money movement loses its record.** WeChat Pay transactions, coupon discounts, and refund attempts are the evidence base for disputes, refunds, and financial audit. Deleting them on request leaves no way to verify what a user paid.
2. **It can destroy real refundability.** The pool auto-refund pipeline finds completed payments by `relatedId` (pool) + `status` (`autoRefundService.ts:284-298`). If a user is deleted before a pool cancellation / 场次未成行 refund runs, their payment row is gone and the money can no longer be found by the pipeline — refund initiation needs `wechatOrderId`, stored only on the deleted row.
3. **The promise and the law may pull in opposite directions.** Terms promise deletion processing within **15 working days** of acceptance (`joyjoinTermsZh.ts:139`), while statutory retention duties likely require keeping transaction records. The same policy already contains the lawful-retention carve-out ("法律法规另有规定的，开发者承诺将停止除存储和采取必要的安全保护措施之外的处理", `joyjoinTermsZh.ts:137`) and minimum-necessary storage (`:147`). The two must be reconciled in user-facing copy; the ops response template (runbook §2) and ledger 留存范围 (§7) are still placeholders.
4. **Production is blocked.** Runbook §5.3: until Legal rules, **pause production deletions for users with payment history**; HS-11 remains FAIL on "§5.3 legal 留存裁定".

**In scope:** mini-program user accounts. Admin accounts are rejected by the route (`adminUsers.ts:974-976`).

---

## 2. Options

| | A — Keep current behavior | **B — Retain + detach (recommended)** | C — Archive to cold/audit table | D — Soft-delete account |
|---|---|---|---|---|
| `payments` | Deleted | Retained; `user_id` → `NULL` | Copied to archive, then deleted | Retained (PII scrubbed) |
| `refund_attempts` | Deleted | Retained (reachable only via `payments`) | Copied, then deleted | Retained |
| `coupon_usage` | Deleted | Deleted by default (money facts — `coupon_id`, `discount_amount` — remain on `payments`); retained-detached if Legal requires | Copied, then deleted | Retained |
| Engineering impact | **None** | Migration (nullable `payments.user_id` + `ON DELETE SET NULL`), cascade-helper retention support, route pre-cascade detach, contract + behavioral tests | New archive table/migration + copy step + second retention governance; disputed rows live in two places | Largest: product semantics (注销 ≠ 删除), auth/re-login semantics, unique `openid`/phone reclaim, PII scrub across the whole user graph |
| Privacy impact (what the user is told) | "数据已删除" — but no longer truthful once retention exists elsewhere | "账号已注销；交易记录依法保留（去标识化，不再与你的身份关联）" — consistent with `joyjoinTermsZh.ts:137` | Same disclosure as B, plus a second PII copy to govern | "账号已注销（保留基本信息）" — changes the promise; needs copy + UX rework |
| Operational cost | Legal exposure; disputes unanswerable; unrefundable money | Low: ledger records 留存范围; admin lookups may show payments with no user (display fallback) | Higher: dispute queries span live + archive; extra retention/restore drills | Product/ops behavior changes across login, registration, support |

---

## 3. Recommendation — Option B, subject to Legal sign-off

Adopt **B** as the target behavior. Reasoning:

- Statutory retention drivers (below) most likely require keeping transaction records — Legal must confirm. If confirmed, A is non-compliant, and C/D are the only alternatives.
- Retention fixes the refundability hole: retained `payments` rows keep `wechatOrderId`/`relatedId` searchable by the auto-refund pipeline after the account is gone.
- Minimal diff surface: one nullable column, one helper option, one route step, tests. Non-financial deletion semantics are unchanged.
- Privacy posture matches existing policy language (storage-only processing under statutory exception), with de-identification as the minimization step.

**Minimal engineering change (Tier 2 — Sprint Contract before edits):**

1. **Schema + migration** — make `payments.user_id` nullable with `ON DELETE SET NULL` (`packages/shared/src/schema/_definitions.ts:1432`); generate via `npm run db:generate -- --custom` → `db:rebuild-journal`; production DDL applied manually (repo migration discipline).
2. **Cascade helper** — add explicit retention support to `cascadeDeleteByIds` (`apps/server/src/lib/fkCascadeDelete.ts`): callers pass retained tables; the helper must not delete those rows **nor recurse into their children**. **Trap:** the helper currently skips only `ON DELETE CASCADE` (`confdeltype <> 'c'`, line 72) — `SET NULL` (`'n'`) is still followed and its rows deleted, so the FK action alone does **not** protect retained rows; the retain option is the enforcement point.
3. **Route** — in the delete transaction (`adminUsers.ts:983-1005`), before the cascade: detach retained rows (`UPDATE payments SET user_id = NULL WHERE user_id = $userId`, plus payload scrub per §4 Q5), then `cascadeDeleteByIds(..., { retain: ["payments"] })`. `refund_attempts` survives automatically (only reachable via `payments`).
4. **Tests** — extend `apps/server/src/__tests__/fkCascadeDeleteContract.test.ts`: assert the route detaches before the cascade and passes the retain config; assert the helper never deletes retained tables. Add the narrow behavioral test from runbook gap G4: delete a user with completed payments → `users` gone, `payments`/`refund_attempts` present with `user_id = NULL`. Re-run the HS-11 staging drill with updated §4.2/§6 expectations.

**Edge cases the ticket must handle:** in-flight refunds at deletion time (do not detach while a refund is non-terminal, or document admin recovery via `refund_attempts.payment_id` / `wechatOrderId`); admin read paths that assume `payments.user_id` is non-null (verified touchpoints: `paymentsRepo.ts`, `poolGroupAdmin.ts:171`, `autoRefundService.ts`); refund notification selection uses `payments.userId` (`autoRefundService.ts:287`).

**Interim rule (until B ships):** runbook §5.3 pause stands — no production deletions for users with payment/refund/entitlement rows. Option A remains acceptable **only** for users with zero financial rows (no `payments`, `refund_attempts`, `coupon_usage`, `subscriptions`, `event_credit_*`, `user_coupons`).

---

## 4. Statutory context (NOT legal advice — every applicability/period claim is 待legal 复核)

This memo names candidate statutes only; it deliberately does **not** assert article numbers or retention periods. Legal must return the answers.

Candidate retention drivers (names only, applicability unverified):
- 《中华人民共和国个人信息保护法》 (PIPL) — deletion rights carry statutory exceptions; storage may continue where law requires retention (cf. existing copy `joyjoinTermsZh.ts:137`).
- 《中华人民共和国电子商务法》 — potential transaction-record retention duty for the operator.
- 《中华人民共和国网络安全法》 — network log/record retention duties.
- 《中华人民共和国会计法》 / 《中华人民共和国税收征收管理法》 — if payment records count as accounting/tax records.
- 《中华人民共和国消费者权益保护法》 — dispute handling; retention protects the user's ability to claim.
- 《中华人民共和国民法典》 — limitation periods for potential claims (defense rationale).
- WeChat Pay / Tencent merchant agreement — contractual record-keeping and refund duties (binding, though not statute).

**Questions Legal must answer (all 待legal 复核; inputs to the sign-off block):**

| # | Question |
|---|---|
| Q1 | Does a statutory retention duty apply to our mini-program payments, and under which statute(s)? |
| Q2 | Does PIPL permit retaining payment/refund records after a deletion request, and does "store + secure only" processing satisfy the exception? |
| Q3 | Confirm the retention table set: `payments` + `refund_attempts` only, or also `coupon_usage`, `subscriptions`, `event_credit_grants` / `event_credit_redemptions`? |
| Q4 | Retention period per record class, and the lawful destruction trigger after expiry. |
| Q5 | `payments.event_registration_payload` carries user preference data (budgetRange, cuisinePreferences, dietaryRestrictions, … — verified `paymentFulfillmentRepo.ts:306-359`). Must it be scrubbed when the payment row is retained? |
| Q6 | Does the WeChat Pay merchant agreement impose record-keeping/refund obligations that constrain deletion? |
| Q7 | Unused entitlements/credits at account deletion: refund, zero, or retain record? |
| Q8 | Approve the user-facing wording for retention ("依法保留、去标识化") for the §2 response template and ledger 留存范围. |
| Q9 | No-FK residue (runbook G6): `admin_audit_logs` before-snapshots include displayName/phoneNumber; `matching_results.user_ids`; icebreaker host fields — retain as-is, anonymize, or separate decision? |
| Q10 | If any production deletion has already run (ledger §7 audit — **待验证**, assumed none pre-production), what remediation/notification stance? |

---

## 5. Decision owner + sign-off

**No production user deletion with payment history may proceed until Legal signs below.**

| Role | Must confirm | Name | Date | Signature |
|---|---|---|---|---|
| **Legal (mandatory)** | Q1–Q10 answered; retention required or not; retention set + period; PIPL basis; payload scrub; approved disclosure wording | | | |
| **Product** | Response template wording + ledger 留存范围 disclosure; terms/privacy consistency (`joyjoinTermsZh.ts:137-148`); decision path for Option D at self-serve 注销 launch (runbook G1); unused-credits stance (with Legal) | | | |
| **Engineering** | Tier 2 Sprint Contract (migration safety, helper retention + SET NULL trap, route detach, in-flight refund edge, NULL-tolerant reads); contract + behavioral tests; re-run HS-11 drill | | | |

---

## 6. Follow-through checklist

- [ ] **Runbook §5.3** — replace the decision-required block with the Legal ruling, retention set, and interim rule; update §5.1 periods after Legal; update §5.2 after the fix lands.
- [ ] **Terms/privacy consistency** — the 15-working-day promise (`joyjoinTermsZh.ts:139`), storage clause (`:144-148`), §2 acknowledgment template, and ledger 留存范围 (`§7`) must all agree that lawful retention is de-identified and storage-only. Legal-approved wording only.
- [ ] **Engineering ticket** (Tier 2) — schema + helper + route + tests per §3; link `fkCascadeDeleteContract.test.ts`; flag G4 behavioral test.
- [ ] **HS-11 drill implications** — expectations change: post-delete `payments` count > 0 with `NULL user_id`; add that assertion to §6; HS-11 remains FAIL until Legal sign-off + updated drill passes (`LAUNCH-QA-HARD-STOP-VERIFICATION.md`).
- [ ] **Ops** — audit the deletion ledger (§7) for any real production deletions already executed (**待验证**); if none, record baseline.
- [ ] **G6 residue** — bundle into Legal's answer (Q9) or explicitly defer with a dated note in the runbook.

---

**Related:** [`account-deletion.md`](../runbooks/account-deletion.md) · HS-11 in [`LAUNCH-QA-HARD-STOP-VERIFICATION.md`](../testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md) · `apps/server/src/__tests__/fkCascadeDeleteContract.test.ts` · [`launch-risks.md`](../product/launch-risks.md)
