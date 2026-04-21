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
| `/admin/venues` | CRUD venues | GET/POST/PATCH/DELETE | `/api/admin/venues*` | `requireAdmin` |
| `/admin/venues` | Time slots | GET/POST/PATCH/DELETE | `/api/admin/time-slots*` | `requireAdmin` |
| `/admin/subscriptions` | List/create/update | GET/POST/PATCH | `/api/admin/subscriptions*` | `requireAdmin` |
| `/admin/coupons` | Coupon management | GET/POST/PATCH | `/api/admin/coupons*` | `requireAdmin` |

---

## Analytics & Matching Lab

| Admin Page | Action | Method | Endpoint | Required Middleware |
|------------|--------|--------|----------|---------------------|
| `/admin/data-insights` | Insights | GET | `/api/admin/insights*` | `requireAdmin` |
| `/admin/feedback` | Feedback list/stats | GET | `/api/admin/feedback*` | `requireAdmin` |
| `/admin/matching-lab` | Thresholds | GET/PUT | `/api/admin/matching-thresholds` | `requireAdmin` |
| `/admin/matching-lab` | Matching logs | GET | `/api/admin/matching-logs` | `requireAdmin` |
| `/admin/matching-lab` | Manual pool scan | POST | `/api/admin/pools/:id/scan` | `requireAdmin` |
| `/admin/kpi` | KPI dashboard | GET | `/api/admin/kpi/dashboard` | `requireAdmin` |
| `/admin/interaction-logs` | Interaction logs | GET | `/api/admin/interaction-logs*` | `requireAdmin` |

---

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
