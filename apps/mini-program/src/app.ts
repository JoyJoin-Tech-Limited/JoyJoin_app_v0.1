/* eslint-disable import/first */
// Polyfill must execute before any library imports that may rely on AbortController.
import "./lib/wechat/abortControllerPolyfill"
import { PropsWithChildren, createElement, useCallback, useEffect, useRef } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
/* eslint-enable import/first */
import { useAuth } from './hooks/useAuth'
import { logInfo, logWarn } from './lib/utils/logger'
import { buildPaymentVerificationUrl, decidePendingOrderAutoResume } from './lib/payment/paymentPendingOrder'
import { clearPendingOrderStorage, getPendingOrderStorageSnapshot } from './lib/payment/paymentPendingOrderStorage'
import { authenticateMiniProgramUser, checkReturningMiniProgramWeChatUser, getUserState, type ApiError } from './lib/api/api'
import { seedMiniProgramAuthSession, isTransportApiError } from './lib/api/authSession'
import AuthProvider from './providers/AuthProvider'
import { DynamicAccentProvider } from './providers/DynamicAccentProvider'
import { AchievementProvider } from './providers/AchievementProvider'
import AchievementPopup from './components/AchievementPopup'
import TabBarStateBridge from './components/TabBarStateBridge'
import './app.scss'
import { loadBrandFonts } from './lib/utils/brandFont'
import { useProfessionRetry } from './hooks/useProfessionRetry'
import { preloadCdnAssets, ARCHETYPE_GLYPH_ASSETS } from './hooks/usePreloadCdnIcons'
import { preloadOnboardingAssets } from './lib/utils/onboardingPreload'

function AutoLoginBridge() {
  const { isAuthenticated, isLoading } = useAuth()
  const queryClient = useQueryClient()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (isLoading || attemptedRef.current) return
    if (isAuthenticated) return

    attemptedRef.current = true

    logInfo('[AutoLogin] Attempting silent auto-login for returning user')

    void checkReturningMiniProgramWeChatUser()
      .then(({ exists }) => {
        if (!exists) {
          // Brand-new users must stay in guest mode until they explicitly tap
          // the WeChat-login CTA on the personality-test result page. Silent
          // sign-up here would skip the slot animation, result page, and auth moment.
          logInfo('[AutoLogin] No existing WeChat user; staying guest for result-page login')
          return null
        }
        return authenticateMiniProgramUser().then(() => getUserState())
      })
      .then((userState) => {
        if (!userState) return
        seedMiniProgramAuthSession(userState, queryClient)
        logInfo('[AutoLogin] Silent auto-login successful', { nextStep: userState.nextStep })
      })
      .catch((error: ApiError | unknown) => {
        const isRetryable = isTransportApiError(error) || (error as ApiError)?.statusCode === 500
        if (isRetryable) {
          // Allow retry on next mount / foreground by resetting the guard.
          attemptedRef.current = false
          logWarn('[AutoLogin] Silent auto-login failed with retryable error', {
            message: error instanceof Error ? error.message : String(error),
            statusCode: (error as ApiError)?.statusCode,
          })
          return
        }

        logInfo('[AutoLogin] Silent auto-login failed (expected for new users)', {
          message: error instanceof Error ? error.message : String(error),
          statusCode: (error as ApiError)?.statusCode,
        })
      })
  }, [isAuthenticated, isLoading, queryClient])

  return null
}

function ProfessionRetryBridge() {
  const { user } = useAuth()
  useProfessionRetry(user)
  return null
}

function PendingOrderResumeBridge() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const resumedOrderIdRef = useRef('')

  const maybeResumePendingOrder = useCallback(() => {
    const pages = Taro.getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route ?? ''
    const snapshot = getPendingOrderStorageSnapshot()
    const decision = decidePendingOrderAutoResume({
      authResolved: !isLoading,
      isAuthenticated,
      currentRoute,
      currentUserId: user?.id,
      orderId: snapshot.orderId,
      context: snapshot.context,
    })

    if (decision.action === 'clear') {
      clearPendingOrderStorage()
      resumedOrderIdRef.current = ''
      logInfo('Cleared mini-program pending order state', {
        reason: decision.reason,
        currentRoute,
        userId: user?.id ?? null,
      })
      return
    }

    if (decision.action !== 'resume') {
      resumedOrderIdRef.current = ''
      return
    }

    if (resumedOrderIdRef.current === decision.orderId) {
      return
    }

    resumedOrderIdRef.current = decision.orderId
    const resumeUrl = buildPaymentVerificationUrl(decision.orderId)

    logInfo('Resuming mini-program payment verification', {
      orderId: decision.orderId,
      currentRoute,
      userId: user?.id ?? null,
    })

    Taro.navigateTo({
      url: resumeUrl,
      fail: () => {
        resumedOrderIdRef.current = ''
        logWarn('Falling back to redirect while resuming payment verification', {
          orderId: decision.orderId,
          currentRoute,
        })
        Taro.redirectTo({ url: resumeUrl })
      },
    })
  }, [isAuthenticated, isLoading, user?.id])

  useDidShow(() => {
    maybeResumePendingOrder()
  })

  useEffect(() => {
    maybeResumePendingOrder()
  }, [maybeResumePendingOrder])

  return null
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    logInfo('JoyJoin Mini Program launched')

    // Reset stale welcome-back "seen" flags so returning users (including
    // those who deleted and re-entered the mini-program) get another chance
    // to see the welcome-back screen and choose to restart onboarding.
    // WeChat storage persists across app deletion, so we use a TTL heuristic.
    try {
      const raw = Taro.getStorageSync('joyjoin_welcome_back_seen')
      if (raw != null) {
        const timestamp = typeof raw === 'number' ? raw : Number(raw)
        const oneWeek = 7 * 24 * 60 * 60 * 1000
        if (!Number.isNaN(timestamp) && Date.now() - timestamp > oneWeek) {
          Taro.removeStorageSync('joyjoin_welcome_back_seen')
          logInfo('[App] Reset stale welcome-back seen flag (older than 7 days)')
        }
      }
    } catch {
      // Storage failures are non-critical
    }

    // Load brand font immediately — no delay. The guard in brandFont.ts
    // prevents double-load when individual screens also trigger it.
    // WeChat caches loaded fonts, so repeat opens are instant.
    loadBrandFonts()

    // Preload CDN-only archetype glyphs in the background so they are
    // warm when the user reaches profile / matching / results screens.
    void preloadCdnAssets(ARCHETYPE_GLYPH_ASSETS)

    // Preload the full onboarding asset bundle in staggered tiers so every
    // raster the user may encounter (intro animation, test expressions,
    // personality emoji icons, archetype images, sprite sheets, ceremony hero)
    // is warm before first entrance. Weak networks are skipped automatically.
    void preloadOnboardingAssets()
  })

  return createElement(
    AuthProvider,
    null,
    createElement(
      DynamicAccentProvider,
      null,
      createElement(
        AchievementProvider,
        null,
        createElement(AutoLoginBridge),
        createElement(PendingOrderResumeBridge),
        createElement(ProfessionRetryBridge),
        createElement(AchievementPopup),
        createElement(TabBarStateBridge),
        children,
      ),
    ),
  )
}

export default App
