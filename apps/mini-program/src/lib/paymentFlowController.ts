import { useCallback, useEffect, useRef, useState } from 'react'
import {
  markPaymentReturnContextPaid,
  resolvePendingOrder,
  type MiniProgramPaymentReturnContext,
  type MiniProgramPendingOrderClearReason,
  type MiniProgramPoolRegistrationReturnContext,
} from './paymentPendingOrder'
import {
  clearPendingOrderStorage,
  getPendingOrderStorageSnapshot,
  markPendingOrderManuallyLeft,
  persistPaymentReturnContext,
  readStoredPendingOrder,
} from './paymentPendingOrderStorage'
import {
  getPaymentStatusDecision,
  getPaymentStatusErrorDecision,
  type MiniProgramPaymentVerificationState,
} from './paymentVerificationStatus'

const MAX_POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 2000
const PAID_TRANSITION_DELAY_MS = 1200

interface MiniProgramPaymentStatusResponse {
  status?: string
}

type MiniProgramPaymentNavigationTarget =
  | { kind: 'pool-registration'; context: MiniProgramPoolRegistrationReturnContext }
  | { kind: 'events' }
  | { kind: 'profile' }

interface UseMiniProgramPaymentFlowControllerOptions {
  authLoading: boolean
  currentUserId?: string
  incomingOrderId: string
  fetchPaymentStatus: (orderId: string) => Promise<MiniProgramPaymentStatusResponse>
  invalidatePaidCaches: () => Promise<void>
  onMissingPendingOrder: (message: string) => void
  navigateToPoolRegistration: (
    context: MiniProgramPoolRegistrationReturnContext,
  ) => Promise<void> | void
  navigateToEvents: () => Promise<void> | void
  navigateToProfile: () => Promise<void> | void
}

interface UseMiniProgramPaymentFlowControllerResult {
  orderId: string
  status: MiniProgramPaymentVerificationState
  message: string
  attemptCount: number
  returnContext: MiniProgramPaymentReturnContext | null
  bootstrap: (requestedOrderId?: string) => void
  handleDidShow: () => void
  handleLeavePendingOrder: () => void
  navigateAfterPaid: () => Promise<void>
}

