# Account deletion (注销) — manual channel runbook v1

> **Status:** v1 — manual channel. No self-serve deletion UI/route exists (verified 2026-10-06).
> **Satisfies:** HS-11 in `docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`.
> **Audience:** ops (executor), product (intake/template), legal (retention), @backend-engineer (escalation).
> **Evidence convention:** `<EV> = .git/.orchestration/launch-qa/<drill-date>/` (HS-11 uses `2026-10-06`).

---

## 1. Purpose and scope

- This runbook is the v1 manual deletion channel for user account-deletion requests.
- Commitment source: `packages/shared/src/legal/joyjoinTermsZh.ts:139-140` — users contact the developer via `support@joyjoinapp.com`; the developer completes verification and processing within **15 working days** after accepting the request (受理).
- **In scope:** mini-program user accounts (non-admin).
- **Out of scope:** admin accounts. The delete route rejects `user.isAdmin` with HTTP 400 (`apps/server/src/routes/domains/adminUsers.ts:974-976`); admin account lifecycle uses its dedicated super-admin flows (see HS-12 step 2 / R-05).
- **Only deletion surface today:** admin `DELETE /api/admin/users/:id/data` (`adminUsers.ts:963`, operator/super_admin). No user-facing 注销 route or UI exists (verified 2026-10-06: no `注销`/`deleteAccount`/`account/delete` matches in mini-program or server sources).

## 2. Intake

- **Entry:** `support@joyjoinapp.com` (matches terms line 140). The terms also expose WeChat's platform channel "小程序已获取的信息 → 通知开发者删除" (line 137); route both to the same ledger.
- **Request must contain (minimum):**
  - explicit request: 申请注销账号
  - account identifiers for matching: registered phone number (if set), WeChat nickname, display name
  - a contact back-channel
  - confirmation that the requester understands the account data will be deleted
- **Response template** (acknowledgement + SLA) — *[待产品/ops 确认: wording not yet agreed]:*

  > 您好，我们已收到您的账号注销申请。我们将在核验您的身份后正式受理，并承诺在十五个工作日内完成核查和处理。如需补充信息，我们会通过本邮箱与您联系。— 悦聚团队

- **SLA clock:** 15 working days from acceptance (受理), i.e. from identity verification — not from the first email. Record 申请日 and SLA 计时 in the ledger (§7).
- *[待ops 确认: inbox ownership, monitoring cadence, first-response target, and whether the WeChat channel is live.]*

## 3. Identity verification

- **No deletion without verification.** Cross-check the requester against admin-visible identity fields — the admin DTO exposes `phoneNumber`, `wechatNickname`, `displayName`, `email` (`adminUsers.ts:124-140`).
- Repo facts: accounts are WeChat-login-first (`wechatOpenId`, `packages/shared/src/schema/_definitions.ts:101`); `phoneNumber` is optional but unique when set (`_definitions.ts:97`).
- Accepted proof method — *[待ops 确认: not defined in repo].* Candidate methods to agree on (choose one, record in ledger 核验方式):
  - requester states the registered phone number, and ops confirms control of that number via an agreed callback/challenge;
  - confirmation through the account's registered WeChat identity;
  - another ops-approved method with evidence logged.
- Never store ID documents or secrets in the ledger. If verification fails: **no deletion**; reply with the failure reason; ledger row with 备注=核验失败.

## 4. Deletion procedure

Run on **staging first** (drill). Production use requires the retention decision in §5.3 to be recorded.

### 4.1 Locate and confirm the account

Admin UI: 用户管理 → open the user row → confirm `isAdmin=false` plus identity fields.

API alternative (staging admin host: `https://staging.admin.joyjoinapp.com`; requires an operator/super_admin session — viewer gets 403, `apps/server/src/adminAuth.ts:173-179`; the UI hides the button for viewers, `apps/admin-client/src/pages/admin/AdminUsersPage.tsx:66`):

