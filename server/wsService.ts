import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSMessage, WSEventType } from '../shared/wsEvents';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private eventRooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('[WS] New client connected');
      ws.isAlive = true;

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
        fetch('http://localhost:5000/api/chat-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'ws_error',
            userId: ws.userId,
            severity: 'error',
            message: 'WebSocket connection error',
            metadata: { error: error.message, stack: error.stack },
          }),
        }).catch(err => console.error('[WS] Failed to log error:', err));
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

  private handleMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
    switch (message.type) {
      case 'PING':
        this.sendToClient(ws, { type: 'PONG', timestamp: new Date().toISOString() });
        break;

      case 'USER_JOINED':
        // 用户加入时，保存userId和订阅eventId
        if (message.userId) {
          ws.userId = message.userId;
          this.addClientToUser(message.userId, ws);
        }
        if (message.eventId) {
          this.subscribeToEvent(ws, message.eventId);
        }
        console.log(`[WS] User ${message.userId} joined event ${message.eventId}`);
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
    
    // Log disconnection
    fetch('http://localhost:5000/api/chat-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'ws_disconnected',
        userId,
        severity: 'info',
        message: 'WebSocket client disconnected',
      }),
    }).catch(err => console.error('[WS] Failed to log disconnection:', err));
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
