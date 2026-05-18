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

/**
 * All center button taps now route to the center hub page via switchTab.
 * The hub page renders the appropriate content based on user state.
 * This gives users predictable tab-like behavior (always switchTab).
 */
export function mapCenterDestinationToMiniProgramAction(
  destination: CenterTabDestination
): MiniProgramCenterAction {
  // Always route to the center hub page via switchTab for predictable tab behavior.
  return {
    kind: destination.kind,
    navigation: 'switchTab',
    url: MINI_PROGRAM_ROUTES.centerHub,
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