```bash
curl -sS https://staging.admin.joyjoinapp.com/api/admin/users/<uid> \
  -b <EV>/staging-admin-cookie.txt \
  | jq '{id, phoneNumber, wechatNickname, displayName, isAdmin}'
```

### 4.2 Record pre-state (evidence)

```bash
docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "
SELECT
  (SELECT count(*) FROM event_pool_registrations WHERE user_id = '<uid>') AS registrations,
  (SELECT count(*) FROM payments               WHERE user_id = '<uid>') AS payments,
  (SELECT count(*) FROM sessions               WHERE sess->>'userId' = '<uid>') AS sessions;"
```

(Production equivalent: `docker exec postgres psql -U joyjoin -d joyjoin -c "…"`.)

**Retention note (Option B, 2026-10-09):** `payments` rows are retained de-identified (`user_id → NULL`, payload scrubbed). Capture their IDs now for the §6 retained-check: `SELECT id FROM payments WHERE user_id = '<uid>';`

### 4.3 Execute

Admin UI: user detail → 删除用户数据 (`AdminUserDetailSheet.tsx:336-345`). Or:

```bash
curl -sS -D- -X DELETE https://staging.admin.joyjoinapp.com/api/admin/users/<uid>/data \
  -b <EV>/staging-admin-cookie.txt | tee <EV>/HS-11-deletion-drill.log
```

Expected: HTTP 200, body `{"message":"User data deleted successfully"}`.

Server behavior, in one transaction (`adminUsers.ts:963-1050`):

1. host recovery — reassign/tombstone hosted icebreaker sessions (`reassignOrTombstoneHostedSessions`, `apps/server/src/lib/socialIcebreakerStore.ts:410`);
2. **pending-refund guard (fail-closed):** if any `refund_attempts` for the user's payments is `status='pending'`, the request aborts with HTTP 409 + code `PENDING_REFUND_IN_PROGRESS` — retry after the refund attempt resolves (`adminUsers.ts:1005-1019`, error mapping :1067-1072);
3. **retained-financial detach:** `UPDATE payments SET user_id = NULL, event_registration_payload = NULL WHERE user_id = $userId` (`adminUsers.ts:1024-1029`);
4. explicit deletes for the three no-DB-FK user columns;
5. `cascadeDeleteByIds(tx, "users", "id", [userId], { retain: RETAINED_USER_TABLES })` — `payments` (+ its `refund_attempts` children) survive (`apps/server/src/lib/fkCascadeDelete.ts`);
6. audit action `USER_DATA_DELETED` into `admin_audit_logs` (context includes `retainedTables` + detached count).

#### Manual pre-delete of drizzle-only FKs — verified verdict (2026-10-06)

**The route already covers every known drizzle-only user column. Operators must NOT run extra pre-deletes:**

- Manual deletes inside the route: `social_icebreaker_participants.user_id`, `social_icebreaker_lie_truths.user_id`, `industry_ai_logs.user_id` (`adminUsers.ts:994-996`; no-FK confirmed: `_definitions_social.ts:50,75`, `_definitions_extended.ts:1179`).
- `event_attendance.user_id` HAS a DB FK (`_definitions.ts:372`) → the cascade handles it. Manually deleting `event_attendance` by `user_id` is locked out by contract test (`fkCascadeDeleteContract.test.ts:57`).
- `event_attendance.blind_box_event_id` is drizzle-only (`_definitions.ts:371`) but references `blind_box_events`, not `users` — it needs explicit cleanup only when deleting blind-box events (`singleTestService.ts:856-867`), NOT for user deletion.
- `social_icebreaker_sessions.host_user_id` is no-FK (`_definitions_social.ts:20`) but is handled by host recovery and never hard-deleted (contract test line 54; tombstoned rows are kept for history).
- If the route returns 500 / `23503`: **stop**, capture `docker logs`, escalate to @backend-engineer. Do not improvise deletes.

### 4.4 Sessions — shipped (HS-12, 2026-10-06)

