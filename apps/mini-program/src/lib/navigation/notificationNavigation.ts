import Taro from '@tarojs/taro'
import { getEventFeedbackState, getPoolGroupDetails, type NotificationListItem } from '@shared/api'
import { apiRequest, type ApiError } from '../api/api'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'
import { logWarn } from '../utils/logger'
import { showAppToast } from '../utils/toast'

export type NotificationDestination =
  | { method: 'navigateTo'; url: string }
  | { method: 'switchTab'; url: string }

type NotificationNavigationResource = Pick<NotificationListItem, 'type' | 'relatedResourceId'>

const MAPPED_NOTIFICATION_TYPES = new Set([
  'match_success',
  'venue_tbd',
  'feedback_invite',
  'mutual_match',
  'event_reminder',
  'pool_full',
  'subscription_activated',
  'subscription_expiring',
  'subscription_expired',
])

function eventDetailDestination(resourceId: string): NotificationDestination {
  return {
    method: 'navigateTo',
    url: `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(resourceId)}`,
  }
}

function poolGroupDetailDestination(groupId: string): NotificationDestination {
  return {
    method: 'navigateTo',
    url: `${MINI_PROGRAM_ROUTES.poolGroupDetail}?groupId=${encodeURIComponent(groupId)}`,
  }
}

function getApiErrorStatusCode(error: unknown): number | undefined {
  return error instanceof Error ? (error as ApiError).statusCode : undefined
}

function isApiErrorWithStatus(error: unknown, statusCode: number): error is ApiError {
  return error instanceof Error && getApiErrorStatusCode(error) === statusCode
}

/** Only rows with verified resource semantics receive an interactive affordance. */
export function canNavigateNotification(item: NotificationNavigationResource): boolean {
  return (
    MAPPED_NOTIFICATION_TYPES.has(item.type) &&
    typeof item.relatedResourceId === 'string' &&
    item.relatedResourceId.trim().length > 0
  )
}

/**
 * Resolve a notification without guessing a destination for unknown types.
 * Feedback state is server-owned: only `open` may enter the form; every other
 * outcome (including lookup failure) safely lands on the event detail instead.
 */
export async function resolveNotificationDestination(
  item: NotificationNavigationResource,
): Promise<NotificationDestination | null> {
  if (!canNavigateNotification(item)) return null
  const resourceId = item.relatedResourceId as string

  switch (item.type) {
    case 'match_success':
      return poolGroupDetailDestination(resourceId)
    case 'venue_tbd':
      try {
        await getPoolGroupDetails(apiRequest, resourceId)
        return poolGroupDetailDestination(resourceId)
      } catch (error) {
        // Legacy persisted rows carried poolId; only an unknown group (404)
        // proves that legacy interpretation. Every other failure stays unread.
        if (isApiErrorWithStatus(error, 404)) return eventDetailDestination(resourceId)
        throw error
      }
    case 'feedback_invite': {
      let feedbackState: string | undefined
      try {
        const response = await getEventFeedbackState(apiRequest, resourceId)
        feedbackState = response.state
      } catch {
        feedbackState = undefined
      }
      if (feedbackState !== 'open') return eventDetailDestination(resourceId)
      return {
        method: 'navigateTo',
        url: `/${MINI_PROGRAM_PAGE_PATHS.eventFeedback}?id=${encodeURIComponent(resourceId)}`,
      }
    }
    case 'mutual_match':
      return { method: 'switchTab', url: MINI_PROGRAM_ROUTES.connections }
    case 'event_reminder':
    case 'pool_full':
      return eventDetailDestination(resourceId)
    case 'subscription_activated':
    case 'subscription_expiring':
    case 'subscription_expired':
      return { method: 'navigateTo', url: MINI_PROGRAM_ROUTES.rewards }
    default:
      return null
  }
}

/** Returns true only after WeChat accepts the navigation; false keeps the row unread. */
export async function navigateFromNotification(
  item: NotificationNavigationResource,
): Promise<boolean> {
  let destination: NotificationDestination | null
  try {
    destination = await resolveNotificationDestination(item)
  } catch (error) {
    logWarn('[Navigation] notification destination resolution failed', {
      notificationType: item.type,
      statusCode: getApiErrorStatusCode(error),
    })
    showAppToast({ title: '暂时无法打开，请稍后重试', icon: 'none' })
    return false
  }

  if (!destination) return false

  try {
    if (destination.method === 'switchTab') {
      await Taro.switchTab({ url: destination.url })
    } else {
      await Taro.navigateTo({ url: destination.url })
    }
    return true
  } catch {
    showAppToast({ title: '跳转失败，请重试', icon: 'none' })
    return false
  }
}
