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
  | "SOCIAL_GROUP_BEAT"
  // Attendance status events
  | "ATTENDANCE_STATUS_UPDATED"
  // Gathering room (集结房间) presence events
  | "ROOM_PRESENCE_STATE"
  | "ROOM_MEMBER_ENTERED"
  | "ROOM_MEMBER_LEFT"
  | "ROOM_POKE";

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

// ============ S6 群体感官节拍 (Group-Synchronized Beats) ============

/** Beat pattern vocabulary — mirrors the S1 haptic grammar one-to-one
 *  (camelCase social-patterns minus the prefix). `your_turn`/`confirm` are
 *  personal/local patterns and are never emitted as group beats. */
export type SocialGroupBeatPattern = 'nudge' | 'reveal' | 'celebration';

/**
 * S6 group beat payload (server → room). STATE-FREE by ruling 6 (playbook
 * §10): pattern + dedupe nonce + server timestamp ONLY. The 3s poll remains
 * the sole state truth; a beat says "fire this pattern now", never "here is
 * state". `sessionId` is the room scope (the social session's
 * icebreakerSessionId — the same id clients joined with).
 */
export interface SocialGroupBeatData {
  sessionId: string;
  pattern: SocialGroupBeatPattern;
  nonce: string;
  /** Server epoch ms when the beat was emitted (skew measurement). */
  sentAt: number;
}

// ============ 集结房间 (Gathering Room) 事件数据 ============

/** Allowed poke emoji keys. Clients must render CSS/icon badges, never raw
 *  emoji glyphs (mini-program guardrail). */
export const ROOM_POKE_EMOJIS = ['wave', 'hi-five', 'drink'] as const;
export type RoomPokeEmoji = (typeof ROOM_POKE_EMOJIS)[number];

/** server → joining client: authoritative presence snapshot for the room.
 *  Sent immediately after USER_JOINED; always apply before entered/left. */
export interface RoomPresenceStateData {
  eventId: string;
  presentUserIds: string[];
}

/** server → room: a member entered the room (broadcast INCLUDES the entering
 *  user's own sockets — clients dedupe against the snapshot/state). */
export interface RoomMemberEnteredData {
  eventId: string;
  userId: string;
}

/** server → room: a member left (after the server-side 5s disconnect grace).
 *  Authoritative — remove immediately. */
export interface RoomMemberLeftData {
  eventId: string;
  userId: string;
}

/** client → server AND server → room: a poke from one member to another. */
export interface RoomPokeData {
  eventId: string;
  fromUserId: string;
  targetUserId: string;
  emoji: RoomPokeEmoji;
  ts: number;
}
