import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  },
}))

import { decideMiniProgramPaymentEntry } from './paymentEntry'
import { buildPendingOrderContext } from './paymentPendingOrder'

const NOW = 1_710_000_000_000

describe('mini-program payment entry gating', () => {
  // Guards against regression: users must still be able to reopen the
  // payment page and resume their own pending order while new payments are off.
  it('allows payment-page entry for a resumable pending order even when payments are disabled', () => {
    expect(
      decideMiniProgramPaymentEntry({
        paymentsEnabled: false,
        pendingOrder: {
          status: 'ready',
          orderId: 'order-123',
          context: buildPendingOrderContext({
            orderId: 'order-123',
            type: 'event_bundle',
            userId: 'user-123',
            createdAt: NOW,
          }, NOW),
        },
      }),
    ).toEqual({
      action: 'open-payment-page',
    })
  })

  it('blocks entry when payments are disabled and no resumable order exists', () => {
    expect(
      decideMiniProgramPaymentEntry({
        paymentsEnabled: false,
        pendingOrder: { status: 'missing' },
      }),
    ).toEqual({
      action: 'block',
      reason: 'payments-disabled',
    })
  })

  it('blocks disabled entry for invalid pending-order state that should be cleared', () => {
    expect(
      decideMiniProgramPaymentEntry({
        paymentsEnabled: false,
        pendingOrder: {
          status: 'clear',
          reason: 'wrong-user',
        },
      }),
    ).toEqual({
      action: 'block',
      reason: 'payments-disabled',
    })
  })
})
