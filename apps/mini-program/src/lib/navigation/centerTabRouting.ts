import {
  getCenterButtonLabel,
  resolveCenterTabDestination,
  shouldShowCenterButtonBadge,
  type CenterTabDestination,
  type CenterTabEvent,
  type CenterTabPoolRegistration,
} from '@joyjoin/shared/centerTabRouting'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

export const MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE = '/pages/pool-group-detail/index'
export const MINI_PROGRAM_EVENT_DETAIL_ROUTE = '/pages/event-detail/index'
export const MINI_PROGRAM_DISCOVER_ROUTE = '/pages/discover/index'

/**
 * Kill switch for the contextual center CTA. When false the button falls back
 * to the old behaviour (always the center-hub tab), which stays reachable
 * either way. Kept as a source constant rather than a DB flag because the
 * decision is entirely client-side routing with no server payload.
 */
export const CENTER_CONTEXTUAL_ROUTING_ENABLED = true

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
  // NOTE: `selected` is deliberately NOT part of syncState. Selection is route
  // truth published once per page show by useCustomTabBarSync; letting it ride
  // along with data updates lets a hidden page repaint the visible page's
  // highlight (and the native component would ignore it anyway).
  center: MiniProgramCenterState
}

/**
 * Maps the resolved destination to an actual tap outcome.
 *
 * The destination was always computed and then discarded in favour of the hub,
 * which duplicates 足迹 — two answers to "where is my event", neither becoming
 * reflex. Now the center button lands on the thing itself and never on a list.
 *
 * `pending-registration` intentionally stays on the hub: the matching-status
 * route's parameter contract is unverified, and a broken deep link is worse
 * than a hub that already renders 排桌中 honestly.
 */
export function mapCenterDestinationToMiniProgramAction(
  destination: CenterTabDestination
): MiniProgramCenterAction {
  if (!CENTER_CONTEXTUAL_ROUTING_ENABLED) {
    return {
      kind: destination.kind,
      navigation: 'switchTab',
      url: MINI_PROGRAM_ROUTES.centerHub,
    }
  }

  switch (destination.kind) {
    case 'matched-event':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `${MINI_PROGRAM_EVENT_DETAIL_ROUTE}?id=${encodeURIComponent(destination.eventId)}`,
      }
    case 'matched-pool-unlocked':
    case 'matched-pool-future':
      return {
        kind: destination.kind,
        navigation: 'navigateTo',
        url: `${MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE}?id=${encodeURIComponent(destination.groupId)}`,
      }
    case 'pending-registration':
      return {
        kind: destination.kind,
        navigation: 'switchTab',
        url: MINI_PROGRAM_ROUTES.centerHub,
      }
    case 'discover':
    case 'empty':
      return {
        kind: destination.kind,
        navigation: 'switchTab',
        url: MINI_PROGRAM_DISCOVER_ROUTE,
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