import Taro from '@tarojs/taro'
import type { OnboardingStep } from '../api/api'
import { MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from './onboardingRoutes'

export type MiniProgramNavigationMode = 'replace' | 'root'
export type MiniProgramNavigationAction = 'switchTab' | 'redirectTo' | 'reLaunch'
export const MINI_PROGRAM_ROUTE_TRANSITION_DELAY_MS = 220

export interface MiniProgramRouteTransition {
  beforeNavigate?: () => Promise<unknown> | unknown
  delayMs?: number
}

export interface MiniProgramNavigator {
  switchTab(options: { url: string }): Promise<unknown> | unknown
  redirectTo(options: { url: string }): Promise<unknown> | unknown
  reLaunch(options: { url: string }): Promise<unknown> | unknown
}

const MINI_PROGRAM_TAB_ROUTES = new Set<string>([
  MINI_PROGRAM_ROUTES.discover,
  MINI_PROGRAM_ROUTES.events,
  MINI_PROGRAM_ROUTES.connections,
  MINI_PROGRAM_ROUTES.profile,
])

export function getMiniProgramRouteNavigationAction(
  route: string,
  mode: MiniProgramNavigationMode = 'replace',
): MiniProgramNavigationAction {
  if (MINI_PROGRAM_TAB_ROUTES.has(route)) {
    return 'switchTab'
  }

  return mode === 'root' ? 'reLaunch' : 'redirectTo'
}

function waitForTransitionDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export async function runMiniProgramRouteTransition(
  transition?: MiniProgramRouteTransition,
): Promise<void> {
  if (!transition) {
    return
  }

  await Promise.resolve(transition.beforeNavigate?.())

  const delayMs = transition.delayMs ?? MINI_PROGRAM_ROUTE_TRANSITION_DELAY_MS
  if (delayMs > 0) {
    await waitForTransitionDelay(delayMs)
  }
}

export async function navigateToMiniProgramRoute(
  route: string,
  options?: {
    mode?: MiniProgramNavigationMode
    taro?: MiniProgramNavigator
    transition?: MiniProgramRouteTransition
  },
): Promise<void> {
  const navigator = options?.taro ?? Taro
  const action = getMiniProgramRouteNavigationAction(route, options?.mode)

  await runMiniProgramRouteTransition(options?.transition)

  switch (action) {
    case 'switchTab':
      await Promise.resolve(navigator.switchTab({ url: route }))
      return
    case 'reLaunch':
      await Promise.resolve(navigator.reLaunch({ url: route }))
      return
    default:
      await Promise.resolve(navigator.redirectTo({ url: route }))
  }
}

export function navigateToMiniProgramNextStep(
  step: OnboardingStep | string | undefined,
  options?: {
    mode?: MiniProgramNavigationMode
    taro?: MiniProgramNavigator
    transition?: MiniProgramRouteTransition
  },
): Promise<void> {
  return navigateToMiniProgramRoute(nextStepToMiniProgramRoute(step), options)
}

/**
 * Mark the welcome-back screen as seen so returning users don't show it again.
 * Persists via Taro storage; server-side tracking is handled by the auth endpoint.
 */
export function markWelcomeBackScreenSeen(): void {
  try {
    Taro.setStorageSync('joyjoin_welcome_back_seen', Date.now())
  } catch {
    // Storage write failure is non-critical
  }
}