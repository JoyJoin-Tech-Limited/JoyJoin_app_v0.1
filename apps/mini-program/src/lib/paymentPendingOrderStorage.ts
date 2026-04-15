import Taro from '@tarojs/taro'
import {
  buildPendingOrderContext,
  resolvePaymentReturnContext,
  resolvePendingOrder,
  type MiniProgramPaymentReturnContext,
  type MiniProgramPaymentReturnContextLookupResult,
  type MiniProgramPendingOrderLookupResult,
} from './paymentPendingOrder'

export const MINI_PROGRAM_PENDING_ORDER_KEY = 'pending_order'
export const MINI_PROGRAM_PENDING_ORDER_CONTEXT_KEY = 'pending_order_context'
export const MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_KEY = 'payment_return_context'

export interface PendingOrderStorageSnapshot {
  orderId: string
  context: unknown
}

export function getPendingOrderStorageSnapshot(): PendingOrderStorageSnapshot {
  return {
    orderId: Taro.getStorageSync<string>(MINI_PROGRAM_PENDING_ORDER_KEY),
    context: Taro.getStorageSync(MINI_PROGRAM_PENDING_ORDER_CONTEXT_KEY),
  }
}

export function readStoredPendingOrder(options?: {
  currentUserId?: string | null
  now?: number
}): MiniProgramPendingOrderLookupResult {
  const snapshot = getPendingOrderStorageSnapshot()
  return resolvePendingOrder({
    orderId: snapshot.orderId,
    context: snapshot.context,
    currentUserId: options?.currentUserId,
    now: options?.now,
  })
}

export function readStoredPaymentReturnContext(options?: {
  currentUserId?: string | null
  now?: number
}): MiniProgramPaymentReturnContextLookupResult {
  return resolvePaymentReturnContext({
    context: Taro.getStorageSync(MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_KEY),
    currentUserId: options?.currentUserId,
    now: options?.now,
  })
}

export function persistPendingOrder(input: {
  orderId: string
  type?: string | null
  userId?: string | null
  returnContext?: MiniProgramPaymentReturnContext | null
  now?: number
}): void {
  const createdAt = input.now ?? Date.now()

  Taro.setStorageSync(MINI_PROGRAM_PENDING_ORDER_KEY, input.orderId)
  Taro.setStorageSync(
    MINI_PROGRAM_PENDING_ORDER_CONTEXT_KEY,
    buildPendingOrderContext(
      {
        orderId: input.orderId,
        type: input.type,
        userId: input.userId,
        createdAt,
        returnContext: input.returnContext,
      },
      createdAt,
    ),
  )
}

export function persistPaymentReturnContext(
  context: MiniProgramPaymentReturnContext,
): void {
  Taro.setStorageSync(MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_KEY, context)
}

export function markPendingOrderManuallyLeft(now = Date.now()): MiniProgramPendingOrderLookupResult {
  const pendingOrder = readStoredPendingOrder({ now })

  if (pendingOrder.status !== 'ready') {
    if (pendingOrder.status === 'clear') {
      clearPendingOrderStorage()
    }

    return pendingOrder
  }

  const nextContext = buildPendingOrderContext(
    {
      ...pendingOrder.context,
      manualLeave: true,
    },
    now,
  )

  Taro.setStorageSync(MINI_PROGRAM_PENDING_ORDER_KEY, pendingOrder.orderId)
  Taro.setStorageSync(MINI_PROGRAM_PENDING_ORDER_CONTEXT_KEY, nextContext)

  return {
    status: 'ready',
    orderId: pendingOrder.orderId,
    context: nextContext,
  }
}

export function clearPendingOrderStorage(): void {
  Taro.removeStorageSync(MINI_PROGRAM_PENDING_ORDER_KEY)
  Taro.removeStorageSync(MINI_PROGRAM_PENDING_ORDER_CONTEXT_KEY)
}

export function clearPaymentReturnContextStorage(): void {
  Taro.removeStorageSync(MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_KEY)
}
