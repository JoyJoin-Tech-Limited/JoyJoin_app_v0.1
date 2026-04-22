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

---

## When to use this skill

- Adding or modifying WebSocket message types (`packages/shared/src/wsEvents.ts`)
- Changing broadcast patterns (`broadcastToUser`, `broadcastToEvent`, `broadcastToAll`)
- Modifying connection auth, heartbeat, or reconnection logic
- Debugging real-time delivery issues (messages not arriving, stale connections)
- Adding real-time notifications for event lifecycle (created, matched, completed, cancelled)
- Working on King Game real-time sync or legacy icebreaker WebSocket flow
- Changing rate-limit thresholds or client reconnect backoff

## When NOT to use this skill

- Social Icebreaker phase changes or host actions → use `social-icebreaker-domain` (polling-only)
- Event pool matching algorithms → use `matching-domain`
- General HTTP API design → use `server-domain-architecture`
- AI-generated content delivery → use `llm-runtime-safety-and-integration`

---

## Architecture Overview

```
Client ──WSS──> wsService.ts (auth, rooms, routing)
                 │
                 ├── broadcastToUser(userId, msg)
                 ├── broadcastToEvent(eventId, msg)
                 ├── broadcastToAll(msg)
                 ├── broadcastToIcebreakerSession(sessionId, msg)  [legacy]
                 └── broadcastToKingGameRoom(sessionId, msg)
```

**Critical:** `wsService.initialize(server)` exists but is **not currently wired** into the HTTP server bootstrap in `index.ts`. The WebSocket server is dead code until this is connected.

## Connection Lifecycle

1. **Connect** — Client opens `wss?://host/ws`
2. **Auth** — Server reads `connect.sid` from the HTTP upgrade cookie, unsigns with `SESSION_SECRET`, looks up `sessions` table, attaches `ws.userId` / `ws.authenticated`
3. **Subscribe** — Client sends `USER_JOINED` (with optional `eventId`); server adds socket to rooms
4. **Message** — Server routes by `message.type` through `handleMessage` switch
5. **Disconnect** — `handleDisconnect` removes socket from all rooms, broadcasts offline status

**Auth failure:** Connection stays open but `ws.authenticated = false`. Every inbound message is validated: if `message.userId` is present, it must match `ws.userId`; otherwise the message is silently dropped.

## Message Types

Canonical types live in `packages/shared/src/wsEvents.ts`. Key categories:

| Category | Types |
|----------|-------|
| **Event lifecycle** | `EVENT_CREATED`, `EVENT_UPDATED`, `EVENT_MATCHED`, `EVENT_STATUS_CHANGED`, `EVENT_COMPLETED`, `EVENT_CANCELED`, `POOL_REGISTRATION_ADDED`, `POOL_MATCHED`, `EVENT_THEME_TITLE_REVEALED` |
| **Presence** | `USER_JOINED`, `USER_CONFIRMED`, `USER_LEFT` |
| **Progress** | `MATCH_PROGRESS_UPDATE` |
| **Heartbeat** | `PING`, `PONG` |
| **Rate limit** | `RATE_LIMITED` |
| **Legacy icebreaker** | `ICEBREAKER_*` (checkin, phase change, ready vote, etc.) |
| **King Game** | `KING_GAME_*` (join, deal, reveal, command, etc.) |

**All messages share shape:** `{ type, eventId?, userId?, data?, timestamp }`

## Broadcasting Patterns

| Method | Scope | Use when |
|--------|-------|----------|
| `broadcastToUser(userId, msg)` | All sockets for one user | Direct notification (pool matched, theme revealed) |
| `broadcastToUsers(userIds[], msg)` | Batch direct | Event matched to multiple users |
| `broadcastToEvent(eventId, msg)` | All in event room | Status changes, confirmations, attendance |
| `broadcastToAll(msg)` | Every connected socket | Rare; pool registration added |
| `broadcastToIcebreakerSession(id, msg)` | Legacy icebreaker room | Legacy flow only |
| `broadcastToKingGameRoom(id, msg)` | King game players | Game state sync |

**Rule:** For critical events, always persist a DB notification fallback (see `eventBroadcast.ts`). WS delivery is best-effort.

## Heartbeat & Reconnection

| Concern | Server | Web client | Mini-program client |
|---------|--------|-----------|---------------------|
| **Heartbeat** | `ping()` every 30s; `terminate()` if no `pong` | App-level `PING` every 30s | App-level `PING` every 30s |
| **Reconnect** | N/A | Exponential backoff: `min(1000 * 2^attempt, 30000)`, max 10 | Exponential backoff: `min(2000 * 2^attempt, 30000)`, max 5 |
| **Background** | N/A | N/A | Disconnect on `useDidHide`, reconnect on `useDidShow` |

