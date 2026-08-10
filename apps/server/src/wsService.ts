import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse as parseCookie } from 'cookie';
import { unsign } from 'cookie-signature';
import type { WSMessage, RoomPokeData } from '@shared/wsEvents';
import { ROOM_POKE_EMOJIS } from '@shared/wsEvents';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './lib/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  authenticated?: boolean;
  isAlive?: boolean;
  messageTimestamps?: number[];
  isBlocked?: boolean;
  blockedUntil?: number;
  // Gathering room presence: userId this socket joined rooms with (may differ
  // from ws.userId for cookie-unauthenticated sockets that joined via
  // message.userId), and the event rooms it currently occupies.
  presenceUserId?: string;
  presenceEventIds?: Set<string>;
}

interface RateLimitConfig {
  maxMessages: number;
  windowMs: number;
  blockDurationMs: number;
}

const RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxMessages: 30,
  windowMs: 10000,
  blockDurationMs: 60000,
};

// Gathering room (集结房间) presence tuning. Env-overridable so tests can
// shrink the timings; production uses the defaults.
// - Leave grace: mini-program clients disconnect on background (useDidHide)
//   and reconnect on foreground, so a member is only broadcast as LEFT after
//   this much time without any socket rejoining.
// - Poke throttle: per-sender minimum interval between ROOM_POKE relays,
//   layered on top of the generic per-socket rate limit above.
const ROOM_LEAVE_GRACE_MS = Number(process.env.ROOM_LEAVE_GRACE_MS) || 5000;
const ROOM_POKE_MIN_INTERVAL_MS = Number(process.env.ROOM_POKE_MIN_INTERVAL_MS) || 2000;

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private eventRooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  // Gathering room presence (ephemeral — never persisted):
  // eventId → userId → live sockets. A user stays "present" during the leave
  // grace window even with zero sockets.
  private roomPresence: Map<string, Map<string, Set<AuthenticatedWebSocket>>> = new Map();
  // `${eventId}:${userId}` → pending ROOM_MEMBER_LEFT grace timer
  private leaveGraceTimers: Map<string, NodeJS.Timeout> = new Map();
  // `${eventId}:${userId}` → last ROOM_POKE relay timestamp (ms)
  private lastPokeAt: Map<string, number> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      ws.isAlive = true;
      ws.authenticated = false;

      // Authenticate via session cookie from the HTTP upgrade request
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        try {
          const cookies = parseCookie(cookieHeader);
          const signedSid = cookies['connect.sid'];
          if (signedSid) {
            const secret = process.env.SESSION_SECRET || '';
            const sid = unsign(signedSid, secret);
            if (sid) {
              const sessionResult = await db.execute(sql`
                SELECT sess FROM sessions 
                WHERE sid = ${sid} AND expire > NOW()
              `);
              const sess = sessionResult.rows[0]?.sess;
              const sessionData = typeof sess === 'string' ? JSON.parse(sess) : sess;
              if (sessionData?.userId) {
                ws.userId = sessionData.userId;
                ws.authenticated = true;
              }
            }
          }
        } catch (e) {
          // Auth failed, continue unauthenticated
        }
      }

      logger.info(`[WS] New client connected${ws.authenticated ? ` (user: ${ws.userId})` : ''}`);

      // 心跳检测
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          logger.error('[WS] Error parsing message', { error: error instanceof Error ? error.message : String(error) });
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        logger.error('[WS] WebSocket error', { error: error instanceof Error ? error.message : String(error) });
        
        // Log WebSocket error
        fetch(`http://localhost:${process.env.PORT || '5001'}/api/v1/interaction-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'ws_error',
            userId: ws.userId,
            severity: 'error',
            message: 'WebSocket connection error',
            metadata: { error: error.message, stack: error.stack },
          }),
        }).catch(err => {
          logger.error('[WS] Failed to log error', { error: err instanceof Error ? err.message : String(err) });
          // Error already logged, no need to throw
        });
      });
    });

    // 心跳检测定时器
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (!authWs.isAlive) {
          return authWs.terminate();
        }
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    logger.info('[WS] WebSocket server initialized');
  }

  private checkRateLimit(ws: AuthenticatedWebSocket): boolean {
    const now = Date.now();
    
    if (ws.isBlocked) {
      if (ws.blockedUntil && now < ws.blockedUntil) {
        return false;
      }
      ws.isBlocked = false;
      ws.blockedUntil = undefined;
      ws.messageTimestamps = [];
    }

    if (!ws.messageTimestamps) {
      ws.messageTimestamps = [];
    }

    ws.messageTimestamps = ws.messageTimestamps.filter(
      timestamp => now - timestamp < RATE_LIMIT_CONFIG.windowMs
    );

    if (ws.messageTimestamps.length >= RATE_LIMIT_CONFIG.maxMessages) {
      ws.isBlocked = true;
      ws.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
      logger.warn(`[WS] Rate limit exceeded for user ${ws.userId}, blocking for ${RATE_LIMIT_CONFIG.blockDurationMs}ms`);
      
      this.sendToClient(ws, {
        type: 'RATE_LIMITED',
        data: {
          message: '消息发送过于频繁，请稍后再试',
          retryAfterMs: RATE_LIMIT_CONFIG.blockDurationMs,
        },
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    ws.messageTimestamps.push(now);
    return true;
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
    const isHeartbeat = message.type === 'PING' || message.type === 'PONG';
    if (!isHeartbeat && !this.checkRateLimit(ws)) {
      return;
    }

    // Validate userId: if authenticated via session, message.userId must match
    const userId = ws.userId || message.userId;
    if (ws.userId && message.userId && message.userId !== ws.userId) {
      logger.warn(`[WS] User ID mismatch in ${message.type}: ws=${ws.userId}, msg=${message.userId}`);
      return;
    }

    switch (message.type) {
      case 'PING':
        this.sendToClient(ws, { type: 'PONG', timestamp: new Date().toISOString() });
        break;

      case 'USER_JOINED':
        // 用户加入时，保存userId和订阅eventId
        if (userId) {
          this.addClientToUser(userId, ws);
        }
        if (message.eventId) {
          this.subscribeToEvent(ws, message.eventId);
          if (userId) {
            this.trackRoomJoin(ws, message.eventId, userId);
          }
        }
        logger.info(`[WS] User ${userId} joined event ${message.eventId}`);
        break;

      case 'USER_LEFT':
        if (message.eventId) {
          this.unsubscribeFromEvent(ws, message.eventId);
          this.trackRoomLeave(ws, message.eventId);
        }
        break;

      case 'ROOM_POKE':
        // ROOM_POKE must come from a socket that has joined the room with the
        // same userId it claims in the message. For authenticated sockets this
        // means message.userId === ws.userId; for cookie-less sockets it means
        // message.userId === ws.presenceUserId. Silently drop spoofed pokes.
        if (ws.authenticated) {
          if (message.userId !== ws.userId) return;
        } else if (message.userId !== ws.presenceUserId) {
          return;
        }
        this.handleRoomPoke(message, userId);
        break;

      default:
        logger.info(`[WS] Received message type: ${message.type}`);
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    const userId = ws.userId;
    
    if (userId) {
      this.removeClientFromUser(userId, ws);
    }
    // 从所有event rooms移除
    this.eventRooms.forEach((clients) => {
      clients.delete(ws);
    });
    // Gathering room presence: drop the socket from every room it occupied;
    // ROOM_MEMBER_LEFT fires only after the grace timer expires.
    if (ws.presenceEventIds) {
      for (const eventId of [...ws.presenceEventIds]) {
        this.trackRoomLeave(ws, eventId);
      }
    }
    logger.info('[WS] Client disconnected');
    
    // Log disconnection (fire and forget with proper error handling)
    fetch(`http://localhost:${process.env.PORT || '5001'}/api/v1/interaction-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'ws_disconnected',
        userId,
        severity: 'info',
        message: 'WebSocket client disconnected',
      }),
    }).catch(err => {
      logger.error('[WS] Failed to log disconnection', { error: err instanceof Error ? err.message : String(err) });
      // Error already logged, no need to throw
    });
  }

  private addClientToUser(userId: string, ws: AuthenticatedWebSocket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  private removeClientFromUser(userId: string, ws: AuthenticatedWebSocket) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  private subscribeToEvent(ws: AuthenticatedWebSocket, eventId: string) {
    if (!this.eventRooms.has(eventId)) {
      this.eventRooms.set(eventId, new Set());
    }
    this.eventRooms.get(eventId)!.add(ws);
  }

  private unsubscribeFromEvent(ws: AuthenticatedWebSocket, eventId: string) {
    const room = this.eventRooms.get(eventId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.eventRooms.delete(eventId);
      }
    }
  }

  // ============ 集结房间 (Gathering Room) presence — ephemeral, in-memory only ============

  /**
   * Track a socket joining an event room for presence purposes.
   * - Replies to the joining socket with ROOM_PRESENCE_STATE (full snapshot,
   *   so late joiners see everyone already present).
   * - Broadcasts ROOM_MEMBER_ENTERED to the whole room (including the
   *   joiner's own sockets — clients dedupe by userId against the snapshot).
   * - A rejoin inside the leave-grace window cancels the pending
   *   ROOM_MEMBER_LEFT and stays silent (flap tolerance).
   */
  private trackRoomJoin(ws: AuthenticatedWebSocket, eventId: string, userId: string) {
    ws.presenceUserId = userId;
    if (!ws.presenceEventIds) {
      ws.presenceEventIds = new Set();
    }
    ws.presenceEventIds.add(eventId);

    let room = this.roomPresence.get(eventId);
    if (!room) {
      room = new Map();
      this.roomPresence.set(eventId, room);
    }

    const graceKey = `${eventId}:${userId}`;
    const pendingTimer = this.leaveGraceTimers.get(graceKey);
    const hadPendingLeave = pendingTimer !== undefined;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.leaveGraceTimers.delete(graceKey);
    }

    let sockets = room.get(userId);
    const wasPresent = sockets !== undefined && sockets.size > 0;
    if (!sockets) {
      sockets = new Set();
      room.set(userId, sockets);
    }
    sockets.add(ws);

    // Snapshot first so the joiner can dedupe its own ENTERED broadcast.
    this.sendToClient(ws, {
      type: 'ROOM_PRESENCE_STATE',
      eventId,
      data: { eventId, presentUserIds: [...room.keys()] },
      timestamp: new Date().toISOString(),
    });

    if (!wasPresent && !hadPendingLeave) {
      this.broadcastToEvent(eventId, {
        type: 'ROOM_MEMBER_ENTERED',
        eventId,
        data: { eventId, userId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Drop a socket from a room's presence set. When the user's last socket
   * leaves, start the grace timer instead of broadcasting immediately —
   * mini-program background/foreground switches reconnect within seconds.
   */
  private trackRoomLeave(ws: AuthenticatedWebSocket, eventId: string) {
    ws.presenceEventIds?.delete(eventId);
    const userId = ws.presenceUserId;
    if (!userId) return;

    const room = this.roomPresence.get(eventId);
    const sockets = room?.get(userId);
    if (!room || !sockets) return;

    sockets.delete(ws);
    if (sockets.size === 0) {
      this.scheduleRoomLeave(eventId, userId);
    }
  }

  private scheduleRoomLeave(eventId: string, userId: string) {
    const graceKey = `${eventId}:${userId}`;
    if (this.leaveGraceTimers.has(graceKey)) return;

    const timer = setTimeout(() => {
      this.leaveGraceTimers.delete(graceKey);
      const room = this.roomPresence.get(eventId);
      const sockets = room?.get(userId);
      // Rejoined during the grace window (timer not yet cancelled) — stay silent.
      if (sockets && sockets.size > 0) return;
      if (room) {
        room.delete(userId);
        if (room.size === 0) {
          this.roomPresence.delete(eventId);
        }
      }
      this.lastPokeAt.delete(graceKey);
      this.broadcastToEvent(eventId, {
        type: 'ROOM_MEMBER_LEFT',
        eventId,
        data: { eventId, userId },
        timestamp: new Date().toISOString(),
      });
    }, ROOM_LEAVE_GRACE_MS);
    // Never keep the Node process alive for a presence timer.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.leaveGraceTimers.set(graceKey, timer);
  }

  /**
   * Relay a ROOM_POKE to the event room. Validates the sender is present in
   * the room, the emoji is whitelisted (string keys, never emoji glyphs), and
   * throttles to one poke per sender per ROOM_POKE_MIN_INTERVAL_MS.
   * Validation/throttle failures are silently dropped — presence UX must
   * never error loudly. No persistence.
   */
  private handleRoomPoke(message: WSMessage, userId: string | undefined) {
    const eventId = message.eventId;
    const targetUserId = message.data?.targetUserId;
    const emoji = message.data?.emoji;

    if (!userId || !eventId) return;
    if (typeof targetUserId !== 'string' || targetUserId.length === 0) return;
    if (typeof emoji !== 'string' || !(ROOM_POKE_EMOJIS as readonly string[]).includes(emoji)) return;

    const senderSockets = this.roomPresence.get(eventId)?.get(userId);
    if (!senderSockets || senderSockets.size === 0) return;

    const pokeKey = `${eventId}:${userId}`;
    const now = Date.now();
    if (now - (this.lastPokeAt.get(pokeKey) ?? 0) < ROOM_POKE_MIN_INTERVAL_MS) return;
    this.lastPokeAt.set(pokeKey, now);

    const data: RoomPokeData = { eventId, fromUserId: userId, targetUserId, emoji: emoji as RoomPokeData['emoji'], ts: now };
    this.broadcastToEvent(eventId, {
      type: 'ROOM_POKE',
      eventId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  private sendToClient(ws: AuthenticatedWebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // 发送给指定用户的所有连接
  broadcastToUser(userId: string, message: WSMessage) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((ws) => {
        this.sendToClient(ws, message);
      });
      logger.info(`[WS] Broadcast to user ${userId}: ${message.type}`);
    }
  }

  // 发送给指定活动房间的所有客户端
  broadcastToEvent(eventId: string, message: WSMessage) {
    const room = this.eventRooms.get(eventId);
    if (room) {
      room.forEach((ws) => {
        this.sendToClient(ws, message);
      });
      logger.info(`[WS] Broadcast to event ${eventId}: ${message.type} to ${room.size} clients`);
    }
  }

  // 发送给多个用户
  broadcastToUsers(userIds: string[], message: WSMessage) {
    userIds.forEach((userId) => {
      this.broadcastToUser(userId, message);
    });
  }

  // 全局广播（慎用）
  broadcastToAll(message: WSMessage) {
    this.wss?.clients.forEach((ws: WebSocket) => {
      const authWs = ws as AuthenticatedWebSocket;
      this.sendToClient(authWs, message);
    });
    logger.info(`[WS] Global broadcast: ${message.type} to ${this.wss?.clients.size} clients`);
  }

  // 获取连接统计
  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      uniqueUsers: this.clients.size,
      activeEventRooms: this.eventRooms.size,
    };
  }
}

export const wsService = new WebSocketService();
