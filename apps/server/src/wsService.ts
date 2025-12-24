import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSMessage, WSEventType } from '@shared/wsEvents';
import { storage } from './storage';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
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

interface IcebreakerSessionInfo {
  sessionId: string;
  ws: AuthenticatedWebSocket;
  userId: string;
  lastSeenAt: Date;
}

interface KingGamePlayerInfo {
  sessionId: string;
  ws: AuthenticatedWebSocket;
  userId: string;
  displayName: string;
  isReady: boolean;
  hasDrawnCard: boolean;
  cardNumber: number | null;
  isKing: boolean;
}

interface KingGameRoomState {
  icebreakerSessionId: string;
  playerCount: number;
  roundNumber: number;
  phase: 'waiting' | 'dealing' | 'commanding' | 'executing' | 'completed';
  dealerId: string | null;
  kingUserId: string | null;
  mysteryNumber: number | null;
  currentCommand: string | null;
  targetNumber: number | null;
  cardAssignments: Map<string, { cardNumber: number | null; isKing: boolean }>;
  players: Map<string, KingGamePlayerInfo>;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private eventRooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private icebreakerRooms: Map<string, Map<string, IcebreakerSessionInfo>> = new Map();
  private kingGameRooms: Map<string, KingGameRoomState> = new Map();

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

      // ============ King Game handlers ============
      case 'KING_GAME_JOIN':
        if (message.userId && message.data?.sessionId) {
          ws.userId = message.userId;
          this.addClientToUser(message.userId, ws);
          this.handleKingGameJoin(
            message.data.sessionId,
            message.data.icebreakerSessionId,
            message.userId,
            message.data.displayName || 'Player',
            message.data.playerCount || 5,
            ws
          );
        }
        break;

      case 'KING_GAME_PLAYER_READY':
        if (message.userId && message.data?.sessionId) {
          this.handleKingGamePlayerReady(message.data.sessionId, message.userId);
        }
        break;

      case 'KING_GAME_START_DEAL':
        if (message.userId && message.data?.sessionId) {
          this.handleKingGameStartDeal(message.data.sessionId, message.userId);
        }
        break;

      case 'KING_GAME_CARD_DEALT':
        if (message.userId && message.data?.sessionId) {
          this.handleKingGameCardDrawn(message.data.sessionId, message.userId);
        }
        break;

      case 'KING_GAME_COMMAND_ISSUED':
        if (message.userId && message.data?.sessionId) {
          this.handleKingGameCommand(
            message.data.sessionId,
            message.userId,
            message.data.command,
            message.data.targetNumber
          );
        }
        break;

      case 'KING_GAME_ROUND_COMPLETE':
        if (message.userId && message.data?.sessionId) {
          this.handleKingGameRoundComplete(message.data.sessionId);
        }
        break;

      case 'KING_GAME_STATE_SYNC':
        if (message.userId && message.data?.sessionId) {
          this.sendKingGameStateSync(message.data.sessionId, message.userId, ws);
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

      // Award XP for checkin (only for new checkins)
      if (!existingCheckin) {
        try {
          const { awardXPAndCoins, updateActivityStreak } = await import('./gamificationService');
          
          // Award checkin XP
          const xpResult = await awardXPAndCoins(userId, 'event_checkin');
          console.log(`[Gamification] Awarded checkin XP to user ${userId}:`, xpResult);
          
          // Update activity streak
          const streakResult = await updateActivityStreak(userId);
          console.log(`[Gamification] Updated streak for user ${userId}:`, streakResult);
        } catch (xpError) {
          console.error("Error awarding checkin XP:", xpError);
        }
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

        // When session ends, mark all checked-in participants as attended
        if (nextPhase === 'ended') {
          if (session.eventId) {
            // For traditional event sessions, update eventAttendance
            await storage.markSessionAttendanceCompleted(sessionId, session.eventId);
            console.log(`[WS] Session ${sessionId} ended - marked attendance as completed for event ${session.eventId}`);
          } else if (session.blindBoxEventId) {
            // For blind box events, update status to 'completed'
            await storage.markBlindBoxEventCompleted(session.blindBoxEventId);
            console.log(`[WS] Session ${sessionId} ended - marked blind box event ${session.blindBoxEventId} as completed`);
          } else if (session.groupId) {
            // For event pool group sessions, update status to 'completed'
            await storage.markEventPoolGroupCompleted(session.groupId);
            console.log(`[WS] Session ${sessionId} ended - marked group ${session.groupId} as completed`);
          }
        }

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
      activeKingGameSessions: this.kingGameRooms.size,
    };
  }

  // ============ 国王游戏多设备同步 ============

