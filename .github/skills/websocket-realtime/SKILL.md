---
name: websocket-realtime
description: >
  WebSocket real-time infrastructure: connection lifecycle, auth, room-based broadcasting,
  heartbeat/reconnect, rate limiting, and HTTP polling boundaries. Use when adding WebSocket events,
  modifying broadcast patterns, or debugging real-time delivery. Triggers: WebSocket, ws, realtime,
  broadcast, event room, heartbeat, reconnect, pool matching notification, king game, icebreaker
  websocket, connectSocket, Taro websocket.
---

# WebSocket / Real-time Infrastructure

**Core rule:** WebSocket is a notification layer, not a persistence layer. Always write state to the database first, then broadcast. The Social Icebreaker is polling-only by design; do not add WS events for social phases unless explicitly migrating the architecture.

## When to use this skill

- Adding or modifying WebSocket message types (`packages/shared/src/wsEvents.ts`)
- Changing broadcast patterns (`broadcastToUser`, `broadcastToEvent`, `broadcastToAll`)
- Modifying connection auth, heartbeat, or reconnection logic
- Debugging real-time delivery issues (messages not arriving, stale connections)
- Adding real-time notifications for event lifecycle
- Working on King Game real-time sync

## Architecture Overview

```
Client ──WSS──> wsService.ts (auth, rooms, routing)
                 │
                 ├── broadcastToUser(userId, msg)
                 ├── broadcastToEvent(eventId, msg)
                 ├── broadcastToAll(msg)
                 └── broadcastToKingGameRoom(sessionId, msg)
```

**Critical:** `wsService.initialize(server)` exists but is **not currently wired** into the HTTP server bootstrap in `index.ts`.

## Connection lifecycle overview

1. **Connect** — Client opens `wss?://host/ws`
2. **Auth** — Server reads `connect.sid` from the HTTP upgrade cookie, unsigns with `SESSION_SECRET`, looks up `sessions` table
3. **Subscribe** — Client sends `USER_JOINED`; server adds socket to rooms
4. **Message** — Server routes by `message.type` through `handleMessage`
5. **Disconnect** — Removes socket from all rooms, broadcasts offline status

## Room broadcasting overview

| Method | Scope | Use when |
|--------|-------|----------|
| `broadcastToUser` | All sockets for one user | Direct notification |
| `broadcastToEvent` | All in event room | Status changes, confirmations |
| `broadcastToAll` | Every connected socket | Rare; global announcements |
| `broadcastToKingGameRoom` | King game players | Game state sync |

**Rule:** For critical events, always persist a DB notification fallback. WS delivery is best-effort.

For auth handshake details, heartbeat/reconnect logic, rate limiting specifics, HTTP polling boundaries, and Taro WebSocket examples — see [references/protocol.md](references/protocol.md).

## Quick examples

**User:** "Add a WebSocket notification when an event is cancelled"
→ Add `EVENT_CANCELED` to `wsEvents.ts`, call `broadcastToEvent(eventId, { type: 'EVENT_CANCELED', data: { eventId } })` from the cancellation route. Add DB notification fallback in `eventBroadcast.ts`.

**User:** "Why isn't the client receiving real-time match updates?"
→ Check: (1) Is `wsService.initialize(server)` wired in `index.ts`? (2) Does the client call `USER_JOINED` with the correct `eventId`? (3) Is the client's `useWebSocket` hook connected? (4) Check rate-limit status. (5) Verify `broadcastToUser` is called after the match commit.

**User:** "Social icebreaker messages aren't arriving over WebSocket"
→ Do **not** use this skill. Social icebreaker uses HTTP polling. Check `useSocialIcebreaker` TanStack Query interval instead.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No WS messages at all | `wsService.initialize(server)` not wired | Call it in `index.ts` after HTTP server creation |
| Auth fails on WS upgrade | `SESSION_SECRET` mismatch or missing cookie | Verify cookie is sent on upgrade; check session store |
| Messages silently ignored | `message.userId` ≠ `ws.userId` | Ensure client sends correct userId; check auth flow |
| Client reconnects constantly | Heartbeat timeout or rate limit | Check server ping interval; verify client pong response |
| King game state leaked | Wrong broadcast method or missing privacy guard | Use `broadcastToKingGameRoom` with `sendKingGameStateSync` |
| Rate limited | >30 msg / 10s | Batch messages; check for accidental loops |

## Review checklist

- [ ] New WS type added to `wsEvents.ts` **and** `wsService.ts` `handleMessage`
- [ ] Client hook updated to handle new type (web + mini-program if applicable)
- [ ] Broadcast call happens **after** DB commit (WS is notification layer)
- [ ] Critical events have DB notification fallback via `eventBroadcast.ts`
- [ ] Auth validation preserved (`message.userId` matches `ws.userId`)
- [ ] Rate-limit exemption claimed only for heartbeat messages
- [ ] King Game privacy rules applied if broadcasting game state
