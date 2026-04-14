import Taro from '@tarojs/taro'
import { MINI_PROGRAM_ROUTES } from './onboardingRoutes'
import type { MiniProgramPendingOrderLookupResult } from './paymentPendingOrder'
import { clearPendingOrderStorage, readStoredPendingOrder } from './paymentPendingOrderStorage'

export interface OpenMiniProgramPaymentPageOptions {
  paymentsEnabled?: boolean
  currentUserId?: string | null
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
}: OpenMiniProgramPaymentPageOptions): Promise<void> {
  const pendingOrder = readStoredPendingOrder({ currentUserId })

  if (pendingOrder.status === 'clear') {
    clearPendingOrderStorage()
  }

  const decision = decideMiniProgramPaymentEntry({
    paymentsEnabled,
    pendingOrder,
  })

  if (decision.action === 'block') {
    await Taro.showToast({
      title: '支付功能维护中，请稍后再试',
      icon: 'none',
      duration: 2400,
    })
    return
  }

  await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.blindBoxPayment })
}
