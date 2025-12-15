// WebSocket事件类型定义

export type WSEventType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_MATCHED"
  | "EVENT_STATUS_CHANGED"
  | "EVENT_COMPLETED"
  | "EVENT_CANCELED"
  | "POOL_MATCHED"
  | "USER_JOINED"
  | "USER_CONFIRMED"
  | "USER_LEFT"
  | "MATCH_PROGRESS_UPDATE"
  | "ADMIN_ACTION"
  | "PING"
  | "PONG"
  // Icebreaker events
  | "ICEBREAKER_JOIN_SESSION"
  | "ICEBREAKER_CHECKIN"
  | "ICEBREAKER_CHECKIN_UPDATE"
  | "ICEBREAKER_PHASE_CHANGE"
  | "ICEBREAKER_NUMBER_ASSIGNED"
  | "ICEBREAKER_READY_VOTE"
  | "ICEBREAKER_READY_COUNT_UPDATE"
  | "ICEBREAKER_TOPIC_SELECTED"
  | "ICEBREAKER_GAME_STARTED"
  | "ICEBREAKER_SESSION_ENDED"
  | "ICEBREAKER_USER_OFFLINE"
  | "ICEBREAKER_USER_RECONNECTED"
  | "RATE_LIMITED"
  // King Game events
  | "KING_GAME_JOIN"
  | "KING_GAME_PLAYER_JOINED"
  | "KING_GAME_PLAYER_READY"
  | "KING_GAME_START_DEAL"
  | "KING_GAME_CARD_DEALT"
  | "KING_GAME_ALL_CARDS_DRAWN"
  | "KING_GAME_KING_REVEALED"
  | "KING_GAME_COMMAND_ISSUED"
  | "KING_GAME_ROUND_COMPLETE"
  | "KING_GAME_STATE_SYNC";

export interface WSMessage {
  type: WSEventType;
  eventId?: string;
  userId?: string;
  data?: any;
  timestamp: string;
}

// 事件创建
export interface EventCreatedData {
  eventId: string;
  userId: string;
  title: string;
  eventType: string;
  dateTime: string;
}

// 事件状态变更
export interface EventStatusChangedData {
  eventId: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  reason?: string;
}

// 匹配完成
export interface EventMatchedData {
  eventId: string;
  participants: Array<{
    userId: string;
    displayName: string;
    archetype: string;
  }>;
  matchQualityScore: number;
  restaurantName: string;
  restaurantAddress: string;
}

// 用户确认参与
export interface UserConfirmedData {
  eventId: string;
  userId: string;
  displayName: string;
  confirmedCount: number;
  totalParticipants: number;
}

// 匹配进度更新
export interface MatchProgressUpdateData {
  eventId: string;
  progress: number;
  etaMinutes: number | null;
  currentParticipants: number;
}

// 管理员操作
export interface AdminActionData {
  eventId: string;
  action: string;
  adminId: string;
  details?: any;
}

// 活动池匹配完成
export interface PoolMatchedData {
  poolId: string;
  poolTitle: string;
  groupId: string;
  groupNumber: number;
  matchScore: number;
  memberCount: number;
  temperatureLevel: string; // fire | warm | mild | cold
}

// ============ 破冰流程事件数据 ============

// 加入破冰会话
export interface IcebreakerJoinSessionData {
  sessionId: string;
  userId: string;
}

// 签到更新
export interface IcebreakerCheckinUpdateData {
  sessionId: string;
  checkedInCount: number;
  expectedAttendees: number;
  checkins: Array<{
    userId: string;
    displayName: string;
    archetype: string | null;
    numberPlate: number | null;
  }>;
}

// 流程阶段变更
export interface IcebreakerPhaseChangeData {
  sessionId: string;
  phase: 'waiting' | 'checkin' | 'number_assign' | 'icebreaker' | 'ended';
  previousPhase: string;
}

// 号码牌分配
export interface IcebreakerNumberAssignedData {
  sessionId: string;
  assignments: Array<{
    userId: string;
    displayName: string;
    numberPlate: number;
  }>;
}

// 准备就绪投票计数更新
export interface IcebreakerReadyCountUpdateData {
  sessionId: string;
  phase: string;
  readyCount: number;
  totalCount: number;
  readyRatio: number;
}

// 话题选择
export interface IcebreakerTopicSelectedData {
  sessionId: string;
  topicId: string;
  topicTitle: string;
  selectedBy: string;
}

// 游戏开始
export interface IcebreakerGameStartedData {
  sessionId: string;
  gameId: string;
  gameName: string;
  startedBy: string;
}

// 会话结束
export interface IcebreakerSessionEndedData {
  sessionId: string;
  aiClosingMessage?: string;
  duration: number;
}

// 用户离线/重连
export interface IcebreakerUserStatusData {
  sessionId: string;
  userId: string;
  displayName: string;
  isOnline: boolean;
}

// 频率限制
export interface RateLimitedData {
  message: string;
  retryAfterMs: number;
}

// ============ 国王游戏多设备同步事件数据 ============

// 加入国王游戏会话
export interface KingGameJoinData {
  sessionId: string;
  icebreakerSessionId: string;
  userId: string;
  displayName: string;
}

// 玩家加入通知
export interface KingGamePlayerJoinedData {
  sessionId: string;
  players: Array<{
    userId: string;
    displayName: string;
    isReady: boolean;
    isDealer: boolean;
  }>;
  playerCount: number;
  requiredPlayers: number;
}

// 玩家准备状态
export interface KingGamePlayerReadyData {
  sessionId: string;
  userId: string;
  isReady: boolean;
  readyCount: number;
  totalPlayers: number;
}

// 开始发牌
export interface KingGameStartDealData {
  sessionId: string;
  dealerId: string;
  dealerName: string;
  playerCount: number;
}

// 发牌（私密，每人只收到自己的牌）
export interface KingGameCardDealtData {
  sessionId: string;
  userId: string;
  cardNumber: number | null; // null = 国王牌
  isKing: boolean;
  drawnCount: number;
  totalPlayers: number;
}

// 所有人已抽牌（广播进度）
export interface KingGameAllCardsDrawnData {
  sessionId: string;
  drawnCount: number;
  totalPlayers: number;
  allDrawn: boolean;
}

// 国王揭晓（抽牌阶段结束后，所有人都知道谁是国王）
export interface KingGameKingRevealedData {
  sessionId: string;
  kingUserId: string;
  kingDisplayName: string;
  mysteryNumber: number | null; // 神秘牌号码（国王的号码），极端情况下可能为null
}

// 国王发号施令
export interface KingGameCommandIssuedData {
  sessionId: string;
  command: string;
  targetNumber: number;
  kingUserId: string;
}

// 回合完成
export interface KingGameRoundCompleteData {
  sessionId: string;
  roundNumber: number;
  targetNumber: number;
  executorUserId: string | null; // 执行者（如果能确定的话）
  command: string;
}

// 状态同步（用于重连或初始化）
export interface KingGameStateSyncData {
  sessionId: string;
  phase: 'waiting' | 'dealing' | 'commanding' | 'executing' | 'completed';
  playerCount: number;
  roundNumber: number;
  players: Array<{
    userId: string;
    displayName: string;
    isReady: boolean;
    hasDrawnCard: boolean;
    isDealer: boolean;
  }>;
  dealerId: string | null;
  kingUserId: string | null;
  mysteryNumber: number | null;
  currentCommand: string | null;
  targetNumber: number | null;
  myCardNumber: number | null; // 只有本人能看到自己的牌
  myIsKing: boolean;
}
