import Taro from '@tarojs/taro'
import type { OnboardingStep } from './api'
import { MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from './onboardingRoutes'

export type MiniProgramNavigationMode = 'replace' | 'root'
export type MiniProgramNavigationAction = 'switchTab' | 'redirectTo' | 'reLaunch'

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

export async function navigateToMiniProgramRoute(
  route: string,
  options?: {
    mode?: MiniProgramNavigationMode
    taro?: MiniProgramNavigator
  },
): Promise<void> {
  const navigator = options?.taro ?? Taro
  const action = getMiniProgramRouteNavigationAction(route, options?.mode)

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
  },
): Promise<void> {
  return navigateToMiniProgramRoute(nextStepToMiniProgramRoute(step), options)
}