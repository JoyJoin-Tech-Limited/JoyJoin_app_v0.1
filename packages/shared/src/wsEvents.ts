// WebSocket事件类型定义

export type WSEventType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_MATCHED"
  | "EVENT_STATUS_CHANGED"
  | "EVENT_COMPLETED"
  | "EVENT_CANCELED"
  | "POOL_MATCHED"
  | "EVENT_THEME_TITLE_REVEALED"
  | "POOL_REGISTRATION_ADDED"
  | "POOL_FULL"
  | "USER_JOINED"
  | "USER_CONFIRMED"
  | "USER_LEFT"
  | "MATCH_PROGRESS_UPDATE"
  | "ADMIN_ACTION"
  | "PING"
  | "PONG"
  | "RATE_LIMITED"
  // Social Icebreaker events
  | "SOCIAL_PHASE_CHANGED"
  | "SOCIAL_PULSE_UPDATE"
  | "SOCIAL_LIE_VOTE_UPDATE"
  | "SOCIAL_PHASE_ADVANCE"
  | "SOCIAL_PULSE_VOTE"
  | "SOCIAL_LIE_VOTE"
  // Attendance status events
  | "ATTENDANCE_STATUS_UPDATED";

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

// 盲盒主题揭晓
export interface EventThemeTitleRevealedData {
  poolId: string;
  groupId: string;
  eventThemeTitle: string;
  themeTagline: string;
  themeEmoji: string;
  themeHighlights: string[];
  themeVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
}

// 活动池新报名
export interface PoolRegistrationAddedData {
  poolId: string;
  archetype?: string;
  userId: string;
  totalRegistrations: number;
}

// 活动池满员
export interface PoolFullData {
  poolId: string;
  poolTitle: string;
  totalRegistrations: number;
  capacity: number;
}

// 频率限制
export interface RateLimitedData {
  message: string;
  retryAfterMs: number;
}

// ============ 社交破冰系统事件数据 ============

// 社交阶段变更 (server → client)
export interface SocialPhaseChangedData {
  sessionId: string;
  socialSessionId: string;
  phase: string;
  hostUserId: string;
  xiaoYueComment?: string;
}

// 脉冲检查更新 (server → client)
export interface SocialPulseUpdateData {
  socialSessionId: string;
  averageVibe: number;
  voteCount: number;
}

// 谎言投票更新 (server → client)
export interface SocialLieVoteUpdateData {
  socialSessionId: string;
  votes: Array<{ voterId: string; targetUserId: string; guessedStatementIndex: number }>;
  isRevealed: boolean;
  lieIndex?: number;
}

// 出席状态更新 (server → client)
export interface AttendanceStatusUpdatedData {
  eventId: string;
  userId: string;
  displayName: string;
  status: 'pending' | 'confirmed' | 'late' | 'absent';
  estimatedLateMinutes?: number | null;
  absentReason?: string | null;
}
