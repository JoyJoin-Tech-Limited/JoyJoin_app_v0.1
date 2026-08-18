import { wsService } from './wsService';
import { eventPoolsRepo } from './repositories/eventPoolsRepo';
import { notificationsRepo } from './repositories/notificationsRepo';
import type {
  EventStatusChangedData,
  EventMatchedData,
  UserConfirmedData,
  MatchProgressUpdateData,
  AdminActionData,
  AttendanceStatusUpdatedData,
  PoolRegistrationAddedData,
} from '@shared/wsEvents';

/**
 * 广播活动状态变更事件
 */
export async function broadcastEventStatusChanged(
  eventId: string,
  oldStatus: string,
  newStatus: string,
  updatedBy: string,
  reason?: string
) {
  const data: EventStatusChangedData = {
    eventId,
    oldStatus,
    newStatus,
    updatedBy,
    reason,
  };

  // 推送给活动房间的所有用户
  wsService.broadcastToEvent(eventId, {
    type: 'EVENT_STATUS_CHANGED',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });

  // 如果状态变更是重要的，也创建notification
  if (shouldCreateNotification(oldStatus, newStatus)) {
    await createStatusChangeNotification(eventId, newStatus);
  }
}

/**
 * 广播活动匹配完成事件
 */
export async function broadcastEventMatched(
  eventId: string,
  participants: Array<{ userId: string; displayName: string; archetype: string }>,
  matchQualityScore: number,
  restaurantName: string,
  restaurantAddress: string
) {
  const data: EventMatchedData = {
    eventId,
    participants,
    matchQualityScore,
    restaurantName,
    restaurantAddress,
  };

  // 推送给活动房间的所有用户
  wsService.broadcastToEvent(eventId, {
    type: 'EVENT_MATCHED',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });

  // 推送给所有参与者（即使他们还没加入WebSocket房间）
  const userIds = participants.map(p => p.userId);
  wsService.broadcastToUsers(userIds, {
    type: 'EVENT_MATCHED',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });

  // 创建notification给所有参与者
  await Promise.all(
    userIds.map(userId =>
      notificationsRepo.createNotification({
        userId,
        category: 'activities',
        type: 'event_reminder',
        title: '排桌完成！',
        message: `您的活动已排桌完成，${participants.length}位参与者，地点：${restaurantName}`,
        relatedResourceId: eventId,
      })
    )
  );
}

/**
 * 广播用户确认参与事件
 */
