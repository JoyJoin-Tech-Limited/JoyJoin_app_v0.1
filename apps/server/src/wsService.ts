import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse as parseCookie } from 'cookie';
import { unsign } from 'cookie-signature';
import type { WSMessage } from '@shared/wsEvents';
import { db } from './db';
import { sql } from 'drizzle-orm';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  authenticated?: boolean;
  isAlive?: boolean;
  messageTimestamps?: number[];
  isBlocked?: boolean;
  blockedUntil?: number;
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

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private eventRooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();

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

      console.log(`[WS] New client connected${ws.authenticated ? ` (user: ${ws.userId})` : ''}`);

      // 心跳检测
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[WS] WebSocket error:', error);
        
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
          console.error('[WS] Failed to log error:', err);
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

    console.log('[WS] WebSocket server initialized');
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
      console.warn(`[WS] Rate limit exceeded for user ${ws.userId}, blocking for ${RATE_LIMIT_CONFIG.blockDurationMs}ms`);
      
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
      console.warn(`[WS] User ID mismatch in ${message.type}: ws=${ws.userId}, msg=${message.userId}`);
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
        }
        console.log(`[WS] User ${userId} joined event ${message.eventId}`);
        break;

      case 'USER_LEFT':
        if (message.eventId) {
          this.unsubscribeFromEvent(ws, message.eventId);
        }
        break;

      default:
        console.log(`[WS] Received message type: ${message.type}`);
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
    console.log('[WS] Client disconnected');
    
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
      console.error('[WS] Failed to log disconnection:', err);
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
      console.log(`[WS] Broadcast to user ${userId}: ${message.type}`);
    }
  }

  // 发送给指定活动房间的所有客户端
  broadcastToEvent(eventId: string, message: WSMessage) {
    const room = this.eventRooms.get(eventId);
    if (room) {
      room.forEach((ws) => {
        this.sendToClient(ws, message);
      });
      console.log(`[WS] Broadcast to event ${eventId}: ${message.type} to ${room.size} clients`);
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
    console.log(`[WS] Global broadcast: ${message.type} to ${this.wss?.clients.size} clients`);
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
