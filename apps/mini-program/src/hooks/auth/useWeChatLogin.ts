import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import {
  authenticateMiniProgramUser,
  getUserState,
  type ApiError,
} from '../../lib/api/api'
import { seedMiniProgramAuthSession } from '../../lib/api/authSession'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { logInfo, logError } from '../../lib/utils/logger'
import { TOAST_FATAL_MS } from '../../lib/utils/uiConstants'

/**
 * useWeChatLogin – Taro WeChat Mini Program login hook.
 *
 * Login flow (strictly mini-program only, no web OAuth redirect):
 *   1. Taro.login() → obtains a temporary code from the WeChat runtime.
 *   2. POST /api/auth/wechat/login → server calls code2Session, creates session.
 *   3. GET /api/auth/user → retrieve server-driven `nextStep`.
 *   4. Seed the auth cache so protected routes do not keep stale guest state.
 *   5. Navigate via the shared onboarding helper so tab vs page routing stays correct.
 *
 * Returns { handleWeChatLogin, isLoggingIn }.
 */
export function useWeChatLogin() {
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const loginLockRef = useRef(false)
  const queryClient = useQueryClient()

  async function handleWeChatLogin() {
    if (loginLockRef.current) return
    loginLockRef.current = true
    setIsLoggingIn(true)

    try {
      logInfo('[useWeChatLogin] Starting WeChat Mini Program login')

      await authenticateMiniProgramUser()

      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)

      logInfo('[useWeChatLogin] Login successful', { nextStep: userState.nextStep })

      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
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
        duration: TOAST_FATAL_MS,
      })
    } finally {
      loginLockRef.current = false
      setIsLoggingIn(false)
    }
  }

  return { handleWeChatLogin, isLoggingIn }
}
