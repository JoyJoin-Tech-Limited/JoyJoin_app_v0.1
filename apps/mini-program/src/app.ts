import "./lib/wechat/abortControllerPolyfill"
import { PropsWithChildren, createElement, useCallback, useEffect, useRef } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { useAuth } from './hooks/useAuth'
import { logInfo, logWarn } from './lib/utils/logger'
import { buildPaymentVerificationUrl, decidePendingOrderAutoResume } from './lib/payment/paymentPendingOrder'
import { clearPendingOrderStorage, getPendingOrderStorageSnapshot } from './lib/payment/paymentPendingOrderStorage'
import { authenticateMiniProgramUser, getUserState } from './lib/api/api'
import { seedMiniProgramAuthSession } from './lib/api/authSession'
import { useQueryClient } from '@tanstack/react-query'
import AuthProvider from './providers/AuthProvider'
import { DynamicAccentProvider } from './providers/DynamicAccentProvider'
import { AchievementProvider } from './providers/AchievementProvider'
import AchievementPopup from './components/AchievementPopup'
import './app.scss'
import { loadBrandFonts } from './lib/utils/brandFont'
import { useProfessionRetry } from './hooks/useProfessionRetry'
import { preloadCdnAssets, ARCHETYPE_GLYPH_ASSETS } from './hooks/usePreloadCdnIcons'
import { preloadImagesWithDiagnostics } from './lib/utils/imagePreload'
import { cdnAsset } from './lib/utils/cdnAssets'
import { ONBOARDING_CRITICAL_CDN_ASSETS } from './lib/utils/routePreloadAssets'

function AutoLoginBridge() {
  const { isAuthenticated, isLoading } = useAuth()
  const queryClient = useQueryClient()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (isLoading || attemptedRef.current) return
    if (isAuthenticated) return

    attemptedRef.current = true

    logInfo('[AutoLogin] Attempting silent auto-login for returning user')

    void authenticateMiniProgramUser()
      .then(() => getUserState())
      .then((userState) => {
        seedMiniProgramAuthSession(userState, queryClient)
        logInfo('[AutoLogin] Silent auto-login successful', { nextStep: userState.nextStep })
      })
      .catch((error) => {
        logInfo('[AutoLogin] Silent auto-login failed (expected for new users)', {
          message: error instanceof Error ? error.message : String(error),
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
    // Load brand font immediately — no delay. The guard in brandFont.ts
    // prevents double-load when individual screens also trigger it.
    // WeChat caches loaded fonts, so repeat opens are instant.
    loadBrandFonts()

    // Preload CDN-only archetype glyphs in the background so they are
    // warm when the user reaches profile / matching / results screens.
    void preloadCdnAssets(ARCHETYPE_GLYPH_ASSETS)

    // Preload critical onboarding assets (intro animation, mascot expressions)
    // at app launch so they're cached before the user enters the personality test.
    // Animated WebP cannot be bundled locally on iOS, so preloading is the only
    // way to achieve instant first paint.
    void preloadImagesWithDiagnostics(
      ONBOARDING_CRITICAL_CDN_ASSETS.map(cdnAsset),
      'app-launch:onboarding',
    )
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
        createElement(PendingOrderResumeBridge),
        createElement(ProfessionRetryBridge),
        createElement(AchievementPopup),
        children,
      ),
    ),
  )
}

export default App
