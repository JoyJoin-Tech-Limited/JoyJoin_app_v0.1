import { describe, expect, it } from 'vitest'
import {
  getPaymentStatusDecision,
  getPaymentStatusErrorDecision,
} from './paymentVerificationStatus'

describe('mini-program payment verification status decisions', () => {
  // Guards against regression: only true server-reported failed or closed
  // statuses should terminate verification and clear the pending order.
  it('treats completed, failed, and closed statuses as terminal server decisions', () => {
    expect(
      getPaymentStatusDecision({
        remoteStatus: 'completed',
        attempt: 1,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'paid',
      message: '支付已确认，正在为你发放权益...',
      shouldRetry: false,
      clearPendingOrder: false,
    })

    expect(
      getPaymentStatusDecision({
        remoteStatus: 'failed',
        attempt: 1,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'failed',
      message: '支付未完成，请重新发起支付',
      shouldRetry: false,
      clearPendingOrder: true,
    })

    expect(
      getPaymentStatusDecision({
        remoteStatus: 'closed',
        attempt: 1,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'failed',
      message: '支付未完成，请重新发起支付',
      shouldRetry: false,
      clearPendingOrder: true,
    })
  })

  it('keeps unknown statuses retryable until polling is exhausted', () => {
    expect(
      getPaymentStatusDecision({
        remoteStatus: 'processing',
        attempt: 3,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'polling',
      message: '正在确认支付结果...',
      shouldRetry: true,
      clearPendingOrder: false,
    })

    expect(
      getPaymentStatusDecision({
        remoteStatus: 'processing',
        attempt: 10,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'pending',
      message: '支付处理中，请稍后查看我的订单',
      shouldRetry: false,
      clearPendingOrder: false,
    })
  })

  it('treats transient status-query errors as retry or pending instead of failed', () => {
    expect(
      getPaymentStatusErrorDecision({
        attempt: 2,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'polling',
      message: '支付结果确认稍有延迟，正在继续查询...',
      shouldRetry: true,
      clearPendingOrder: false,
    })

    expect(
      getPaymentStatusErrorDecision({
        attempt: 10,
        maxAttempts: 10,
      }),
    ).toEqual({
      status: 'pending',
      message: '支付结果确认稍有延迟，请稍后继续查询订单',
      shouldRetry: false,
      clearPendingOrder: false,
    })
  })
})