export async function broadcastUserConfirmed(
  eventId: string,
  userId: string,
  displayName: string,
  confirmedCount: number,
  totalParticipants: number
) {
  const data: UserConfirmedData = {
    eventId,
    userId,
    displayName,
    confirmedCount,
    totalParticipants,
  };

  // 推送给活动房间的所有用户
  wsService.broadcastToEvent(eventId, {
    type: 'USER_CONFIRMED',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 广播匹配进度更新
 */
export async function broadcastMatchProgressUpdate(
  eventId: string,
  progress: number,
  etaMinutes: number | null,
  currentParticipants: number
) {
  const data: MatchProgressUpdateData = {
    eventId,
    progress,
    etaMinutes,
    currentParticipants,
  };

  // 推送给活动房间的所有用户
  wsService.broadcastToEvent(eventId, {
    type: 'MATCH_PROGRESS_UPDATE',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 广播管理员操作
 */
export async function broadcastAdminAction(
  eventId: string,
  action: string,
  adminId: string,
  details?: any
) {
  const data: AdminActionData = {
    eventId,
    action,
    adminId,
    details,
  };

  // 推送给活动房间的所有用户
  wsService.broadcastToEvent(eventId, {
    type: 'ADMIN_ACTION',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });

  // 某些管理员操作需要创建notification
  if (shouldNotifyUsers(action)) {
    await createAdminActionNotification(eventId, action, details);
  }
}

/**
 * 广播出席状态更新
 */
export function broadcastAttendanceStatusUpdated(
  eventId: string,
  userId: string,
  displayName: string,
  status: 'pending' | 'confirmed' | 'late' | 'absent',
  estimatedLateMinutes?: number,
  absentReason?: string,
) {
  const data: AttendanceStatusUpdatedData = {
    eventId,
    userId,
    displayName,
    status,
    estimatedLateMinutes,
    absentReason,
  };

  wsService.broadcastToEvent(eventId, {
    type: 'ATTENDANCE_STATUS_UPDATED',
    eventId,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastPoolRegistrationAdded(
  poolId: string,
  archetype: string | undefined,
  userId: string,
  totalRegistrations: number,
) {
  const data: PoolRegistrationAddedData = {
    poolId,
    archetype,
    userId,
    totalRegistrations,
  };

  wsService.broadcastToAll({
    type: 'POOL_REGISTRATION_ADDED',
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 判断状态变更是否需要创建notification
 */
function shouldCreateNotification(oldStatus: string, newStatus: string): boolean {
  const importantTransitions = [
    { from: 'pending_match', to: 'matched' },
    { from: 'matched', to: 'completed' },
    { from: '*', to: 'canceled' },
  ];

  return importantTransitions.some(
    t => (t.from === '*' || t.from === oldStatus) && t.to === newStatus
  );
}

/**
 * 创建状态变更notification
 */
async function createStatusChangeNotification(eventId: string, newStatus: string) {
  try {
    // 获取活动参与者
    const event = await eventPoolsRepo.getBlindBoxEventAdmin(eventId);
    if (!event || !event.matchedAttendees) return;

    const participants = (event.matchedAttendees as any[]).map((p: any) => p.userId);
    
    let title = '';
    let message = '';
    
    switch (newStatus) {
      case 'matched':
        title = '排桌完成！';
        message = '您的活动已排桌完成，查看详情了解更多';
        break;
      case 'completed':
        title = '活动已完成';
        message = '感谢参与！请为活动提供反馈';
        break;
      case 'canceled':
        title = '活动已取消';
        message = '很抱歉，活动已被取消';
        break;
      default:
        return;
    }

    // 创建notifications
    await Promise.all(
      participants.map((userId: string) =>
        notificationsRepo.createNotification({
          userId,
          category: 'activities',
          type: 'event_reminder',
          title,
          message,
          relatedResourceId: eventId,
        })
      )
    );
  } catch (error) {
    console.error('[EventBroadcast] Error creating status change notification:', error);
  }
}

/**
 * 判断管理员操作是否需要通知用户
 */
function shouldNotifyUsers(action: string): boolean {
  const notifiableActions = ['cancel_event', 'update_venue', 'update_time'];
  return notifiableActions.includes(action);
}

/**
 * 创建管理员操作notification
 */
async function createAdminActionNotification(
  eventId: string,
  action: string,
  details?: any
) {
  try {
    const event = await eventPoolsRepo.getBlindBoxEventAdmin(eventId);
    if (!event || !event.matchedAttendees) return;

    const participants = (event.matchedAttendees as any[]).map((p: any) => p.userId);
    
    let title = '';
    let message = '';
    
    switch (action) {
      case 'cancel_event':
        title = '活动已取消';
        message = details?.reason || '管理员取消了活动';
        break;
      case 'update_venue':
        title = '活动地点变更';
        message = `新地点：${details?.venueName || '待定'}`;
        break;
      case 'update_time':
        title = '活动时间变更';
        message = `新时间：${details?.newTime || '待定'}`;
        break;
      default:
        return;
    }

    await Promise.all(
      participants.map((userId: string) =>
        notificationsRepo.createNotification({
          userId,
          category: 'system',
          type: 'system_alert',
          title,
          message,
          relatedResourceId: eventId,
        })
      )
    );
  } catch (error) {
    console.error('[EventBroadcast] Error creating admin action notification:', error);
  }
}
