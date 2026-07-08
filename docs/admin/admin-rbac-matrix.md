# Admin RBAC Matrix

Reference for which admin portal pages map to which API endpoints and which role is required.

## Role Hierarchy

| Role | Description |
|------|-------------|
| `super_admin` | Full access, including account management |
| `operator` | Operational access: events, users, content, moderation, finance read |
| `viewer` | Read-only: mutating `/api/admin/*` routes require `requireOperatorOrAbove` (or `requireSuperAdmin`) after `requireAdmin`; GETs may remain `requireAdmin` only. Guardrail: `apps/server/src/__tests__/adminRbacCoverage.test.ts`. |

> **Middleware:** `requireAdmin` validates an active admin session. `requireSuperAdmin` additionally asserts `role === 'super_admin'`. `requireOperatorOrAbove` asserts `role` is `super_admin` or `operator`.

---

## Authentication & Session

| Action | Method | Endpoint | Required Middleware | Notes |
|--------|--------|----------|---------------------|-------|
| Admin login | POST | `/api/admin/login` | *(public)* | Only public admin endpoint |
| Get current admin | GET | `/api/admin/me` | `requireAdmin` | Returns own profile |
| Admin logout | POST | `/api/admin/logout` | `requireAdmin` + `requireOperatorOrAbove` | Destroys session and clears cookie |

---

## Admin Account Management *(super_admin only)*

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/accounts` | List accounts | GET | `/api/admin/accounts` | `requireAdmin` + `requireSuperAdmin` |
| `/admin/accounts` | Create account | POST | `/api/admin/accounts` | `requireAdmin` + `requireSuperAdmin` |
| `/admin/accounts` | Update account (role/status/name) | PATCH | `/api/admin/accounts/:id` | `requireAdmin` + `requireSuperAdmin` |
| `/admin/accounts` | Reset password | POST | `/api/admin/accounts/:id/reset-password` | `requireAdmin` + `requireSuperAdmin` |

---

## User Management

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/users` | List users | GET | `/api/admin/users` | `requireAdmin` |
| `/admin/users` | Get user | GET | `/api/admin/users/:id` | `requireAdmin` |
| `/admin/users` | Get user detail | GET | `/api/admin/users/:id/detail` | `requireAdmin` |
| `/admin/users` | Ban user | PATCH | `/api/admin/users/:id/ban` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/users` | Unban user | PATCH | `/api/admin/users/:id/unban` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/users` | Delete all user data | DELETE | `/api/admin/users/:id/data` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/stats` | Platform stats | GET | `/api/admin/stats` | `requireAdmin` |

> Ban/unban are moderation writes and require operator or above on the API.

---

## Events

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/events` | List events | GET | `/api/admin/events` | `requireAdmin` |
| `/admin/events` | Get event | GET | `/api/admin/events/:id` | `requireAdmin` |
| `/admin/events` | Update event | PATCH | `/api/admin/events/:id` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/events` | List event pools | GET | `/api/admin/event-pools` | `requireAdmin` |
| `/admin/events` | Create event pool | POST | `/api/admin/event-pools` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/events` | Update event pool | PATCH | `/api/admin/event-pools/:id` | `requireAdmin` |
| `/admin/events` | Pool registrations | GET | `/api/admin/event-pools/:id/registrations` | `requireAdmin` |
| `/admin/events` | Pool groups | GET | `/api/admin/event-pools/:id/groups` | `requireAdmin` |
| `/admin/events` | Run matching | POST | `/api/admin/event-pools/:id/match` | `requireAdmin` |
| `/admin/events` | Attendance summary | GET | `/api/admin/blind-box-events/:eventId/attendance-summary` | `requireAdmin` |
| `/admin/events` | Chase attendees | POST | `/api/admin/blind-box-events/:eventId/chase-attendees` | `requireAdmin` |
| `/admin/events` | Override attendance ⚠️ | PATCH | `/api/admin/blind-box-events/:eventId/attendees/:userId/attendance` | `requireAdmin` |

