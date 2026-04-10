import { useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import {
  authenticateMiniProgramUser,
  getUserState,
  type ApiError,
  type OnboardingStep,
} from '../lib/api'
import { logInfo, logError } from '../lib/logger'

function nextStepToRoute(step: OnboardingStep): string {
  switch (step) {
    case 'onboarding':
      return '/pages/onboarding/onboarding/index'
    case 'personality-test':
      return '/pages/onboarding/personality-test/index'
    case 'essential-data':
      return '/pages/onboarding/essential-data/index'
    case 'extended-data':
      return '/pages/onboarding/extended-data/index'
    case 'profile-review':
      return '/pages/onboarding/profile-review/index'
    case 'discover':
      return '/pages/discover/index'
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
  const loginLockRef = useRef(false)

  async function handleWeChatLogin() {
    if (loginLockRef.current) return
    loginLockRef.current = true
    setIsLoggingIn(true)

    try {
      logInfo('[useWeChatLogin] Starting WeChat Mini Program login')

      await authenticateMiniProgramUser()

      const userState = await getUserState()
      const route = nextStepToRoute(userState.nextStep)

      logInfo('[useWeChatLogin] Login successful', { nextStep: userState.nextStep, route })

      Taro.reLaunch({ url: route })
    } catch (error) {
      const typedError = error as ApiError | undefined
      let message = error instanceof Error ? error.message : '微信登录失败，请检查网络连接后重试'

      if (typedError?.statusCode === 401) {
        message = '登录状态已失效，请重新使用微信登录'
      } else if (typedError?.statusCode === 500) {
        message = '服务器开小差了，请稍后重试'
      } else if (
        typedError?.statusCode &&
        typedError.statusCode >= 400 &&
        typedError.statusCode !== 401 &&
        typedError.statusCode !== 500 &&
        typedError.isGenericMessage
      ) {
        message = '微信登录失败，请检查网络连接后重试'
      }

      logError('[useWeChatLogin] Login failed', { message, statusCode: typedError?.statusCode })

      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 3000,
      })
    } finally {
      loginLockRef.current = false
      setIsLoggingIn(false)
    }
  }

  return { handleWeChatLogin, isLoggingIn }
}
