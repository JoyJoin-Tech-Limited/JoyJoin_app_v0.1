import { useState } from 'react'
import Taro from '@tarojs/taro'
import { authenticateMiniProgramUser, getUserState, type OnboardingStep } from '../lib/api'
import { logInfo, logError } from '../lib/logger'

/**
 * Maps the server-driven `nextStep` value to a mini-program page route.
 *
 * Onboarding pages (personality-test, essential-data, etc.) are not yet
 * built in the mini-program.  Until they exist, any step short of 'discover'
 * falls through to the discover landing so the user is never stranded.
 */
function nextStepToRoute(step: OnboardingStep): string {
  switch (step) {
    case 'discover':
      return '/pages/discover/index'
    // Onboarding pages (personality-test, essential-data, extended-data,
    // profile-review, guide) are not yet built in the mini-program.
    // Until they are added, all non-discover steps fall back to the
    // discover landing so the user is never left stranded.
    case 'onboarding':
    case 'personality-test':
    case 'essential-data':
    case 'extended-data':
    case 'profile-review':
    case 'guide':
    default:
      return '/pages/discover/index'
  }
}

/**
 * useWeChatLogin – Taro WeChat Mini Program login hook.
 *
 * Login flow (strictly mini-program only, no web OAuth redirect):
 *   1. Taro.login() → obtains a temporary code from the WeChat runtime.
 *   2. POST /api/auth/wechat/login → server calls code2Session, creates session.
 *   3. GET /api/auth/user → retrieve server-driven `nextStep`.
 *   4. Navigate to the route corresponding to `nextStep`.
 *
 * Returns { handleWeChatLogin, isLoggingIn }.
 */
export function useWeChatLogin() {
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  async function handleWeChatLogin() {
    if (isLoggingIn) return
    setIsLoggingIn(true)

    try {
      logInfo('[useWeChatLogin] Starting WeChat Mini Program login')

      await authenticateMiniProgramUser()

      const userState = await getUserState()
      const route = nextStepToRoute(userState.nextStep)

      logInfo('[useWeChatLogin] Login successful', { nextStep: userState.nextStep, route })

      Taro.reLaunch({ url: route })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '微信登录失败，请检查网络连接后重试'

      logError('[useWeChatLogin] Login failed', { message })

      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 3000,
      })
    } finally {
      setIsLoggingIn(false)
    }
  }

  return { handleWeChatLogin, isLoggingIn }
}
