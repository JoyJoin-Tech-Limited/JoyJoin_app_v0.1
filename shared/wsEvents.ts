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
  | "PONG";

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