export function isPoolRegistrationReturnContext(
  context: MiniProgramPaymentReturnContext | null | undefined,
): context is MiniProgramPoolRegistrationReturnContext {
  return Boolean(context && context.kind === 'pool-registration')
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

function getPendingOrderRecoveryMessage(
  reason: MiniProgramPendingOrderClearReason | 'missing',
): string {
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

export function useMiniProgramPaymentFlowController({
  authLoading,
  currentUserId,
  incomingOrderId,
  fetchPaymentStatus,
  invalidatePaidCaches,
  onMissingPendingOrder,
  navigateToPoolRegistration,
  navigateToEvents,
  navigateToProfile,
}: UseMiniProgramPaymentFlowControllerOptions): UseMiniProgramPaymentFlowControllerResult {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<MiniProgramPaymentVerificationState>('polling')
  const [message, setMessage] = useState('正在确认支付结果...')
  const [attemptCount, setAttemptCount] = useState(0)
  const [returnContext, setReturnContext] = useState<MiniProgramPaymentReturnContext | null>(null)
  const isPollingRef = useRef(false)
  const isMountedRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const navigateWithTarget = useCallback(
    async (target: MiniProgramPaymentNavigationTarget) => {
      switch (target.kind) {
        case 'pool-registration':
          await navigateToPoolRegistration(target.context)
          return
        case 'events':
          await navigateToEvents()
          return
        case 'profile':
        default:
          await navigateToProfile()
      }
    },
    [navigateToEvents, navigateToPoolRegistration, navigateToProfile],
  )

  const resolvePaidNavigationTarget = useCallback(
    (
      nextReturnContext?: MiniProgramPaymentReturnContext | null,
    ): MiniProgramPaymentNavigationTarget => {
      const pendingOrder = readStoredPendingOrder({ currentUserId })
      const resolvedReturnContext =
        nextReturnContext ??
        (pendingOrder.status === 'ready' ? pendingOrder.context.returnContext ?? null : null)

      if (isPoolRegistrationReturnContext(resolvedReturnContext)) {
        persistPaymentReturnContext(markPaymentReturnContextPaid(resolvedReturnContext))
        clearPendingOrderStorage()
        return {
          kind: 'pool-registration',
          context: resolvedReturnContext,
        }
      }

      clearPendingOrderStorage()

      if (pendingOrder.status === 'ready' && pendingOrder.context.type === 'event') {
        return { kind: 'events' }
      }

      return { kind: 'profile' }
    },
    [currentUserId],
  )

  const navigateAfterPaid = useCallback(async () => {
    clearTimer()
    await invalidatePaidCaches()
    await navigateWithTarget(resolvePaidNavigationTarget(returnContext))
  }, [clearTimer, invalidatePaidCaches, navigateWithTarget, resolvePaidNavigationTarget, returnContext])

  const pollPaymentStatus = useCallback(
    async (
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
        const response = await fetchPaymentStatus(targetOrderId)

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
            void (async () => {
              await invalidatePaidCaches()
              await navigateWithTarget(resolvePaidNavigationTarget(nextReturnContext))
            })()
          }, PAID_TRANSITION_DELAY_MS)
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
      } catch (_error) {
        const decision = getPaymentStatusErrorDecision({
          attempt,
          maxAttempts: MAX_POLL_ATTEMPTS,
        })

        setStatus(decision.status)
        setMessage(getVerificationMessage(decision.status, nextReturnContext))

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
      } finally {
        isPollingRef.current = false
      }
    },
    [fetchPaymentStatus, invalidatePaidCaches, navigateWithTarget, resolvePaidNavigationTarget],
  )

  const bootstrap = useCallback(
    (requestedOrderId?: string) => {
      if (!currentUserId || authLoading || isPollingRef.current) {
        return
      }

      clearTimer()

      const snapshot = getPendingOrderStorageSnapshot()
      const resolvedPendingOrder = resolvePendingOrder({
        orderId: requestedOrderId || incomingOrderId || snapshot.orderId,
        context: snapshot.context,
        currentUserId,
      })

      if (resolvedPendingOrder.status !== 'ready') {
        if (resolvedPendingOrder.status === 'clear') {
          clearPendingOrderStorage()
        }

        const nextMessage = getPendingOrderRecoveryMessage(
          resolvedPendingOrder.status === 'clear' ? resolvedPendingOrder.reason : 'missing',
        )

        setOrderId('')
        setReturnContext(null)
        setStatus('failed')
        setMessage(nextMessage)
        onMissingPendingOrder(nextMessage)
        return
      }

      setOrderId(resolvedPendingOrder.orderId)
      setReturnContext(resolvedPendingOrder.context.returnContext ?? null)
      setStatus('polling')
      setMessage(
        getVerificationMessage('polling', resolvedPendingOrder.context.returnContext ?? null),
      )
      void pollPaymentStatus(
        resolvedPendingOrder.orderId,
        resolvedPendingOrder.context.returnContext ?? null,
        1,
      )
    },
    [authLoading, clearTimer, currentUserId, incomingOrderId, onMissingPendingOrder, pollPaymentStatus],
  )

  useEffect(() => {
    if (authLoading || !currentUserId) {
      return
    }

    bootstrap()
  }, [authLoading, bootstrap, currentUserId])

  const handleDidShow = useCallback(() => {
    if (authLoading || !currentUserId) {
      return
    }

    if (status === 'polling') {
      bootstrap(orderId || incomingOrderId)
      return
    }

    if (status === 'pending') {
      const pendingOrder = readStoredPendingOrder({ currentUserId })
      if (pendingOrder.status === 'ready' && pendingOrder.orderId === orderId) {
        bootstrap(orderId)
      }
    }
  }, [authLoading, bootstrap, currentUserId, incomingOrderId, orderId, status])

  const handleLeavePendingOrder = useCallback(() => {
    clearTimer()
    markPendingOrderManuallyLeft()

    if (isPoolRegistrationReturnContext(returnContext)) {
      void navigateToPoolRegistration(returnContext)
      return
    }

    void navigateToProfile()
  }, [clearTimer, navigateToPoolRegistration, navigateToProfile, returnContext])

  return {
    orderId,
    status,
    message,
    attemptCount,
    returnContext,
    bootstrap,
    handleDidShow,
    handleLeavePendingOrder,
    navigateAfterPaid,
  }
}