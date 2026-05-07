import {
  getCenterButtonLabel,
  resolveCenterTabDestination,
  shouldShowCenterButtonBadge,
  type CenterTabDestination,
  type CenterTabEvent,
  type CenterTabPoolRegistration,
} from '@joyjoin/shared/centerTabRouting'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

export const MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE = '/pages/center-tab-empty/index'
export const MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE = '/pages/pool-group-detail/index'

export interface MiniProgramCenterAction {
  kind: CenterTabDestination['kind']
  navigation: 'switchTab' | 'navigateTo'
  url: string
}

export interface MiniProgramCenterState {
  label: string
  showBadge: boolean
  action: MiniProgramCenterAction
}

export interface CustomTabBarSyncState {
  selected: number
  center: MiniProgramCenterState
}

export function mapCenterDestinationToMiniProgramAction(
  destination: CenterTabDestination
): MiniProgramCenterAction {
  switch (destination.kind) {
    case 'discover':
      return {
        kind: destination.kind,
        navigation: 'switchTab',
        url: MINI_PROGRAM_ROUTES.discover,
      }
    case 'empty':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE,
      }
    case 'matched-event':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `/pages/event-detail/index?id=${encodeURIComponent(destination.eventId)}`,
      }
    case 'matched-pool-unlocked':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `${MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE}?groupId=${encodeURIComponent(destination.groupId)}`,
      }
    case 'pending-registration':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `/pages/matching-status/index?registrationId=${encodeURIComponent(destination.registrationId)}`,
      }
    case 'matched-pool-future':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `/pages/squad-unboxing/index?groupId=${encodeURIComponent(destination.groupId)}`,
      }
    default:
      return {
        kind: 'discover',
        navigation: 'switchTab',
        url: MINI_PROGRAM_ROUTES.discover,
      }
  }
}

export function getMiniProgramCenterState(
  poolRegistrations?: CenterTabPoolRegistration[],
  events?: CenterTabEvent[],
  referenceTime = new Date()
): MiniProgramCenterState {
  const destination = resolveCenterTabDestination(poolRegistrations, events, referenceTime)

  return {
    label: getCenterButtonLabel(poolRegistrations, events, referenceTime),
    showBadge: shouldShowCenterButtonBadge(poolRegistrations, events),
    action: mapCenterDestinationToMiniProgramAction(destination),
  }
}