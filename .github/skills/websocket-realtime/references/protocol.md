# WebSocket Protocol Reference

## Auth handshake details

1. **Connect** — Client opens `wss?://host/ws`
2. **Auth** — Server reads `connect.sid` from the HTTP upgrade cookie, unsigns with `SESSION_SECRET`, looks up `sessions` table, attaches `ws.userId` / `ws.authenticated`
3. **Subscribe** — Client sends `USER_JOINED` (with optional `eventId`); server adds socket to rooms
4. **Message** — Server routes by `message.type` through `handleMessage` switch
5. **Disconnect** — `handleDisconnect` removes socket from all rooms, broadcasts offline status

**Auth failure:** Connection stays open but `ws.authenticated = false`. Every inbound message is validated: if `message.userId` is present, it must match `ws.userId`; otherwise the message is silently dropped.

**Security:** Session-cookie only (`connect.sid`). No API-key or token auth on WS. Every inbound message checked for `userId` match.

## Heartbeat & reconnect logic

| Concern | Server | Web client | Mini-program client |
|---------|--------|-----------|---------------------|
| **Heartbeat** | `ping()` every 30s; `terminate()` if no `pong` | App-level `PING` every 30s | App-level `PING` every 30s |
| **Reconnect** | N/A | Exponential backoff: `min(1000 * 2^attempt, 30000)`, max 10 | Exponential backoff: `min(2000 * 2^attempt, 30000)`, max 5 |
| **Background** | N/A | N/A | Disconnect on `useDidHide`, reconnect on `useDidShow` |

## Rate limiting specifics

- **30 messages per 10-second window** per socket
- Exceeding → block for 60s, send `RATE_LIMITED` event
- `PING`/`PONG` are exempt

## HTTP polling boundaries

| Feature | Transport |
|---------|-----------|
| Social Icebreaker | **HTTP polling** (3s interval) + heartbeat (10s) |
| Legacy Icebreaker | WebSocket |
| King Game | WebSocket |
| Event notifications | WebSocket + DB notification fallback |

**Do not** add `SOCIAL_*` WebSocket types for social icebreaker phases. The types exist in `wsEvents.ts` but are unused in production.

## Taro WebSocket examples

Mini-program uses singleton pattern in `apps/mini-program/src/lib/websocket.ts` with hook in `apps/mini-program/src/hooks/useWebSocket.ts`.

Web client hooks:
- `apps/user-client/src/hooks/useWebSocket.ts`
- `apps/user-client/src/hooks/useIcebreakerWebSocket.ts`
- `apps/user-client/src/hooks/useKingGameWebSocket.ts`

## King Game privacy rules

`sendKingGameStateSync` never reveals `cardNumber` or `isKing` for other players. `kingUserId` and `mysteryNumber` only included after `commanding` phase.

## Canonical References

- `apps/server/src/wsService.ts`
- `apps/server/src/eventBroadcast.ts`
- `packages/shared/src/wsEvents.ts`
- `apps/user-client/src/hooks/useWebSocket.ts`
- `apps/user-client/src/hooks/useIcebreakerWebSocket.ts`
- `apps/user-client/src/hooks/useKingGameWebSocket.ts`
- `apps/mini-program/src/lib/websocket.ts`
- `apps/mini-program/src/hooks/useWebSocket.ts`
