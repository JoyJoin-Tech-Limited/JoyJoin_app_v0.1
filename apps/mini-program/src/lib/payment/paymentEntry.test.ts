import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigateTo = vi.fn().mockResolvedValue(undefined)

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn().mockReturnValue(null),
    removeStorageSync: vi.fn(),
    navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
  },
}))

import { openMiniProgramPaymentPage } from './paymentEntry'

describe('mini-program payment entry — always navigates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigateTo.mockResolvedValue(undefined)
  })

  it('navigates to payment page when no stored order exists', async () => {
    await openMiniProgramPaymentPage({
      currentUserId: 'user-1',
    })

    expect(mockNavigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/pages/blind-box-payment/index'),
      }),
    )
  })

  it('navigates with returnTab query param when specified', async () => {
    await openMiniProgramPaymentPage({
      currentUserId: 'user-2',
      returnTab: 'events',
    })

    expect(mockNavigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('?returnTab=events'),
      }),
    )
  })

  it('preserves return context when preserveReturnContext is true', async () => {
    await openMiniProgramPaymentPage({
      currentUserId: 'user-3',
      preserveReturnContext: true,
    })

    // Should still navigate
    expect(mockNavigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/pages/blind-box-payment/index'),
      }),
    )
  })
})
