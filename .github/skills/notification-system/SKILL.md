---
name: notification-system
description: >
  JoyJoin in-app notification system: DB-backed notification records, WebSocket broadcast fallbacks,
  admin broadcast/single-send endpoints, per-user unread counts by category, and mark-read semantics.
  Use when adding notification triggers, changing delivery patterns, or debugging why users don't
  see notifications. Triggers: notification, broadcast, mark-read, notification counts,
  createNotification, notificationsRepo, eventBroadcast, in-app notification, admin notification.
---

# Notification System

**Core rule:** Notifications are database-first. Every notification is persisted in the `notifications` table before (or alongside) any real-time delivery. WebSocket broadcasts are a best-effort enhancement, not the source of truth.

---

## When to use this skill

- Adding or changing a notification trigger (event status changes, matches, admin actions)
- Modifying the `notifications` table schema or `notificationsRepo` queries
- Adding or changing notification REST endpoints (`/api/notifications/*`, `/api/admin/notifications/*`)
- Changing notification category/type semantics or unread-count logic
- Debugging why a user does not see a notification badge or count
- Adding admin broadcast or single-send notification capabilities
- Working on notification fallback from WebSocket to in-app unread counts

## When NOT to use this skill

- WebSocket connection lifecycle or auth → use `websocket-realtime`
- Event pool matching logic → use `matching-domain`
- Social icebreaker phase state → use `social-icebreaker-domain`
- Push notification vendor integration (APNs, FCM) — not yet implemented in the active codebase
- SMS or WeChat template message delivery — not yet implemented in the active codebase

---

## Architecture Overview

```
Trigger (event status, match, admin action)
  │
  ├──► notificationsRepo.createNotification() ──► PostgreSQL (notifications table)
  │
  └──► wsService.broadcastToUser() / broadcastToEvent() ──► WebSocket (best-effort)
```

**Notification categories:** `discover`, `activities`, `chat`  
**Notification types (examples):** `event_reminder`, `system_alert`, `mutual_match`, `new_activity`, `matching_progress`, `match_success`, `new_message`, `admin_announcement`

**Key invariant:** Unread counts are computed from the database (`isRead = false`), not from WebSocket state. Clients poll `/api/notifications/counts` every 30 seconds as a fallback.

---

## Notification Lifecycle

1. **Trigger** — Business event occurs (event matched, status changed, admin broadcast)
2. **Persist** — `notificationsRepo.createNotification()` inserts a row with `isRead: false`
3. **Broadcast (optional)** — `eventBroadcast.ts` calls `wsService.broadcastToUser` or `broadcastToEvent` for real-time delivery
4. **Read** — Client calls `POST /api/notifications/mark-read` with a category; all unread rows in that category are updated to `isRead: true`
5. **Count refresh** — Client refetches `/api/notifications/counts` (manual invalidation or 30s poll)

---

## API Endpoints

### User endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/notifications/counts` | Phone | Unread counts per category + total |
| `POST` | `/api/notifications/mark-read` | Phone | Mark all notifications in a category as read |
| `POST` | `/api/notifications` | Phone | Create a notification for the authenticated user |

### Admin endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/notifications` | Admin | Notification history sent by this admin |
| `POST` | `/api/admin/notifications/broadcast` | Admin (Operator+) | Broadcast to multiple user IDs |
| `POST` | `/api/admin/notifications/send` | Admin (Operator+) | Send to a single user ID |
| `GET` | `/api/admin/notifications/:id/stats` | Admin | Recipient count and read count for a broadcast |

---

## Database Schema

