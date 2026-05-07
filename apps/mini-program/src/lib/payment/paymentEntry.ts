import Taro from '@tarojs/taro'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'
import { TOAST_LONG_MS } from '../utils/uiConstants'
import type { MiniProgramPendingOrderLookupResult } from './paymentPendingOrder'
import {
  clearPaymentReturnContextStorage,
  clearPendingOrderStorage,
  readStoredPendingOrder,
} from './paymentPendingOrderStorage'

export interface OpenMiniProgramPaymentPageOptions {
  paymentsEnabled?: boolean
  currentUserId?: string | null
  preserveReturnContext?: boolean
  /** Tab to return to if navigateBack fails (e.g. 'discover', 'events', 'profile') */
  returnTab?: string
}

export type MiniProgramPaymentEntryDecision =
  | { action: 'open-payment-page' }
  | { action: 'block'; reason: 'payments-disabled' }

export function decideMiniProgramPaymentEntry(input: {
  paymentsEnabled?: boolean
  pendingOrder: MiniProgramPendingOrderLookupResult
}): MiniProgramPaymentEntryDecision {
  if (input.paymentsEnabled === false && input.pendingOrder.status !== 'ready') {
    return {
      action: 'block',
      reason: 'payments-disabled',
    }
  }

  return {
    action: 'open-payment-page',
  }
}

export async function openMiniProgramPaymentPage({
  paymentsEnabled,
  currentUserId,
  preserveReturnContext = false,
  returnTab,
}: OpenMiniProgramPaymentPageOptions): Promise<void> {
  const pendingOrder = readStoredPendingOrder({ currentUserId })

  if (pendingOrder.status === 'clear') {
    clearPendingOrderStorage()
  }

  if (!preserveReturnContext && pendingOrder.status !== 'ready') {
    clearPaymentReturnContextStorage()
  }

  const decision = decideMiniProgramPaymentEntry({
    paymentsEnabled,
    pendingOrder,
  })

  if (decision.action === 'block') {
    await Taro.showToast({
      title: '支付功能维护中，请稍后再试',
      icon: 'none',
      duration: TOAST_LONG_MS,
    })
    return
  }

  const returnTabParam = returnTab ? `?returnTab=${encodeURIComponent(returnTab)}` : ''
  await Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.blindBoxPayment}${returnTabParam}` })
}
