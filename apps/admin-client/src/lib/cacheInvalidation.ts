import { queryClient } from './queryClient';
import type { WSMessage } from '@/../../shared/wsEvents';

/**
 * 智能缓存失效系统
 * 根据WebSocket事件类型精确失效相关查询缓存
 */

export async function invalidateCacheForEvent(message: WSMessage) {
  const eventId = message.eventId;
  
  switch (message.type) {
    case 'EVENT_STATUS_CHANGED':
      // 失效活动相关的所有缓存
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events'] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/admin/events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/my-events'] }),
      ].filter(Boolean));
      break;
      
    case 'EVENT_MATCHED':
      // 失效活动和匹配相关缓存
      await Promise.all([
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events', eventId] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/admin/events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/my-events'] }),
      ].filter(Boolean));
      break;
      
    case 'USER_JOINED':
    case 'USER_LEFT':
      // 失效活动参与者相关缓存
      await Promise.all([
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events', eventId] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/admin/events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/my-events'] }),
      ].filter(Boolean));
      break;
      
    case 'EVENT_UPDATED':
      // 失效所有活动列表和匹配相关缓存
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/matching'] }),
      ]);
      break;
      
    case 'EVENT_CANCELED':
    case 'EVENT_COMPLETED':
      // 失效活动相关的所有缓存
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events'] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] }),
        eventId && queryClient.invalidateQueries({ queryKey: ['/api/admin/events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/my-events'] }),
      ].filter(Boolean));
      break;
      
    case 'ADMIN_ACTION':
      // 失效管理员相关缓存
      await invalidateAdminCache();
      break;
      
    default:
      console.warn('Unknown event type for cache invalidation:', message.type);
  }
}

/**
 * 失效管理员相关缓存
 */
export async function invalidateAdminCache() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/admin/finance/stats'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/admin/insights/stats'] }),
  ]);
}

/**
 * 失效用户活动缓存
 */
export async function invalidateUserEventsCache(userId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['/api/my-events'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/blind-box-events'] }),
  ]);
  
  if (userId) {
    await queryClient.invalidateQueries({ queryKey: ['/api/users', userId] });
  }
}