```typescript
// packages/shared/src/schema.ts
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: varchar("category").notNull(),        // discover | activities | chat
  type: varchar("type").notNull(),                // event_reminder | system_alert | mutual_match | ...
  title: varchar("title").notNull(),
  message: text("message"),
  relatedResourceId: varchar("related_resource_id"), // eventId, chatId, etc.
  isRead: boolean("is_read").default(false),
  sentBy: varchar("sent_by").references(() => users.id), // admin sender
  isBroadcast: boolean("is_broadcast").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Count aggregation:** Grouped by `category` where `isRead = false`. Categories are hardcoded to `discover`, `activities`, `chat`.

---

## Event Broadcast Integration

`apps/server/src/eventBroadcast.ts` is the canonical trigger layer for event-related notifications:

- `broadcastEventStatusChanged` → creates `notifications` for important transitions (`pending_match` → `matched`, `matched` → `completed`, `*` → `canceled`)
- `broadcastEventMatched` → creates per-participant `event_reminder` notifications
- `broadcastAdminAction` → creates `system_alert` notifications for `cancel_event`, `update_venue`, `update_time`

**Pattern:** `eventBroadcast.ts` calls `wsService.broadcast*` for real-time delivery **and** `notificationsRepo.createNotification` for persistence.

---

## Frontend Hooks

- **Web:** `apps/user-client/src/hooks/useNotificationCounts.ts` — TanStack Query with 30s refetch
- **Mini-program:** `apps/mini-program/src/hooks/useNotificationCounts.ts` — TanStack Query with 30s refetch, uses `@shared/api` helpers

Both support `useMarkNotificationsAsRead()` which invalidates the count query on success.

---

## Quick Examples

**User:** "When an event is cancelled, participants should get a notification"
→ Use this skill. The cancellation flow already triggers `broadcastEventStatusChanged(..., 'canceled')` in `eventBroadcast.ts`, which creates a `system_alert` notification for all participants. If the cancellation is initiated by an admin, `broadcastAdminAction('cancel_event')` also creates a notification. Ensure both paths do not duplicate notifications.

**User:** "Add a new notification type for pool registration reminders"
→ Use this skill. Add the type string to the schema comments (or validate it at runtime), create the notification via `notificationsRepo.createNotification()` in the pool registration flow, and optionally broadcast via `wsService.broadcastToUser()`. Add a test that the row is created with `isRead: false`.

**User:** "The notification badge on the activities tab is not updating"
→ Use this skill. Check: (1) Does `GET /api/notifications/counts` return the expected `activities` count? (2) Is the client hook polling/refetching correctly? (3) Was `mark-read` called but the count query not invalidated? (4) Did the server actually create the notification row?

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| User never sees a notification | Row not created; check `createNotification` call site | Add `notificationsRepo.createNotification` in the business flow; wrap in try/catch |
| Badge count is stale after reading | `mark-read` succeeded but query not invalidated | Ensure `useMarkNotificationsAsRead` calls `invalidateQueries` for the count key |
| Duplicate notifications for same event | Multiple trigger paths (eventBroadcast + direct route) | Deduplicate with a pre-insert check or centralize in one trigger function |
| Admin broadcast shows wrong stats | `getNotificationStats` groups by `title`, `message`, `sent_by`, `created_at` | Ensure broadcast rows share identical values; do not vary `message` per recipient |
| WebSocket notification arrives but badge missing | Client only listens to WS and does not refetch counts | Badge should derive from DB counts; WS is supplemental |
| Notification created but no real-time update | WS not wired or user not in room | WS is best-effort; 30s polling is the fallback guarantee |

---

## Review Checklist

- [ ] New notification trigger creates a DB row via `notificationsRepo.createNotification()`
- [ ] Category is one of `discover`, `activities`, `chat`
- [ ] Type is documented (in schema comment or runtime validation)
- [ ] Broadcast (if any) happens **after** DB persistence
- [ ] `eventBroadcast.ts` is used for event lifecycle notifications rather than ad-hoc repo calls
- [ ] Admin broadcast endpoints enforce `requireOperatorOrAbove`
- [ ] `mark-read` mutation invalidates the count query on both web and mini-program
- [ ] No sensitive data (tokens, internal IDs) in notification `title` or `message`

---

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `websocket-realtime` | WebSocket connection lifecycle, auth, room broadcasting |
| `event-pool-and-matching-operations` | Event pool lifecycle, match-run operations |
| `matching-domain` | Pair/group scoring and match explanation |
| `social-icebreaker-domain` | Social icebreaker session state and phase changes |
| `admin-audit-and-rbac-governance` | Admin role checks for broadcast/send endpoints |
| `platform-coordination-protocol` | When notification changes affect both web and mini-program |
| `server-domain-architecture` | Adding new HTTP routes or repository files |
| `platform-observability-and-ops` | Adding structured logging or metrics around notification delivery |

---

## Canonical References

- `apps/server/src/repositories/notificationsRepo.ts`
- `apps/server/src/eventBroadcast.ts`
- `apps/server/src/routes.ts` (notification endpoints around lines 4741–4775, 5043–5071, 8615–8696)
- `apps/server/src/storage.ts`
- `apps/server/src/wsService.ts`
- `packages/shared/src/schema.ts` (`notifications` table, `NotificationCounts`)
- `packages/shared/src/api.ts` (`getNotificationCounts`, `markNotificationsAsRead`)
- `apps/user-client/src/hooks/useNotificationCounts.ts`
- `apps/mini-program/src/hooks/useNotificationCounts.ts`