- The delete route calls `revokeUserSessions(userId, tx)` as the first transaction statement (`adminUsers.ts:984`); sessions are purged automatically. No manual fallback needed.
- Re-check `sessions = 0` before closing the request (§6).

## 5. Retention boundaries

### 5.1 Intended policy (launch QA intent) — period 待legal 确认

| Data class | Table(s) | Intended | Retention period |
|---|---|---|---|
| Payment/order + refund history | `payments`, `refund_attempts` | Retain (financial/legal) | **待legal 确认** (placeholder) |
| Admin audit logs | `admin_audit_logs` | Retain (accountability) | **待legal 确认** |
| Content-safety records | `reports`, `chat_reports` | 待legal/安全 确认 (repeat-offender tracking) | **待legal 确认** |

> **Legal decision — 待legal 确认.** Agreed retention period and carve-outs go here before production use: `<retention period TBD>`.

### 5.2 Current behavior — Option B implemented (2026-10-09; production use gated by §5.3)

- **Retained (de-identified):** `payments` (`user_id = NULL`, `event_registration_payload = NULL`) and its `refund_attempts` children. Migration `0096_payments_user_id_retention.sql` makes the link nullable with `ON DELETE SET NULL`. Implementation: `adminUsers.ts` detach step + `cascadeDeleteByIds` retain config; decision memo `docs/design/account-deletion-retention-decision-20261006.md`; legal context `docs/design/account-deletion-retention-legal-context-20261009.md`.
- **Deleted by the cascade:** registrations, `coupon_usage`, `subscriptions`, `event_credit_*`, `user_coupons`, FK-backed report rows, and all other user-owned data.
- **NOT deleted:** `admin_audit_logs` (no FK; rows retain `target_entity_id` plus a before-snapshot including the user's displayName/phoneNumber); `social_icebreaker_sessions` history rows; `matching_results.user_ids` text array (no FK).
- **DB-true smoke:** `npm run smoke:account-deletion-retention -w @joyjoin/server` asserts user-gone / payment retained NULL / refund_attempts retained / payload NULL / non-financial child deleted (self-cleaning).

### 5.3 Decision status — ✅ SIGNED (2026-10-12)

1. **Implemented:** Option B (retain + detach + scrub) is in code as of 2026-10-09.
2. **Legal sign-off: RECORDED 2026-10-12** — Vincent Lai (owner, as Legal authority) approved Option B per the "签署裁定" in `docs/design/account-deletion-retention-signoff-form-20261012.md` (retention default: 3 years from payment success; set = `payments` + `refund_attempts`; ledger 3 years; destruction per "未了事项不得销毁"). **The §5.3 production pause for users with payment history is lifted**, subject to: migration 0096 applied to the target DB + the HS-11 staging drill passing.

## 6. Post-delete verification

```bash
docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "
SELECT
  (SELECT count(*) FROM users                          WHERE id = '<uid>') AS users_left,
  (SELECT count(*) FROM sessions                       WHERE sess->>'userId' = '<uid>') AS sessions_left,
  (SELECT count(*) FROM social_icebreaker_participants WHERE user_id = '<uid>') AS icebreaker_rows_left,
  (SELECT count(*) FROM admin_audit_logs               WHERE action = 'USER_DATA_DELETED' AND target_entity_id = '<uid>') AS audit_entries;"
```

Expected: `users_left=0`; `sessions_left=0`; `icebreaker_rows_left=0`; `audit_entries=1`. Retained-financial check (Option B) — using the payment IDs captured in §4.2:

```bash
docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c \
  "SELECT count(*) AS payments_retained, count(*) FILTER (WHERE user_id IS NULL) AS detached, count(*) FILTER (WHERE event_registration_payload IS NULL) AS payload_scrubbed FROM payments WHERE id IN ('<id1>','<id2>');"
```

Expected: `payments_retained` = pre-state count, `detached` = `payments_retained`, `payload_scrubbed` = `payments_retained`; `refund_attempts` for those payment IDs unchanged.

```bash
docker logs joyjoin-api-staging --since 10m 2>&1 | grep -c '23503'   # expected: 0
```

Residual-credential check (expect **401**) — the session store backs both the cookie and `X-Session-Token` (`revokeUserSessions.ts:5-8`; mini-program sends `X-Session-Token`, `apps/mini-program/src/lib/api/api.ts:152-165`):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://staging.joyjoinapp.com/api/auth/user \
  -H "X-Session-Token: <captured-token>" | tee <EV>/HS-11-post-delete-auth.txt
```

*[待ops 确认: capture method for the test user's token at drill setup (use the test user's own login credential).]*

## 7. Ledger (append one row per request)

| 申请日 | 申请人标识 | 核验方式 | 执行人 | 删除范围 | 留存范围 | 完成日 | SLA 计时 | 备注 |
|---|---|---|---|---|---|---|---|---|
| | phone 138**** / wx nick | e.g. 电话回呼核验 | ops name | 用户数据级联 | admin 审计日志等（见 §5） | | T+N/15 工作日 | |

Rules: SLA = 15 working days from verified acceptance; 完成日 only when §6 fully passes; any retention carve-out must be listed in 留存范围 and disclosed to the user.

## 8. HS-11 staging drill checklist

Preconditions: staging admin operator/super_admin session; one test user (non-admin) with ≥2 sessions; `<EV>` created.

- [ ] `mkdir -p .git/.orchestration/launch-qa/2026-10-06` (or the drill date).
- [ ] Runbook exists: `ls docs/runbooks/ | grep -iE '注销|account|deletion' | tee <EV>/HS-11-runbook-exists.log` — non-empty.
- [ ] Local guard: `npm run test -w @joyjoin/server -- fkCascadeDeleteContract` — pass.
- [ ] Test user logs in twice (≥2 `sessions` rows); capture the session credential.
- [ ] §4.1: identity fields confirmed; `isAdmin=false`.
- [ ] §4.2: pre-state counts recorded in `<EV>/HS-11-deletion-drill.log`.
- [ ] §4.3: execute; HTTP 200 captured.
- [ ] §4.4: `sessions=0` (route calls `revokeUserSessions`; no fallback needed).
- [ ] §6: all checks pass; retained-financial check shows payments with `user_id NULL` + payload NULL; `<EV>/HS-11-post-delete-auth.txt` shows 401.
- [ ] Ledger row written to `<EV>/HS-11-ledger-entry.md`.
- [ ] HS-11 result row updated in `docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`.

> **Deferred re-drill note (Option B):** the HS-11 re-drill with the updated §4.2/§6 expectations is owned by QA/ops; the code contract ships code + docs only.

## 9. Known gaps / follow-ups

- **G1 — self-serve 注销 route/UI (post-launch):** until shipped, the terms (`joyjoinTermsZh.ts:137-140`) must stay aligned with this manual channel (HS-11 step 6 consistency check).
- **G2 — HS-12 dependency:** wire `revokeUserSessions` into delete-data + tests; remove the §4.4 fallback when done.
- **G3 — legal retention sign-off** and the financial-cascade conflict (§5.3).
- **G4 — no behavioral test** for `DELETE /api/admin/users/:id/data` (only the source-level contract test). Narrowest addition: one integration test covering operator success + viewer 403 + session purge; the HS-11 drill remains the E2E evidence.
- **G5 — R-05 admin-account session hygiene** (HS-12 step 2); this runbook covers user accounts only.
- **G6 — no-FK residue not covered by design:** `matching_results.user_ids` and retained icebreaker-session host fields; legal to decide if anonymization is required.

---

Related: HS-11 in `docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`; `apps/server/src/__tests__/fkCascadeDeleteContract.test.ts`; `apps/server/src/lib/socialIcebreakerStore.ts` (host recovery).
