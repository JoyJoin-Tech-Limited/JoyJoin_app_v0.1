import Taro from '@tarojs/taro'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'
import {
  clearPaymentReturnContextStorage,
  clearPendingOrderStorage,
  readStoredPendingOrder,
} from './paymentPendingOrderStorage'

export interface OpenMiniProgramPaymentPageOptions {
  currentUserId?: string | null
  preserveReturnContext?: boolean
  returnTab?: string
}

export interface OpenEventTicketPaymentPageOptions {
  poolId: string
  currentUserId?: string | null
}

/** Navigate to the event ticket payment page for single-event registration payment. */
export async function openEventTicketPaymentPage({
  poolId,
  currentUserId,
}: OpenEventTicketPaymentPageOptions): Promise<void> {
  const pendingOrder = readStoredPendingOrder({ currentUserId })
  if (pendingOrder.status === 'clear') {
    clearPendingOrderStorage()
  }

  await Taro.navigateTo({
    url: `${MINI_PROGRAM_ROUTES.eventTicketPayment}?poolId=${encodeURIComponent(poolId)}`,
  })
}

/** Always navigates to the payment page. When payments are disabled,
  the page handles its own graceful disabled-state UI including
  pending-order resumption and registration return-context cards. */
export async function openMiniProgramPaymentPage({
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

  const returnTabParam = returnTab ? `?returnTab=${encodeURIComponent(returnTab)}` : ''
  await Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.blindBoxPayment}${returnTabParam}` })
}
