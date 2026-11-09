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
  relatedResourceId: varchar("related_resource_id"), // type-dependent: groupId | poolId | eventId | null
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

Two read paths exist:

- `POST /api/notifications/:id/read` — owner-scoped, idempotent single-row read. Returns `{ success: true }`; invalid ids return `400 INVALID_NOTIFICATION_ID`, missing or other-user ids return the same `404 NOTIFICATION_NOT_FOUND`. Repository: `notificationsRepo.markNotificationAsRead(userId, id)`.
- `POST /api/notifications/mark-read` — accepts a `category` (`discover` | `activities` | `chat`) and batch-updates all unread rows in that category for the authenticated user.

**Client lifecycle (mini-program):** per-item read happens only after the deep-link navigation is accepted, then the list cache and count query are updated. A failed navigation, failed resolver, or failed read call leaves the row unread. There is no tab-entry or unmount bulk auto-read. Read-only rows (unmapped type, blank `relatedResourceId`) clear only through explicit per-category 「全部已读」.

## Deep links (mini-program)

`apps/mini-program/src/lib/navigation/notificationNavigation.ts` is the single resolver. `canNavigateNotification` requires a mapped type plus a non-blank `relatedResourceId`; everything else is read-only.

| Type | Target | Fallback |
|------|--------|----------|
| `match_success` | `/pages/pool-group-detail/index?groupId=…` | — |
| `venue_tbd` | resolve `getPoolGroupDetails(groupId)` then `/pages/pool-group-detail/index?groupId=…` | `event-detail` only on `ApiError` 404 (legacy poolId rows) |
| `feedback_invite` | `/pages/event-feedback/index?id=…` only when server feedback state is `open` | `event-detail` |
| `mutual_match` | Connections tab (`switchTab`) | — |
| `event_reminder`, `pool_full` | `event-detail` | — |
| `subscription_activated`, `subscription_expiring`, `subscription_expired` | rewards page | — |
| Unknown / missing id | read-only (no navigation) | — |

`venue_tbd` notifications created by `matchingPostMatchEffects.ts` carry `groupId` as `relatedResourceId` (changed 2026-11-06 from `poolId`).

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

- **Mini-program counts:** `apps/mini-program/src/hooks/useNotificationCounts.ts` — TanStack Query with 30s refetch, uses `@shared/api` helpers
- **Category mark-all:** `useMarkNotificationsAsRead()` wraps `POST /api/notifications/mark-read` and invalidates the count query on success
- **Per-item read:** `markNotificationRead(api, id)` in `packages/shared/src/api/user.ts`; the notifications page calls it after navigation is accepted
- **Notification list page:** `apps/mini-program/src/pages/notifications/index.tsx` — per-row deep link, optimistic read patch, per-category 「全部已读」 pills

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
- `apps/server/src/routes/domains/icebreakerContent.ts` (notification endpoints)
- `apps/server/src/lib/matchingPostMatchEffects.ts` (`venue_tbd` payload)
- `apps/server/src/storage.ts`
- `apps/server/src/wsService.ts`
- `packages/shared/src/schema.ts` (`notifications` table, `NotificationCounts`)
- `packages/shared/src/api/user.ts` (`markNotificationRead`)
- `apps/mini-program/src/lib/navigation/notificationNavigation.ts`
- `apps/mini-program/src/pages/notifications/index.tsx`
- `apps/mini-program/src/hooks/useNotificationCounts.ts`
