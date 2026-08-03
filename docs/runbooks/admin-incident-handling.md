# Admin Portal — Incident Handling Runbook

**Audience:** JoyJoin internal support staff and on-call engineers  
**Environment:** Internal beta (`admin.joyjoinapp.com`)  
**Last updated:** 2026-06-30

---

## Table of Contents

1. [Common Operational Tasks](#1-common-operational-tasks)
2. [Incident Triage](#2-incident-triage)
3. [Internal Beta Daily Checklist](#3-internal-beta-daily-checklist)
4. [Escalation Paths](#4-escalation-paths)

---

## 1. Common Operational Tasks

### 1.1 Admin Login / Account Handling

**Login:**
1. Navigate to `https://admin.joyjoinapp.com`
2. Enter admin username and password.
3. On success the session cookie is set and you are redirected to the dashboard.

**Session issues:** Admin sessions are stored in PostgreSQL and normally survive server restarts. Sessions can drop if the session has expired, cookies were cleared/blocked, or the database is temporarily unavailable. In most cases, log out and log in again; if this keeps happening, check database status and browser cookie settings.

**Admin logout:**
```
POST /api/admin/logout
```
Requires an active admin session with `operator` or `super_admin` role. The endpoint destroys the session and clears the session cookie.

**Forgot password / reset:**
- Only a `super_admin` can reset another admin's password.
- In the admin portal: **Admin Accounts → ⋮ → Reset Password**.
- API: `POST /api/admin/accounts/:id/reset-password` with `{ "newPassword": "<pwd>" }` (must be at least 8 characters).
- The reset is audit-logged (`ADMIN_PASSWORD_RESET`); the new password itself is **not** logged.

**Create a new admin account:**
```
POST /api/admin/accounts
{ "username": "ops1", "password": "…", "role": "operator", "displayName": "…" }
```
Requires `super_admin` session. Valid roles: `super_admin`, `operator`, `viewer`.

**Disable a compromised account:**
```
PATCH /api/admin/accounts/:id
{ "status": "disabled" }
```
The account is immediately blocked; active sessions are invalidated on the next request.

---

### 1.2 Manual Attendance Override

Attendance overrides are used when a user's self-reported pre-attendance status is incorrect (e.g., they forgot to check in).

1. In the admin portal, navigate to the event and open the **Attendance** tab.
2. Use the status dropdown next to the user's name.

**API equivalent (used by the current admin client):**
```
PATCH /api/admin/blind-box-events/:eventId/attendees/:userId/attendance
{ "status": "confirmed" }   // or "late", "absent", "pending"
```

All overrides are audit-logged (`ATTENDANCE_OVERRIDE`) with `eventId`, `userId`, and `newStatus`.

**Files:**
- Active admin UI route: `apps/admin-client/src/components/AttendanceSummaryTab.tsx`
- Blind-box override handler: `apps/server/src/routes.ts` → `PATCH /api/admin/blind-box-events/:eventId/attendees/:userId/attendance`
- Legacy/general attendance helper: `apps/server/src/storage.ts` → `adminOverrideAttendanceStatus()`

---

### 1.3 Adjusting User Points (XP / JoyCoins)

> **Note:** `adminAdjustPoints()` exists in `apps/server/src/gamificationService.ts` but is not yet exposed via a UI or dedicated HTTP route. It can be called programmatically or via an internal script.

When a route or UI action exists:
```
// Example future route (not yet wired):
POST /api/admin/users/:id/adjust-points
{ "xpAdjustment": 100, "coinsAdjustment": 10, "reason": "beta tester bonus" }
```

All point adjustments are audit-logged (`ADMIN_POINTS_ADJUSTED`) with before/after state.

---

### 1.4 Issuing / Broadcasting Notifications

1. In the admin portal: **Notifications → New Broadcast**.
2. Fill in title, body, and target audience.

**API:**
```
POST /api/admin/notifications/broadcast
{ "title": "…", "body": "…", "targetAudience": "all" }
```

**Send to a single user:**
```
POST /api/admin/notifications/send
{ "userId": "…", "title": "…", "body": "…" }
```

---

### 1.5 Banning / Unbanning a User

1. Navigate to **Users → [User] → Ban** in the admin portal.
2. Confirm the action.

**API:**
```
PATCH /api/admin/users/:id/ban
PATCH /api/admin/users/:id/unban
```

Both actions are audit-logged (`USER_BANNED` / `USER_UNBANNED`) with before/after `isBanned` state.

---

### 1.6 Payment Refunds

1. Navigate to **Finance → Payments → [Payment] → Refund**.
2. Provide a reason.

**API:**
```
POST /api/admin/payments/:paymentId/refund
{ "reason": "duplicate charge" }
```

Refunds are audit-logged (`PAYMENT_REFUND_INITIATED`) with `paymentId` and `reason`.

### 1.7 Deleting / Suspending a Venue

The admin portal **Delete** action on `/admin/venues` does not hard-delete the record. Instead, the venue is suspended:

**API:**
```
DELETE /api/admin/venues/:id
```

**Behavior:**
- Sets `onboardingStatus` to `suspended`.
- Sets `partnerStatus` to `paused`.
- Sets `isActive` to `false`.
- Returns `200` JSON with the updated venue.
- Audit action is `VENUE_UPDATED` (not `VENUE_DELETED`).

The venue will no longer appear as available for new events, but historical references and past event data remain intact.

---

## 2. Incident Triage

### 2.1 Admin UI Fails to Load

**Symptoms:** Browser shows blank page or network error at `admin.joyjoinapp.com`.

**Checklist:**
1. Check that the **admin-client** build is deployed (`apps/admin-client/dist/`).
2. Verify the Nginx reverse proxy is routing `admin.joyjoinapp.com` correctly (separate deployment from the user client).
3. Check server liveness: `GET /api/health` should return `200`. If the symptom looks DB/session-related, check `GET /api/readyz` too; a `503` there points to dependency/config failure while the process is still up.
4. Check browser console for CORS or 5xx errors.
5. Verify the session store (PostgreSQL connect-pg-simple) is reachable — a DB outage will break session reads.

**Files:**
- `apps/admin-client/` — frontend build
- `apps/server/src/routes.ts` — backend API
- Server session setup: `apps/server/src/routes.ts` near `connectPg`

---

### 2.2 Missing Audit Logs

**Symptoms:** Expected `[AdminAudit]` lines are absent from server stdout.

**Checklist:**
1. Confirm the action was actually performed (check DB state).
2. Verify the server logs are captured — stdout must not be redirected to `/dev/null`.
3. Check that `logAdminAudit()` is called in the relevant handler:
   - Admin login: `apps/server/src/adminAuth.ts` → `POST /api/admin/login`
   - Account changes: `adminAuth.ts` → `POST/PATCH /api/admin/accounts*`
   - Ban/unban: `apps/server/src/routes.ts` → `PATCH /api/admin/users/:id/ban|unban`
   - Attendance override: `apps/server/src/storage.ts` → `adminOverrideAttendanceStatus()`
   - Refund: `apps/server/src/routes.ts` → `POST /api/admin/payments/:paymentId/refund`
4. Search logs by prefix: `grep '\[AdminAudit\]' <logfile>` or equivalent in your log aggregator.
5. Each record includes an `auditId` UUID for cross-reference.

**Module:** `apps/server/src/lib/adminAuditLogger.ts`

---

### 2.3 RBAC Failures / 403 Errors

**Symptoms:** Admin receives `403 Forbidden` when accessing an endpoint they should be allowed to use.

**Checklist:**
1. Verify the admin's role in the `admin_accounts` table.
2. Check whether the route requires `requireSuperAdmin` — only `super_admin` may access account-management routes.
3. Check session validity: call `GET /api/admin/me` and inspect the returned role.
4. If the account's `status` is `disabled`, all requests will be blocked by `requireAdmin`.
5. Run the RBAC coverage test to verify no unexpected middleware has been removed:
   ```bash
   npm test -w @joyjoin/server -- src/__tests__/adminRbacCoverage.test.ts
   ```
6. Refer to `docs/admin/admin-rbac-matrix.md` for the full role requirement per endpoint.
7. The admin client globally redirects to `/admin/login` on `401`/`403` responses for any `/admin/*` route (handled by `apps/admin-client/src/lib/queryClient.ts`).

---

### 2.4 Admin Login / Session Issues

**Symptoms:** Login fails with valid credentials, or session is lost unexpectedly.

**Checklist:**
1. Check `admin_accounts` table: username must exist, `status = 'active'`, and `passwordHash` must be a valid bcrypt hash.
2. Password must be ≥ 8 characters.
3. Session store: PostgreSQL session table must be accessible. A DB restart may clear sessions.
4. Cookie domain: sessions are shared across `*.joyjoinapp.com` (see `cookieDomain` in `apps/server/src/routes.ts`). Ensure browser is not blocking cross-subdomain cookies.
5. If logging in from a new device, check for any IP restrictions (none currently, but note for future).

**First-time setup — create initial super_admin:**
Use the server-side script or direct DB insert (hashed password via bcrypt):
```sql
INSERT INTO admin_accounts (id, username, password_hash, role, display_name, status)
VALUES (gen_random_uuid(), 'admin', '<bcrypt-hash>', 'super_admin', 'Admin', 'active');
```

---

### 2.5 Matching Algorithm Produces No Groups

**Symptoms:** Running pool matching returns empty groups.

**Checklist:**
1. Verify registered users pass hard constraints (budget, gender, industry, education).
2. Check that `user_interests` table has data for the registered users.
3. Pair scores need `avgScore ≥ 60` for a user to be added to a group.
4. Check `minGroupSize` (default 4) — if fewer than 4 users are eligible, no group is formed.
5. Review matching logs: `GET /api/admin/matching-logs`.
6. Use the Matching Lab: `/admin/matching-lab` → adjust thresholds if needed.

---

## 3. Internal Beta Daily Checklist

Run this checklist each day during internal beta.

### Morning (09:00)

- [ ] Verify server is running: `GET /api/health` returns `200`
- [ ] Check error logs for any `500` responses or unhandled exceptions
- [ ] Confirm `[AdminAudit]` entries are appearing for any actions taken the previous day
- [ ] Review any new user reports in `/admin/moderation` (用户举报)
- [ ] Check scheduled events for the day in `/admin/events` (活动管理)

### Before Events

- [ ] Confirm event pool matching has been run and groups are assigned
- [ ] Verify venue booking is confirmed
- [ ] Check attendee count and pre-attendance responses in `/admin/events → Attendance`
- [ ] Confirm notification broadcast was sent to participants

### After Events

- [ ] Override any missing attendance statuses (users who attended but did not self-report)
- [ ] Review event feedback in `/admin/feedback` (反馈管理)
- [ ] Check for any chat reports from the event in `/admin/reports` (聊天举报)

### Weekly

- [ ] Review admin account list for any accounts that should be disabled
- [ ] Review data insights: `/admin/insights` (数据洞察)
- [ ] Check abuse detection state (currently in-memory; resets on server restart — see `docs/product/launch-risks.md`)

---

## 4. Escalation Paths

| Issue | First Contact | Escalation |
|-------|--------------|------------|
| Server down / 5xx errors | On-call engineer | Engineering lead |
| Data integrity issue | Engineering lead | CTO |
| Security incident (unauthorized access, data exposure) | Engineering lead | CTO + Legal |
| Payment / refund dispute | Operations | Finance lead |
| Admin account compromise | Engineering lead | CTO (disable account immediately) |

**Emergency admin account disable (if portal is inaccessible):**
```sql
UPDATE admin_accounts SET status = 'disabled' WHERE username = '<compromised>';
```

---

## 5. Open beta (self-serve) additions

- **Untrusted users:** Prefer disabling or tightly scoping `viewer` accounts; mutating admin APIs require operator or above (see [`product/open-beta-wider.md`](../product/open-beta-wider.md)).
- **Single replica:** If the cohort runs on **one** Node process, document that restarts reset in-memory rate limits and abuse soft counters (`docs/product/launch-risks.md` R-01/R-02); bans and DB-backed state still apply. Do **not** scale to multiple replicas without Redis/shared limits (see [`open-beta-single-replica.md`](./open-beta-single-replica.md)).
- **Payments:** Payment incidents follow Finance escalation above; verify `PAYMENTS_ENABLED` and WeChat Pay env per [`product/LAUNCH_CONFIG.md`](../product/LAUNCH_CONFIG.md).
- **Emergency auth:** See [`emergency-auth-surfaces.md`](./emergency-auth-surfaces.md) for debug flags and CLI bypass policy.

---

*For RBAC role definitions and endpoint permissions, see [`docs/admin/admin-rbac-matrix.md`](../admin/admin-rbac-matrix.md).*  
*For known MVP limitations, see [`docs/product/launch-risks.md`](../product/launch-risks.md).*
