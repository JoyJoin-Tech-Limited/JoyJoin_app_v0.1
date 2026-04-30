# Notification System Implementation Reference

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

## Event Broadcast Integration

`apps/server/src/eventBroadcast.ts` is the canonical trigger layer for event-related notifications:

- `broadcastEventStatusChanged` → creates `notifications` for important transitions (`pending_match` → `matched`, `matched` → `completed`, `*` → `canceled`)
- `broadcastEventMatched` → creates per-participant `event_reminder` notifications
- `broadcastAdminAction` → creates `system_alert` notifications for `cancel_event`, `update_venue`, `update_time`

**Pattern:** `eventBroadcast.ts` calls `wsService.broadcast*` for real-time delivery **and** `notificationsRepo.createNotification` for persistence.

## WebSocket broadcast specifics

WebSocket broadcasts are a **best-effort enhancement**, not the source of truth. Every notification is persisted before (or alongside) any broadcast. If the WebSocket delivery fails, the notification is still available via:
- 30-second polling of `/api/notifications/counts`
- Direct fetch of `/api/notifications` list

## Mark-read semantics

`POST /api/notifications/mark-read` accepts a `category` parameter. All unread rows in that category for the authenticated user are updated to `isRead: true` in a single batch operation.

## Per-user unread counts

Unread counts are computed from the database (`isRead = false`), not from WebSocket state:

```
GET /api/notifications/counts
→ { discover: N, activities: N, chat: N, total: N }
```

Clients poll this endpoint every 30 seconds as a fallback when WebSocket is unavailable.

## Category filtering

Notifications are grouped into three hardcoded categories:
- `discover` — event recommendations, pool updates, discovery-related alerts
- `activities` — match results, event reminders, registration confirmations
- `chat` — messages, connection updates, social interactions

New notification types must map to one of these three categories.

## Frontend hooks

- **Web:** `apps/user-client/src/hooks/useNotificationCounts.ts` — TanStack Query with 30s refetch
- **Mini-program:** `apps/mini-program/src/hooks/useNotificationCounts.ts` — TanStack Query with 30s refetch, uses `@shared/api` helpers

Both support `useMarkNotificationsAsRead()` which invalidates the count query on success.

## Admin broadcast endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/notifications` | Admin | Notification history sent by this admin |
| `POST` | `/api/admin/notifications/broadcast` | Admin (Operator+) | Broadcast to multiple user IDs |
| `POST` | `/api/admin/notifications/send` | Admin (Operator+) | Send to a single user ID |
| `GET` | `/api/admin/notifications/:id/stats` | Admin | Recipient count and read count for a broadcast |

**Broadcast stats:** `getNotificationStats` groups by `title`, `message`, `sent_by`, `created_at`. Ensure broadcast rows share identical values; do not vary `message` per recipient.

## Canonical references

- `apps/server/src/repositories/notificationsRepo.ts`
- `apps/server/src/eventBroadcast.ts`
- `apps/server/src/routes.ts` (notification endpoints around lines 4741–4775, 5043–5071, 8615–8696)
- `apps/server/src/storage.ts`
- `apps/server/src/wsService.ts`
- `packages/shared/src/schema.ts` (`notifications` table, `NotificationCounts`)
- `packages/shared/src/api.ts` (`getNotificationCounts`, `markNotificationsAsRead`)
- `apps/user-client/src/hooks/useNotificationCounts.ts`
- `apps/mini-program/src/hooks/useNotificationCounts.ts`
