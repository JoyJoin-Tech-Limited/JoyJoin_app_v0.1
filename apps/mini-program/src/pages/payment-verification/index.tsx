import { Button, View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { AUTH_QUERY_KEY } from '../../lib/authSession'
import { logWarn } from '../../lib/logger'
import {
  markPaymentReturnContextPaid,
  type MiniProgramPaymentReturnContext,
  type MiniProgramPoolRegistrationReturnContext,
  type MiniProgramPendingOrderClearReason,
  resolvePendingOrder,
} from '../../lib/paymentPendingOrder'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from '../../lib/onboardingRoutes'
import {
  getPaymentStatusDecision,
  getPaymentStatusErrorDecision,
  type MiniProgramPaymentVerificationState,
} from '../../lib/paymentVerificationStatus'
import {
  clearPendingOrderStorage,
  getPendingOrderStorageSnapshot,
  markPendingOrderManuallyLeft,
  persistPaymentReturnContext,
  readStoredPendingOrder,
} from '../../lib/paymentPendingOrderStorage'
import type { XiaoyueExpressionId } from '../../lib/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
import './index.scss'

// Poll for up to 20 seconds total so the user gets a fast answer without
// hammering the status endpoint after returning from the WeChat pay sheet.
const MAX_POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 2000

function getVerificationMascotExpression(status: MiniProgramPaymentVerificationState): XiaoyueExpressionId {
  switch (status) {
    case 'paid':
      return 'actionSuccess'
    case 'failed':
      return 'actionFailure'
    default:
      return 'paymentTrust'
  }
}

function isPoolRegistrationReturnContext(
  context: MiniProgramPaymentReturnContext | null | undefined,
): context is MiniProgramPoolRegistrationReturnContext {
  return Boolean(context && context.kind === 'pool-registration')
}

function buildPoolRegistrationUrl(poolId: string): string {
  return `/${MINI_PROGRAM_PAGE_PATHS.poolRegistration}?id=${encodeURIComponent(poolId)}`
}

function getVerificationMessage(
  status: MiniProgramPaymentVerificationState,
  context: MiniProgramPaymentReturnContext | null,
): string {
  if (!isPoolRegistrationReturnContext(context)) {
    switch (status) {
      case 'paid':
        return '支付已确认，正在为你发放权益...'
      case 'failed':
        return '支付未完成，请返回支付页重新发起支付。'
      case 'pending':
        return '暂时无法确认支付结果，你可以稍后回来继续确认订单状态。'
      case 'polling':
      default:
        return '正在确认支付结果...'
    }
  }

  switch (status) {
    case 'paid':
      return '支付已确认，正在带你回到报名页继续完成这场报名...'
    case 'failed':
      return '支付未完成，你刚才填写的偏好已经保留，返回后可以重新发起支付。'
    case 'pending':
      return '支付状态仍在同步中，你可以先回报名页，稍后继续确认这笔订单。'
    case 'polling':
    default:
      return '正在确认支付结果，确认后会自动带你回到报名页...'
  }
}

function getPendingOrderRecoveryMessage(reason: MiniProgramPendingOrderClearReason | 'missing'): string {
  switch (reason) {
    case 'expired':
      return '待确认订单已过期，请重新发起支付'
    case 'wrong-user':
      return '当前账号无法继续这笔待确认订单'
    case 'missing-order':
    case 'missing-context':
    case 'invalid-context':
    case 'missing':
    default:
      return '未找到有效的待确认订单'
  }
}

export default function PaymentVerificationPage() {
  const { user, isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<MiniProgramPaymentVerificationState>('polling')
  const [message, setMessage] = useState('正在确认支付结果...')
  const [attemptCount, setAttemptCount] = useState(0)
  const [returnContext, setReturnContext] = useState<MiniProgramPaymentReturnContext | null>(null)
  const isPollingRef = useRef(false)
  const isMountedRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incomingOrderIdRef = useRef('')

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  const invalidatePaidCaches = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'auth-user-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'coupons'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-blind-box-events'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration'] }),
    ])
  }, [queryClient])

  const navigateToPoolRegistration = useCallback(async (context: MiniProgramPoolRegistrationReturnContext) => {
    const targetUrl = buildPoolRegistrationUrl(context.poolId)
    const pages = Taro.getCurrentPages()
    const previousPoolRegistrationPage = pages[pages.length - 3]

    if (previousPoolRegistrationPage?.route === MINI_PROGRAM_PAGE_PATHS.poolRegistration) {
      try {
        await Taro.navigateBack({ delta: 2 })
        return
      } catch {
        // Fall through to a clean launch when the old stack is gone.
      }
    }

    await Taro.reLaunch({ url: targetUrl })
  }, [])

  const navigateAfterPaid = useCallback(async (nextReturnContext?: MiniProgramPaymentReturnContext | null) => {
    clearTimer()
    const pendingOrder = readStoredPendingOrder({ currentUserId: user?.id })
    const resolvedReturnContext =
      nextReturnContext ??
      (pendingOrder.status === 'ready' ? pendingOrder.context.returnContext ?? null : null)

    await invalidatePaidCaches()

    if (isPoolRegistrationReturnContext(resolvedReturnContext)) {
      persistPaymentReturnContext(markPaymentReturnContextPaid(resolvedReturnContext))
      clearPendingOrderStorage()
      await navigateToPoolRegistration(resolvedReturnContext)
      return
    }

    clearPendingOrderStorage()

    if (pendingOrder.status === 'ready' && pendingOrder.context.type === 'event') {
      Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
      return
    }

    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
  }, [clearTimer, invalidatePaidCaches, navigateToPoolRegistration, user?.id])

  const pollPaymentStatus = useCallback(async (
    targetOrderId: string,
    nextReturnContext: MiniProgramPaymentReturnContext | null,
    attempt = 1,
  ) => {
    if (!targetOrderId || isPollingRef.current) {
      return
    }

    isPollingRef.current = true
    setAttemptCount(attempt)

    try {
      const response = await apiRequest<{ status?: string }>({
        path: `/api/payments/status/${encodeURIComponent(targetOrderId)}`,
      })

      const decision = getPaymentStatusDecision({
        remoteStatus: response.status,
        attempt,
        maxAttempts: MAX_POLL_ATTEMPTS,
      })

      if (decision.clearPendingOrder) {
        clearPendingOrderStorage()
      }

      setStatus(decision.status)
      setMessage(getVerificationMessage(decision.status, nextReturnContext))

      if (decision.status === 'paid') {
        timeoutRef.current = setTimeout(() => {
          void navigateAfterPaid(nextReturnContext)
        }, 1200)
        return
      }

      if (!decision.shouldRetry) {
        return
      }

      timeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          return
        }
        isPollingRef.current = false
        void pollPaymentStatus(targetOrderId, nextReturnContext, attempt + 1)
      }, POLL_INTERVAL_MS)
      return
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '查询支付状态失败'
      const decision = getPaymentStatusErrorDecision({
        attempt,
        maxAttempts: MAX_POLL_ATTEMPTS,
      })

      setStatus(decision.status)
      setMessage(getVerificationMessage(decision.status, nextReturnContext))
      logWarn('Mini-program payment verification status query failed', {
        orderId: targetOrderId,
        attempt,
        message: nextMessage,
      })

      if (!decision.shouldRetry) {
        return
      }

      timeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          return
        }
        isPollingRef.current = false
        void pollPaymentStatus(targetOrderId, nextReturnContext, attempt + 1)
      }, POLL_INTERVAL_MS)
      return
    } finally {
      isPollingRef.current = false
    }
  }, [navigateAfterPaid])

  const bootstrap = useCallback((incomingOrderId?: string, currentUserId?: string) => {
    if (isPollingRef.current) {
      return
    }

    clearTimer()

    const snapshot = getPendingOrderStorageSnapshot()
    const resolvedPendingOrder = resolvePendingOrder({
      orderId:
        typeof incomingOrderId === 'string' && incomingOrderId.length > 0
          ? incomingOrderId
          : snapshot.orderId,
      context: snapshot.context,
      currentUserId,
    })

    if (resolvedPendingOrder.status !== 'ready') {
      if (resolvedPendingOrder.status === 'clear') {
        clearPendingOrderStorage()
        logWarn('Cleared invalid mini-program pending order on verification page', {
          reason: resolvedPendingOrder.reason,
          userId: currentUserId ?? null,
        })
      }

      const nextMessage = getPendingOrderRecoveryMessage(
        resolvedPendingOrder.status === 'clear' ? resolvedPendingOrder.reason : 'missing',
      )

      setOrderId('')
      setReturnContext(null)
      setStatus('failed')
      setMessage(nextMessage)
      void Taro.showToast({
        title: nextMessage,
        icon: 'none',
      })
      Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
      return
    }

    setOrderId(resolvedPendingOrder.orderId)
    setReturnContext(resolvedPendingOrder.context.returnContext ?? null)
    setStatus('polling')
    setMessage(getVerificationMessage('polling', resolvedPendingOrder.context.returnContext ?? null))
    void pollPaymentStatus(
      resolvedPendingOrder.orderId,
      resolvedPendingOrder.context.returnContext ?? null,
      1,
    )
  }, [clearTimer, pollPaymentStatus])

  useLoad((params) => {
    incomingOrderIdRef.current = typeof params?.outTradeNo === 'string' ? params.outTradeNo : ''
  })

  useEffect(() => {
    if (authLoading || !user?.id) {
      return
    }

    bootstrap(incomingOrderIdRef.current, user.id)
  }, [authLoading, bootstrap, user?.id])

  useDidShow(() => {
    if (authLoading || !user?.id) {
      return
    }

    if (status === 'polling') {
      bootstrap(orderId || incomingOrderIdRef.current, user.id)
      return
    }

    if (status === 'pending') {
      const pendingOrder = readStoredPendingOrder({ currentUserId: user.id })
      if (pendingOrder.status === 'ready' && pendingOrder.orderId === orderId) {
        bootstrap(orderId, user.id)
      }
    }
  })

  const handleLeavePendingOrder = useCallback(() => {
    clearTimer()
    markPendingOrderManuallyLeft()

    if (isPoolRegistrationReturnContext(returnContext)) {
      void navigateToPoolRegistration(returnContext)
      return
    }

    Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
  }, [clearTimer, navigateToPoolRegistration, returnContext])

  const registrationReturnContext = isPoolRegistrationReturnContext(returnContext)
    ? returnContext
    : null

  if (authLoading) {
    return (
      <View className='verification-page'>
        <View className='verification-page__card'>
          <Text className='verification-page__title'>加载中</Text>
          <Text className='verification-page__message'>正在校验登录状态…</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='verification-page'>
      <View className='verification-page__card'>
        <Text className='verification-page__title'>
          {registrationReturnContext ? '权益确认中' : '订单确认中'}
        </Text>

        {registrationReturnContext ? (
          <View className='verification-page__context'>
            <Text className='verification-page__context-kicker'>继续报名</Text>
            <Text className='verification-page__context-title'>
              {registrationReturnContext.poolTitle || '刚才那场活动'}
            </Text>
            <Text className='verification-page__context-copy'>
              支付确认后会回到报名页，你刚才填写的偏好也会一起带回去。
            </Text>
          </View>
        ) : null}

        <Image
          className='verification-page__mascot'
          mode='aspectFit'
          src={getXiaoyueExpressionAsset(getVerificationMascotExpression(status))}
        />

        <Text className='verification-page__message'>{message}</Text>

        {status === 'polling' ? (
          <View className='verification-page__spinner-wrap'>
            <View className='verification-page__spinner' />
            <Text className='verification-page__meta'>已查询 {attemptCount} / {MAX_POLL_ATTEMPTS} 次</Text>
          </View>
        ) : null}

        {status === 'paid' ? (
          <Button className='verification-page__button' onClick={() => void navigateAfterPaid(returnContext)}>
            {registrationReturnContext ? '回到报名页完成报名' : '进入我的权益'}
          </Button>
        ) : null}

        {status === 'pending' ? (
          <View className='verification-page__actions'>
            <Button className='verification-page__button' onClick={handleLeavePendingOrder}>
              {registrationReturnContext ? '先回报名页' : '先回我的页'}
            </Button>
            <Button
              className='verification-page__button verification-page__button--secondary'
              onClick={() => bootstrap(orderId, user?.id)}
            >
              继续查询
            </Button>
          </View>
        ) : null}

        {status === 'failed' ? (
          <View className='verification-page__actions'>
            <Button
              className='verification-page__button'
              onClick={() => Taro.navigateBack({ fail: () => Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.blindBoxPayment }) })}
            >
              {registrationReturnContext ? '重新支付并继续报名' : '重新支付'}
            </Button>
            <Button
              className='verification-page__button verification-page__button--secondary'
              onClick={() => {
                if (registrationReturnContext) {
                  void navigateToPoolRegistration(registrationReturnContext)
                  return
                }

                Taro.switchTab({ url: MINI_PROGRAM_ROUTES.profile })
              }}
            >
              {registrationReturnContext ? '返回报名页' : '返回我的页'}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  )
}