> Note: `apps/server/src/routes.ts` also retains older `/api/admin/events/:eventId/attendance-summary` and `/api/admin/events/:eventId/attendees/:userId/attendance-status` variants. The matrix above lists the routes currently used by `apps/admin-client/src/components/AttendanceSummaryTab.tsx`.

---

## Finance

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/finance` | Finance stats | GET | `/api/admin/finance/stats` | `requireAdmin` |
| `/admin/finance` | Payments list | GET | `/api/admin/payments` | `requireAdmin` |
| `/admin/finance` | Create refund ⚠️ | POST | `/api/admin/payments/:paymentId/refund` | `requireAdmin` |
| `/admin/finance` | Venue commissions | GET | `/api/admin/finance/commissions` | `requireAdmin` |

---

## Moderation & Content

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/moderation` | Moderation stats | GET | `/api/admin/moderation/stats` | `requireAdmin` |
| `/admin/moderation` | Reports list | GET | `/api/admin/moderation/reports` | `requireAdmin` |
| `/admin/moderation` | Update report | PATCH | `/api/admin/moderation/reports/:id` | `requireAdmin` |
| `/admin/moderation` | Create moderation log | POST | `/api/admin/moderation/logs` | `requireAdmin` |
| `/admin/moderation` | Get moderation logs | GET | `/api/admin/moderation/logs` | `requireAdmin` |
| `/admin/content` | List contents | GET | `/api/admin/contents` | `requireAdmin` |
| `/admin/content` | Create content | POST | `/api/admin/contents` | `requireAdmin` |
| `/admin/content` | Update content | PATCH | `/api/admin/contents/:id` | `requireAdmin` |
| `/admin/content` | Delete content | DELETE | `/api/admin/contents/:id` | `requireAdmin` |
| `/admin/content` | Publish content | POST | `/api/admin/contents/:id/publish` | `requireAdmin` |
| `/admin/notifications` | List notifications | GET | `/api/admin/notifications` | `requireAdmin` |
| `/admin/notifications` | Broadcast ⚠️ | POST | `/api/admin/notifications/broadcast` | `requireAdmin` |
| `/admin/notifications` | Send notification | POST | `/api/admin/notifications/send` | `requireAdmin` |

---

## Venues & Subscriptions

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/venues` | List venues | GET | `/api/admin/venues` | `requireAdmin` |
| `/admin/venues` | Create venue | POST | `/api/admin/venues` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Get venue detail | GET | `/api/admin/venues/:id` | `requireAdmin` |
| `/admin/venues` | Update venue | PATCH | `/api/admin/venues/:id` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Delete venue (soft-delete / suspend) | DELETE | `/api/admin/venues/:id` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Submit for review | POST | `/api/admin/venues/:id/submit-for-review` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Approve venue | POST | `/api/admin/venues/:id/approve` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Reject venue | POST | `/api/admin/venues/:id/reject` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | Suspend venue | POST | `/api/admin/venues/:id/suspend` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | List venue deals | GET | `/api/admin/venues/:id/deals` | `requireAdmin` |
| `/admin/venues` | Manage venue deals | POST/PATCH/DELETE | `/api/admin/venues/:id/deals*` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | List venue time slots | GET | `/api/admin/venues/:id/time-slots` | `requireAdmin` |
| `/admin/venues` | Manage venue time slots | POST/PATCH/DELETE | `/api/admin/venues/:id/time-slots*` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/venues` | All time slots (calendar) | GET | `/api/admin/time-slots/all` | `requireAdmin` |
| `/admin/subscriptions` | List/create/update | GET/POST/PATCH | `/api/admin/subscriptions*` | `requireAdmin` |
| `/admin/coupons` | Coupon management | GET/POST/PATCH | `/api/admin/coupons*` | `requireAdmin` |