## Rate Limiting

- **30 messages per 10-second window** per socket
- Exceeding → block for 60s, send `RATE_LIMITED` event
- `PING`/`PONG` are exempt

## HTTP Polling Boundary

| Feature | Transport |
|---------|-----------|
| Social Icebreaker | **HTTP polling** (3s interval) + heartbeat (10s) |
| Legacy Icebreaker | WebSocket |
| King Game | WebSocket |
| Event notifications | WebSocket + DB notification fallback |

**Do not** add `SOCIAL_*` WebSocket types for social icebreaker phases. The types exist in `wsEvents.ts` but are unused in production.

## Security & Privacy

- **Auth:** Session-cookie only (`connect.sid`). No API-key or token auth on WS.
- **Validation:** Every inbound message checked for `userId` match.
- **King Game:** `sendKingGameStateSync` never reveals `cardNumber` or `isKing` for other players. `kingUserId` and `mysteryNumber` only included after `commanding` phase.

## Quick Examples

**User:** "Add a WebSocket notification when an event is cancelled"
→ Use this skill. Add `EVENT_CANCELED` to `wsEvents.ts`, handle it in `wsService.ts` `handleMessage` (if client-initiated) or call `broadcastToEvent(eventId, { type: 'EVENT_CANCELED', data: { eventId } })` from the cancellation route. Add DB notification fallback in `eventBroadcast.ts`.

**User:** "Why isn't the client receiving real-time match updates?"
→ Use this skill. Check: (1) Is `wsService.initialize(server)` wired in `index.ts`? (2) Does the client call `USER_JOINED` with the correct `eventId`? (3) Is the client's `useWebSocket` hook connected? (4) Check rate-limit status. (5) Verify `broadcastToUser` is called after the match commit.

**User:** "Social icebreaker messages aren't arriving over WebSocket"
→ Do **not** use this skill for social icebreaker. Social icebreaker uses HTTP polling. Check `useSocialIcebreaker` TanStack Query interval and `/api/social-icebreaker/:id` route instead.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No WS messages at all | `wsService.initialize(server)` not wired | Call it in `index.ts` after HTTP server creation |
| Auth fails on WS upgrade | `SESSION_SECRET` mismatch or missing cookie | Verify cookie is sent on upgrade; check session store |
| Messages silently ignored | `message.userId` ≠ `ws.userId` | Ensure client sends correct userId; check auth flow |
| Client reconnects constantly | Heartbeat timeout or rate limit | Check server ping interval; verify client pong response |
| King game state leaked | Wrong broadcast method or missing privacy guard | Use `broadcastToKingGameRoom` with `sendKingGameStateSync` |
| Rate limited | >30 msg / 10s | Batch messages; check for accidental loops |

## Review Checklist

- [ ] New WS type added to `wsEvents.ts` **and** `wsService.ts` `handleMessage`
- [ ] Client hook updated to handle new type (web + mini-program if applicable)
- [ ] Broadcast call happens **after** DB commit (WS is notification layer)
- [ ] Critical events have DB notification fallback via `eventBroadcast.ts`
- [ ] Auth validation preserved (`message.userId` matches `ws.userId`)
- [ ] Rate-limit exemption claimed only for heartbeat messages
- [ ] Mini-program `lib/websocket.ts` singleton handles new type if needed
- [ ] King Game privacy rules applied if broadcasting game state

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `social-icebreaker-domain` | Social icebreaker uses HTTP polling, not WS |
| `matching-domain` | Pool matching algorithm and scoring |
| `event-pool-and-matching-operations` | Event pool lifecycle and match-run ops |
| `llm-runtime-safety-and-integration` | AI-generated theme titles broadcast via WS |
| `platform-coordination-protocol` | When WS changes affect both web and mini-program |
| `server-domain-architecture` | Adding new HTTP routes (not WS events) |

## Canonical References

- `apps/server/src/wsService.ts`
- `apps/server/src/eventBroadcast.ts`
- `packages/shared/src/wsEvents.ts`
- `apps/user-client/src/hooks/useWebSocket.ts`
- `apps/user-client/src/hooks/useIcebreakerWebSocket.ts`
- `apps/user-client/src/hooks/useKingGameWebSocket.ts`
- `apps/mini-program/src/lib/websocket.ts`
- `apps/mini-program/src/hooks/useWebSocket.ts`
