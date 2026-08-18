import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { useAuth } from '../../../../../hooks/useAuth'
import type { useOnboardingAnalytics } from '../../../../../hooks/onboarding/useOnboardingAnalytics'
import { authenticateMiniProgramUserWithTest, getUserState, type ApiError } from '../../../../../lib/api/api'
import { seedMiniProgramAuthSession } from '../../../../../lib/api/authSession'
import {
  clearAnonymousAssessmentStorage,
  readAnonymousAssessmentAnswers,
  readAnonymousAssessmentSession,
} from '../../../../../lib/auth/anonymousOnboarding'
import { navigateToMiniProgramNextStep } from '../../../../../lib/onboarding/onboardingNavigation'
import { logError, logInfo } from '../../../../../lib/utils/logger'
import { waitFor } from '../resultHelpers'

/**
 * R2-7 (2026-08-18): minimum branded-handoff dwell so a fast login never
 * flashes the transition overlay for a single frame.
 */
const LOGIN_HANDOFF_MIN_VISIBLE_MS = 1200

interface UseResultsLoginHandoffParams {
  auth: ReturnType<typeof useAuth>
  analytics: ReturnType<typeof useOnboardingAnalytics>
  queryClient: QueryClient
  displayArchetypeName: string
}

/**
 * Continue-CTA orchestration for the results page (extracted from index.tsx,
 * 2026-08-18 split): authenticated users go straight to nextStep; anonymous
 * users get the inline WeChat login + anonymous-answer import handshake with
 * the branded LoginHandoffOverlay (rendered by the page while isLoggingIn).
 */
export function useResultsLoginHandoff({
  auth,
  analytics,
  queryClient,
  displayArchetypeName,
}: UseResultsLoginHandoffParams) {
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  /** R2-7: inline login-failure message rendered above the continue CTA. */
  const [loginError, setLoginError] = useState('')

  const continueButtonLabel = isLoggingIn
    ? '登录中…'
    : auth.isLoading
      ? '检查登录状态中…'
      : auth.isAuthenticated
        ? '去看看你的局'
        : '微信登录，查看谁和你最搭'

  const handleContinue = useCallback(async () => {
    if (auth.isLoading || isLoggingIn) {
      return
    }

    logInfo('[PersonalityResults] Continue requested', {
      isAuthenticated: auth.isAuthenticated,
      nextStep: auth.nextStep,
    })

    if (auth.isAuthenticated) {
      await navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
      return
    }

    // Inline login: import anonymous answers + WeChat login, skip the auth-gate page.
    const answers = readAnonymousAssessmentAnswers()
    const anonymousSessionSnapshot = readAnonymousAssessmentSession()

    // Show explicit confirmation before silent WeChat login so users know auth is happening.
    const { confirm } = await Taro.showModal({
      title: '微信登录',
      content: '使用微信账号登录以保存你的氛围原型测试结果，并看看为你准备的局。',
      confirmText: '确认登录',
      cancelText: '取消',
    })
    if (!confirm) {
      analytics.interaction('login_prompt_dismissed', { primaryArchetype: displayArchetypeName })
      return
    }

    setLoginError('')
    setIsLoggingIn(true)
    const handoffStartedAt = Date.now()
    try {
      logInfo('[PersonalityResults] Importing anonymous assessment before login', {
        answerCount: answers.length,
        hasSessionId: !!anonymousSessionSnapshot?.sessionId,
      })

      await authenticateMiniProgramUserWithTest({
        testAnswers: answers,
        anonymousSessionId: anonymousSessionSnapshot?.sessionId ?? null,
      })

      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)
      clearAnonymousAssessmentStorage()

      logInfo('[PersonalityResults] Login successful', { nextStep: userState.nextStep })
      analytics.stepCompleted({
        action: 'login-handoff-success',
        answerCount: answers.length,
        nextStep: userState.nextStep ?? 'essential-data',
      })
      // R2-7: hold the branded handoff overlay for a minimum beat, then land
      // directly on the nextStep destination — no intermediate/transit frame.
      // isLoggingIn stays true through navigation, which also keeps the
      // authed-forward escape hatch above suspended (same discipline as
      // profile-review's isPageExiting around handleCeremonyComplete).
      await waitFor(Math.max(0, LOGIN_HANDOFF_MIN_VISIBLE_MS - (Date.now() - handoffStartedAt)))
      void Taro.showToast({ title: '登录成功，正在为你排桌…', icon: 'success', duration: 2000 })
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const typedError = error as ApiError | undefined
      const message =
        typedError?.statusCode === 401
          ? '微信授权已失效，请重新尝试'
          : typedError?.statusCode === 500
            ? '服务器有点忙，稍后再试'
            : error instanceof Error && error.message
              ? error.message
              : '登录没成功，检查下网络再试试'
      analytics.errorOccurred('login_handoff_failed', message)
      logError('[PersonalityResults] Login failed', { message })
      // R2-7: return to the pre-handshake state with a friendly inline retry
      // surface (FinalStage renders it above the continue CTA, which is the
      // retry action) — never strand the user on a toast alone.
      setLoginError(message)
    } finally {
      setIsLoggingIn(false)
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, displayArchetypeName, isLoggingIn, analytics, queryClient])

  return {
    isLoggingIn,
    loginError,
    continueButtonLabel,
    handleContinue,
  }
}
