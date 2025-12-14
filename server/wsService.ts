import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSMessage, WSEventType } from '../shared/wsEvents';
import { storage } from './storage';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface IcebreakerSessionInfo {
  sessionId: string;
  ws: AuthenticatedWebSocket;
  userId: string;
  lastSeenAt: Date;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private eventRooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private icebreakerRooms: Map<string, Map<string, IcebreakerSessionInfo>> = new Map();

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

      case 'ICEBREAKER_JOIN_SESSION':
        if (message.userId && message.data?.sessionId) {
          ws.userId = message.userId;
          this.addClientToUser(message.userId, ws);
          this.joinIcebreakerSession(message.data.sessionId, message.userId, ws);
          console.log(`[WS] User ${message.userId} joined icebreaker session ${message.data.sessionId}`);
        }
        break;

      case 'ICEBREAKER_CHECKIN':
        if (message.userId && message.data?.sessionId) {
          this.handleCheckin(message.data.sessionId, message.userId);
        }
        break;

      case 'ICEBREAKER_READY_VOTE':
        if (message.userId && message.data?.sessionId && message.data?.phase) {
          this.handleReadyVote(message.data.sessionId, message.userId, message.data.phase, message.data.isAutoVote || false);
        }
        break;

      case 'ICEBREAKER_TOPIC_SELECTED':
        if (message.userId && message.data?.sessionId) {
          this.broadcastToIcebreakerSession(message.data.sessionId, {
            type: 'ICEBREAKER_TOPIC_SELECTED',
            data: {
              sessionId: message.data.sessionId,
              topicId: message.data.topicId,
              topicTitle: message.data.topicTitle,
              selectedBy: message.userId,
            },
            timestamp: new Date().toISOString(),
          });
          console.log(`[WS] Topic ${message.data.topicId} selected in session ${message.data.sessionId}`);
        }
        break;

      case 'ICEBREAKER_GAME_STARTED':
        if (message.userId && message.data?.sessionId) {
          this.broadcastToIcebreakerSession(message.data.sessionId, {
            type: 'ICEBREAKER_GAME_STARTED',
            data: {
              sessionId: message.data.sessionId,
              gameId: message.data.gameId,
              gameName: message.data.gameName,
              startedBy: message.userId,
            },
            timestamp: new Date().toISOString(),
          });
          console.log(`[WS] Game ${message.data.gameId} started in session ${message.data.sessionId}`);
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
      this.handleIcebreakerDisconnect(userId, ws);
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

  // ============ 破冰会话管理 ============

  private async joinIcebreakerSession(sessionId: string, userId: string, ws: AuthenticatedWebSocket) {
    if (!this.icebreakerRooms.has(sessionId)) {
      this.icebreakerRooms.set(sessionId, new Map());
    }
    const room = this.icebreakerRooms.get(sessionId)!;
    room.set(userId, {
      sessionId,
      ws,
      userId,
      lastSeenAt: new Date(),
    });
    console.log(`[WS] User ${userId} joined icebreaker session ${sessionId}, room size: ${room.size}`);

    // Handle reconnection: if user already checked in but was offline, update isOnline=true
    try {
      const existingCheckin = await storage.getUserCheckin(sessionId, userId);
      if (existingCheckin && !existingCheckin.isOnline) {
        await storage.updateCheckin(existingCheckin.id, { isOnline: true });
        console.log(`[WS] User ${userId} reconnected - updated isOnline to true`);
        
        // Broadcast user back online
        this.broadcastToIcebreakerSession(sessionId, {
          type: 'ICEBREAKER_USER_ONLINE',
          data: { sessionId, userId, isOnline: true },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[WS] Error handling reconnection:`, error);
    }
  }

  private handleIcebreakerDisconnect(userId: string, ws: AuthenticatedWebSocket) {
    this.icebreakerRooms.forEach((room, sessionId) => {
      const userInfo = room.get(userId);
      if (userInfo && userInfo.ws === ws) {
        room.delete(userId);
        this.broadcastToIcebreakerSession(sessionId, {
          type: 'ICEBREAKER_USER_OFFLINE',
          data: { sessionId, userId, isOnline: false },
          timestamp: new Date().toISOString(),
        });
        console.log(`[WS] User ${userId} left icebreaker session ${sessionId}`);
        if (room.size === 0) {
          this.icebreakerRooms.delete(sessionId);
        }
      }
    });
  }

  broadcastToIcebreakerSession(sessionId: string, message: WSMessage) {
    const room = this.icebreakerRooms.get(sessionId);
    if (room) {
      room.forEach((info) => {
        this.sendToClient(info.ws, message);
      });
      console.log(`[WS] Broadcast to icebreaker ${sessionId}: ${message.type} to ${room.size} clients`);
    }
  }

  leaveIcebreakerSession(sessionId: string, userId: string) {
    const room = this.icebreakerRooms.get(sessionId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.icebreakerRooms.delete(sessionId);
      }
    }
  }

  getIcebreakerSessionMembers(sessionId: string): string[] {
    const room = this.icebreakerRooms.get(sessionId);
    return room ? Array.from(room.keys()) : [];
  }

  isUserInIcebreakerSession(sessionId: string, userId: string): boolean {
    const room = this.icebreakerRooms.get(sessionId);
    return room?.has(userId) ?? false;
  }

  updateIcebreakerUserLastSeen(sessionId: string, userId: string) {
    const room = this.icebreakerRooms.get(sessionId);
    const info = room?.get(userId);
    if (info) {
      info.lastSeenAt = new Date();
    }
  }

  private async handleCheckin(sessionId: string, userId: string) {
    try {
      // Check if user already checked in
      const existingCheckin = await storage.getUserCheckin(sessionId, userId);
      if (!existingCheckin) {
        // Create new checkin
        await storage.createCheckin({
          sessionId,
          userId,
          isOnline: true,
        });
      } else {
        // Update existing checkin
        await storage.updateCheckin(existingCheckin.id, { isOnline: true, checkedInAt: new Date() });
      }

      // Get all checkins with user data
      const checkins = await storage.getSessionCheckins(sessionId);
      const session = await storage.getIcebreakerSession(sessionId);
      const expectedAttendees = session?.expectedAttendees || checkins.length;

      // Broadcast checkin update
      this.broadcastToIcebreakerSession(sessionId, {
        type: 'ICEBREAKER_CHECKIN_UPDATE',
        data: {
          sessionId,
          checkedInCount: checkins.length,
          expectedAttendees,
          checkins: checkins.map(c => ({
            userId: c.userId,
            displayName: c.user.displayName || c.user.firstName || 'User',
            archetype: c.user.archetype || null,
            numberPlate: c.numberPlate,
            profileImageUrl: c.user.profileImageUrl || undefined,
          })),
        },
        timestamp: new Date().toISOString(),
      });

      console.log(`[WS] User ${userId} checked in to session ${sessionId}, total: ${checkins.length}`);

      // Check if all attendees have checked in - trigger phase change
      if (checkins.length >= expectedAttendees && expectedAttendees > 0 && session?.currentPhase === 'checkin') {
        // Assign number plates and change phase
        await storage.assignNumberPlates(sessionId);
        await storage.updateIcebreakerSession(sessionId, { 
          currentPhase: 'number_assign',
          phaseStartedAt: new Date(),
        });

        // Re-fetch checkins with updated number plates
        const updatedCheckins = await storage.getSessionCheckins(sessionId);

        // Broadcast number assignments
        this.broadcastToIcebreakerSession(sessionId, {
          type: 'ICEBREAKER_NUMBER_ASSIGNED',
          data: {
            sessionId,
            assignments: updatedCheckins.map(c => ({
              userId: c.userId,
              displayName: c.user.displayName || c.user.firstName || 'User',
              numberPlate: c.numberPlate || 0,
              archetype: c.user.archetype || null,
              profileImageUrl: c.user.profileImageUrl || undefined,
            })),
          },
          timestamp: new Date().toISOString(),
        });

        // Broadcast phase change
        this.broadcastToIcebreakerSession(sessionId, {
          type: 'ICEBREAKER_PHASE_CHANGE',
          data: { sessionId, phase: 'number_assign', previousPhase: 'checkin' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[WS] Error handling checkin:`, error);
    }
  }

  private async handleReadyVote(sessionId: string, userId: string, phase: string, isAutoVote: boolean) {
    try {
      // Check if user already voted for this phase
      const existingVote = await storage.getUserReadyVote(sessionId, userId, phase);
      if (!existingVote) {
        await storage.createReadyVote({
          sessionId,
          userId,
          phase,
          isAutoVote,
        });
      }

      // Get all ready votes for this phase
      const votes = await storage.getSessionReadyVotes(sessionId, phase);
      const checkins = await storage.getSessionCheckins(sessionId);
      // Only count online participants for ready vote calculation
      const onlineCheckins = checkins.filter(c => c.isOnline);
      const totalCount = onlineCheckins.length;
      const readyCount = votes.filter(v => onlineCheckins.some(c => c.userId === v.userId)).length;
      const readyRatio = totalCount > 0 ? readyCount / totalCount : 0;

      // Broadcast ready count update
      this.broadcastToIcebreakerSession(sessionId, {
        type: 'ICEBREAKER_READY_COUNT_UPDATE',
        data: {
          sessionId,
          phase,
          readyCount,
          totalCount,
          readyRatio,
          isAutoVote,
        },
        timestamp: new Date().toISOString(),
      });

      console.log(`[WS] User ${userId} voted ready (${readyCount}/${totalCount}) in session ${sessionId}`);

      // If all ready, trigger phase change
      const session = await storage.getIcebreakerSession(sessionId);
      if (readyCount >= totalCount && totalCount > 0 && session?.currentPhase === phase) {
        const nextPhase = phase === 'number_assign' ? 'icebreaker' : 'ended';
        await storage.updateIcebreakerSession(sessionId, { 
          currentPhase: nextPhase,
          phaseStartedAt: new Date(),
          ...(nextPhase === 'ended' ? { endedAt: new Date() } : {}),
        });

        this.broadcastToIcebreakerSession(sessionId, {
          type: 'ICEBREAKER_PHASE_CHANGE',
          data: { sessionId, phase: nextPhase, previousPhase: phase },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[WS] Error handling ready vote:`, error);
    }
  }

  // 获取连接统计
  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      uniqueUsers: this.clients.size,
      activeEventRooms: this.eventRooms.size,
      activeIcebreakerSessions: this.icebreakerRooms.size,
    };
  }
}

export const wsService = new WebSocketService();
