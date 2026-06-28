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

## When to use this skill

- Adding or changing a notification trigger, schema, or REST endpoint
- Changing category/type semantics, unread-count logic, or mark-read behavior
- Debugging missing notification badges or counts
- Adding admin broadcast / single-send capabilities

## When NOT to use this skill

- WebSocket lifecycle or auth → use `websocket-realtime`
- Event pool matching → use `matching-domain`
- Social icebreaker state → use `social-icebreaker-domain`
- Push/SMS/WeChat template messages — not yet implemented

## Architecture overview

```
Trigger (event status, match, admin action)
  │
  ├──► notificationsRepo.createNotification() ──► PostgreSQL (notifications table)
  │
  └──► wsService.broadcastToUser() / broadcastToEvent() ──► WebSocket (best-effort)
```

**Categories:** `discover`, `activities`, `chat`. **Types:** `event_reminder`, `system_alert`, `mutual_match`, `match_success`, `pool_full`, `new_message`, `admin_announcement`, etc. **2026-06-28 additions:** `match_success` is created for every group member after `poolMatchingService` commits groups; `pool_full` is created for all registered users when a pool reaches capacity.

**Key invariant:** Unread counts are computed from the database (`isRead = false`), not WebSocket state. Clients poll `/api/notifications/counts` every 30s as fallback.
## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/notifications/counts` | Phone | Unread counts per category + total |
| `POST` | `/api/notifications/mark-read` | Phone | Mark category as read |
| `POST` | `/api/notifications` | Phone | Create notification for self |
| `GET` | `/api/admin/notifications` | Admin | Admin notification history |
| `POST` | `/api/admin/notifications/broadcast` | Operator+ | Broadcast to multiple users |
| `POST` | `/api/admin/notifications/send` | Operator+ | Send to single user |
| `GET` | `/api/admin/notifications/:id/stats` | Admin | Recipient/read count for broadcast |

See [references/implementation.md](references/implementation.md) for DB schema, WebSocket broadcast specifics, frontend hooks, mark-read semantics, per-user unread counts, and category filtering details.

## Quick examples

**User:** "When an event is cancelled, participants should get a notification"
→ Use this skill. The cancellation flow triggers `broadcastEventStatusChanged(..., 'canceled')` in `eventBroadcast.ts`. If initiated by an admin, `broadcastAdminAction('cancel_event')` also fires. Ensure both paths do not duplicate notifications.

**User:** "Add a new notification type for pool registration reminders"
→ Use this skill. Add the type string to the schema comments (or validate it at runtime), create the notification via `notificationsRepo.createNotification()` in the pool registration flow, and optionally broadcast via `wsService.broadcastToUser()`. Add a test that the row is created with `isRead: false`.

**User:** "The notification badge on the activities tab is not updating"
→ Use this skill. Check: (1) Does `GET /api/notifications/counts` return the expected `activities` count? (2) Is the client hook polling/refetching correctly? (3) Was `mark-read` called but the count query not invalidated? (4) Did the server actually create the notification row?

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| User never sees a notification | Row not created | Add `notificationsRepo.createNotification` in the flow; wrap in try/catch |
| Badge count stale after reading | `mark-read` succeeded but query not invalidated | Ensure `useMarkNotificationsAsRead` calls `invalidateQueries` for count key |
| Duplicate notifications for same event | Multiple trigger paths | Deduplicate with pre-insert check or centralize in one trigger function |
| Admin broadcast shows wrong stats | `getNotificationStats` grouping mismatch | Ensure broadcast rows share identical values; do not vary `message` per recipient |
| WS arrives but badge missing | Client only listens to WS, never refetches | Badge derives from DB counts; WS is supplemental |
| Notification created but no real-time update | WS not wired or user not in room | WS is best-effort; 30s polling is the fallback guarantee |

## Review checklist

- [ ] New notification trigger creates a DB row via `notificationsRepo.createNotification()`
- [ ] Category is one of `discover`, `activities`, `chat`
- [ ] Type is documented (in schema comment or runtime validation)
- [ ] Broadcast (if any) happens **after** DB persistence
- [ ] `eventBroadcast.ts` is used for event lifecycle notifications rather than ad-hoc repo calls
- [ ] Admin broadcast endpoints enforce `requireOperatorOrAbove`
- [ ] `mark-read` mutation invalidates the count query on both web and mini-program
- [ ] No sensitive data (tokens, internal IDs) in notification `title` or `message`

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `websocket-realtime` | WebSocket lifecycle, auth, room broadcasting |
| `event-pool-and-matching-operations` | Event pool lifecycle, match-run operations |
| `matching-domain` | Pair/group scoring and match explanation |
| `social-icebreaker-domain` | Social icebreaker session state and phase changes |
| `admin-audit-and-rbac-governance` | Admin role checks for broadcast/send endpoints |
| `platform-coordination-protocol` | When changes affect both web and mini-program |
| `server-domain-architecture` | Adding new HTTP routes or repository files |
| `platform-observability-and-ops` | Structured logging or metrics around delivery |
