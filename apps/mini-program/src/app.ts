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
import { loadBrandDisplayFont } from './lib/utils/brandFont'

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
    // Defer font load so it does not compete with first paint.
    // The guard in brandFont.ts prevents double-load when LandingPage
    // (or any other screen) also calls it eagerly.
    setTimeout(() => loadBrandDisplayFont(), 100)
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
        createElement(AchievementPopup),
        children,
      ),
    ),
  )
}

export default App