> **Delete behavior:** `DELETE /api/admin/venues/:id` performs a soft-delete / suspend: it sets `onboardingStatus: suspended`, `partnerStatus: paused`, and `isActive: false`, then returns `200` JSON with the updated venue. The action is logged to `admin_audit_logs` as `VENUE_UPDATED`.
>
> **API contract:** Venue GET/POST/PATCH responses return camelCase keys (`type`, `isActive`, `onboardingStatus`, `maxConcurrentEvents`, `bookingCount`, `brandName`, etc.) mapped from the underlying PostgreSQL `snake_case` columns by `venuesRepo.ts`. Admin client pages should use `apiRequest` or the default React Query `queryFn` (both check `res.ok`) instead of raw `fetch(...).then(r => r.json())`.

---

## Matching Reviews

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/matching-reviews` | List review pools | GET | `/api/admin/matching-reviews/pools` | `requireAdmin` |
| `/admin/matching-reviews` | List pool groups | GET | `/api/admin/matching-reviews/pools/:id/groups` | `requireAdmin` |
| `/admin/matching-reviews` | Approve formed groups | POST | `/api/admin/matching-reviews/pools/:id/approve` | `requireAdmin` + `requireOperatorOrAbove` |
| `/admin/matching-reviews` | Reject formed groups | POST | `/api/admin/matching-reviews/pools/:id/reject` | `requireAdmin` + `requireOperatorOrAbove` |

> Approve/reject are operational writes and require operator or above. Both endpoints log to `admin_audit_logs` with action `MATCHING_REVIEW_APPROVED` or `MATCHING_REVIEW_REJECTED`.

---

## Analytics & Matching Lab

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/insights` | Insights | GET | `/api/admin/insights*` | `requireAdmin` |
| `/admin/feedback` | Feedback list/stats | GET | `/api/admin/feedback*` | `requireAdmin` |
| `/admin/matching` | Thresholds | GET/PUT | `/api/admin/matching-thresholds` | `requireAdmin` |
| `/admin/matching` | Manual pool scan | POST | `/api/admin/pools/:id/scan` | `requireAdmin` |
| `/admin/matching-logs` | Matching logs | GET | `/api/admin/matching-logs` | `requireAdmin` |
| `/admin/interaction-logs` | Interaction logs | GET | `/api/admin/interaction-logs*` | `requireAdmin` |
| `/admin/outcome-analytics` | Outcome analytics | GET | `/api/admin/outcome-analytics*` | `requireAdmin` |
| `/admin/icebreaker-ai-feedback` | Icebreaker AI feedback | GET | `/api/admin/icebreaker-ai-feedback*` | `requireAdmin` |
| `/admin/evolution` | Mascot evolution | GET/POST | `/api/admin/evolution*` | `requireAdmin` |

---

## Feature Flags *(super_admin only)*

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/feature-flags` | List all flags | GET | `/api/admin/feature-flags` | `requireAdmin` + `requireSuperAdmin` |
| `/admin/feature-flags` | Update flag value | PUT | `/api/admin/feature-flags/:key` | `requireAdmin` + `requireSuperAdmin` |

> Values are persisted in the `feature_flags` DB table with `updatedBy` audit. Env vars serve as fallback when no DB row exists.  
> PUT validates that `key` is one of the known flags in `FLAG_ENV_MAP` and that `value` is `"true"` or `"false"` (Zod `enum`). Only `super_admin` may mutate flags; all changes are logged to `admin_audit_logs` with action `FEATURE_FLAG_UPDATED`.

## Documented Exceptions

| Route | Exception Rationale |
|-------|---------------------|
| `POST /api/admin/login` | Public; no session exists yet. Credentials are validated with bcrypt before any session is established. |
| `GET /api/admin/me` | Returns the caller's own profile. Protected at `requireAdmin` level (not `requireSuperAdmin`) because all active admin roles need to read their own identity. |

---

## How to Verify Coverage Automatically

```bash
# Run the RBAC coverage audit test
npm test -w @joyjoin/server -- src/__tests__/adminRbacCoverage.test.ts
```

The test introspects the live Express route stack and asserts:
1. Every `/api/admin/*` route except `/api/admin/login` has `requireAdmin`.
2. Account-management routes (`/api/admin/accounts*`) also have `requireSuperAdmin`.