  private handleKingGameJoin(
    sessionId: string,
    icebreakerSessionId: string,
    userId: string,
    displayName: string,
    playerCount: number,
    ws: AuthenticatedWebSocket
  ) {
    let room = this.kingGameRooms.get(sessionId);
    if (!room) {
      room = {
        icebreakerSessionId,
        playerCount,
        roundNumber: 1,
        phase: 'waiting',
        dealerId: null,
        kingUserId: null,
        mysteryNumber: null,
        currentCommand: null,
        targetNumber: null,
        cardAssignments: new Map(),
        players: new Map(),
      };
      this.kingGameRooms.set(sessionId, room);
    }

    room.players.set(userId, {
      sessionId,
      ws,
      userId,
      displayName,
      isReady: false,
      hasDrawnCard: false,
      cardNumber: null,
      isKing: false,
    });

    console.log(`[WS] User ${userId} joined King Game ${sessionId}, players: ${room.players.size}`);

    // Broadcast player list to all
    this.broadcastKingGamePlayerList(sessionId);
    
    // Send state sync to new joiner
    this.sendKingGameStateSync(sessionId, userId, ws);
  }

  private handleKingGamePlayerReady(sessionId: string, userId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    const player = room.players.get(userId);
    if (player) {
      player.isReady = true;
    }

    const readyCount = Array.from(room.players.values()).filter(p => p.isReady).length;
    const totalPlayers = room.players.size;

    // Broadcast ready status
    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_PLAYER_READY',
      data: {
        sessionId,
        userId,
        isReady: true,
        readyCount,
        totalPlayers,
      },
      timestamp: new Date().toISOString(),
    });

    // If all ready and enough players, auto-select dealer and start
    if (readyCount >= room.playerCount && room.phase === 'waiting') {
      this.selectDealerAndStartDeal(sessionId);
    }
  }

  private selectDealerAndStartDeal(sessionId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    const playerIds = Array.from(room.players.keys());
    
    // Only select random dealer on first round; otherwise use rotated dealer from advanceDealer
    if (!room.dealerId || !playerIds.includes(room.dealerId)) {
      const dealerIndex = Math.floor(Math.random() * playerIds.length);
      room.dealerId = playerIds[dealerIndex];
    }
    const dealerId = room.dealerId;

    // Generate card assignments (N+1 cards for N players)
    const playerCount = room.players.size;
    const cards: Array<{ cardNumber: number | null; isKing: boolean }> = [];
    
    // Cards 1 to N (number cards)
    for (let i = 1; i <= playerCount; i++) {
      cards.push({ cardNumber: i, isKing: false });
    }
    // King card
    cards.push({ cardNumber: null, isKing: true });

    // Shuffle cards
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    // Assign cards to players (one card left as mystery)
    let cardIndex = 0;
    for (const playerId of playerIds) {
      room.cardAssignments.set(playerId, cards[cardIndex]);
      if (cards[cardIndex].isKing) {
        room.kingUserId = playerId;
      }
      cardIndex++;
    }

    // The remaining card is the mystery number
    const mysteryCard = cards[cardIndex];
    room.mysteryNumber = mysteryCard.cardNumber; // Could be null if king is mystery (edge case)

    room.phase = 'dealing';

    const dealerPlayer = room.players.get(dealerId);

    // Broadcast deal start
    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_START_DEAL',
      data: {
        sessionId,
        dealerId,
        dealerName: dealerPlayer?.displayName || 'Player',
        playerCount,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`[WS] King Game ${sessionId} dealing started, dealer: ${dealerId}, mystery: ${room.mysteryNumber}`);
  }

  private handleKingGameStartDeal(sessionId: string, userId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room || room.dealerId !== userId) return;

    // Dealer confirms deal - cards are already assigned, just update phase
    if (room.phase === 'waiting') {
      this.selectDealerAndStartDeal(sessionId);
    }
  }

  private handleKingGameCardDrawn(sessionId: string, userId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room || room.phase !== 'dealing') return;

    const player = room.players.get(userId);
    if (!player || player.hasDrawnCard) return;

    const assignment = room.cardAssignments.get(userId);
    if (!assignment) return;

    player.hasDrawnCard = true;
    player.cardNumber = assignment.cardNumber;
    player.isKing = assignment.isKing;

    // Send private card info to this player only
    this.sendToClient(player.ws, {
      type: 'KING_GAME_CARD_DEALT',
      data: {
        sessionId,
        userId,
        cardNumber: assignment.cardNumber,
        isKing: assignment.isKing,
        drawnCount: Array.from(room.players.values()).filter(p => p.hasDrawnCard).length,
        totalPlayers: room.players.size,
      },
      timestamp: new Date().toISOString(),
    });

    // Broadcast draw progress (not the card content)
    const drawnCount = Array.from(room.players.values()).filter(p => p.hasDrawnCard).length;
    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_ALL_CARDS_DRAWN',
      data: {
        sessionId,
        drawnCount,
        totalPlayers: room.players.size,
        allDrawn: drawnCount === room.players.size,
      },
      timestamp: new Date().toISOString(),
    });

    // If all drawn, reveal king
    if (drawnCount === room.players.size) {
      this.revealKing(sessionId);
    }
  }

  private revealKing(sessionId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room || !room.kingUserId) return;

    room.phase = 'commanding';
    const kingPlayer = room.players.get(room.kingUserId);

    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_KING_REVEALED',
      data: {
        sessionId,
        kingUserId: room.kingUserId,
        kingDisplayName: kingPlayer?.displayName || 'King',
        mysteryNumber: room.mysteryNumber,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`[WS] King Game ${sessionId} king revealed: ${room.kingUserId}, mystery: ${room.mysteryNumber}`);
  }

  private handleKingGameCommand(
    sessionId: string,
    userId: string,
    command: string,
    targetNumber: number
  ) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room || room.kingUserId !== userId || room.phase !== 'commanding') return;

    room.currentCommand = command;
    room.targetNumber = targetNumber;
    room.phase = 'executing';

    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_COMMAND_ISSUED',
      data: {
        sessionId,
        command,
        targetNumber,
        kingUserId: userId,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`[WS] King Game ${sessionId} command: ${command} -> #${targetNumber}`);
  }

  private handleKingGameRoundComplete(sessionId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    // Find executor (player with targetNumber)
    let executorUserId: string | null = null;
    for (const [playerId, player] of room.players) {
      if (player.cardNumber === room.targetNumber) {
        executorUserId = playerId;
        break;
      }
    }

    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_ROUND_COMPLETE',
      data: {
        sessionId,
        roundNumber: room.roundNumber,
        targetNumber: room.targetNumber,
        executorUserId,
        command: room.currentCommand,
      },
      timestamp: new Date().toISOString(),
    });

    // Reset for next round
    room.roundNumber++;
    room.phase = 'waiting';
    room.kingUserId = null;
    room.mysteryNumber = null;
    room.currentCommand = null;
    room.targetNumber = null;
    room.cardAssignments.clear();
    
    for (const player of room.players.values()) {
      player.isReady = false;
      player.hasDrawnCard = false;
      player.cardNumber = null;
      player.isKing = false;
    }

    // Rotate dealer to next player
    this.advanceDealer(sessionId);

    console.log(`[WS] King Game ${sessionId} round ${room.roundNumber - 1} complete, next dealer: ${room.dealerId}`);
  }

  private advanceDealer(sessionId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    const playerIds = Array.from(room.players.keys());
    if (playerIds.length === 0) return;

    if (!room.dealerId) {
      // First round - randomly select dealer
      room.dealerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    } else {
      // Rotate to next player in order
      const currentIndex = playerIds.indexOf(room.dealerId);
      const nextIndex = (currentIndex + 1) % playerIds.length;
      room.dealerId = playerIds[nextIndex];
    }
  }

  private sendKingGameStateSync(sessionId: string, userId: string, ws: AuthenticatedWebSocket) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    const myPlayer = room.players.get(userId);
    // PRIVACY: Only include public info - never reveal isKing or cardNumber for other players
    const players = Array.from(room.players.values()).map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      isReady: p.isReady,
      hasDrawnCard: p.hasDrawnCard,
      isDealer: room.dealerId === p.userId,
    }));

    this.sendToClient(ws, {
      type: 'KING_GAME_STATE_SYNC',
      data: {
        sessionId,
        phase: room.phase,
        playerCount: room.playerCount,
        roundNumber: room.roundNumber,
        players,
        dealerId: room.dealerId,
        // PRIVACY: Only reveal kingUserId after the reveal phase
        kingUserId: room.phase === 'commanding' || room.phase === 'executing' ? room.kingUserId : null,
        mysteryNumber: room.phase === 'commanding' || room.phase === 'executing' ? room.mysteryNumber : null,
        currentCommand: room.currentCommand,
        targetNumber: room.targetNumber,
        myCardNumber: myPlayer?.cardNumber ?? null,
        myIsKing: myPlayer?.isKing ?? false,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastKingGamePlayerList(sessionId: string) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    const players = Array.from(room.players.values()).map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      isReady: p.isReady,
      isDealer: room.dealerId === p.userId,
    }));

    this.broadcastToKingGameRoom(sessionId, {
      type: 'KING_GAME_PLAYER_JOINED',
      data: {
        sessionId,
        players,
        playerCount: room.players.size,
        requiredPlayers: room.playerCount,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastToKingGameRoom(sessionId: string, message: WSMessage) {
    const room = this.kingGameRooms.get(sessionId);
    if (!room) return;

    for (const player of room.players.values()) {
      this.sendToClient(player.ws, message);
    }
    console.log(`[WS] Broadcast to King Game ${sessionId}: ${message.type} to ${room.players.size} players`);
  }

  getKingGameRoom(sessionId: string): KingGameRoomState | undefined {
    return this.kingGameRooms.get(sessionId);
  }
}

export const wsService = new WebSocketService();
