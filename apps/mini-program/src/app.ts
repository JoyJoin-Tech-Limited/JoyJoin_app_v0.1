import "./lib/abortControllerPolyfill"
import { PropsWithChildren, createElement, useCallback, useEffect, useRef } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { useAuth } from './hooks/useAuth'
import { logInfo, logWarn } from './lib/logger'
import { buildPaymentVerificationUrl, decidePendingOrderAutoResume } from './lib/paymentPendingOrder'
import { clearPendingOrderStorage, getPendingOrderStorageSnapshot } from './lib/paymentPendingOrderStorage'
import AuthProvider from './providers/AuthProvider'
import { DynamicAccentProvider } from './providers/DynamicAccentProvider'
import { AchievementProvider } from './providers/AchievementProvider'
import AchievementPopup from './components/AchievementPopup'
import { loadBrandFonts } from './lib/brandFont'
import './app.scss'

function PendingOrderResumeBridge() {
  const { isAuthenticated, isLoading, isRefreshing, user } = useAuth()
  const resumedOrderIdRef = useRef('')

  const maybeResumePendingOrder = useCallback(() => {
    const pages = Taro.getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route ?? ''
    const snapshot = getPendingOrderStorageSnapshot()
    const decision = decidePendingOrderAutoResume({
      authResolved: !isLoading && !isRefreshing,
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
  }, [isAuthenticated, isLoading, isRefreshing, user?.id])

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
    loadBrandFonts({
      // The full Alimama VF asset is too large for the WeChat main-package budget.
      // Mini-program builds fall back to the system display stack while keeping
      // the lightweight English brand face for numerals and short wordmarks.
      includeDisplayFont: process.env.TARO_ENV !== 'weapp',
    })
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
