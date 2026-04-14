export type MiniProgramPaymentVerificationState = 'polling' | 'paid' | 'pending' | 'failed'

export interface PaymentVerificationDecision {
  status: MiniProgramPaymentVerificationState
  message: string
  shouldRetry: boolean
  clearPendingOrder: boolean
}

export function getPaymentStatusDecision(input: {
  remoteStatus?: string
  attempt: number
  maxAttempts: number
}): PaymentVerificationDecision {
  if (input.remoteStatus === 'completed') {
    return {
      status: 'paid',
      message: '支付已确认，正在为你发放权益...',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  if (input.remoteStatus === 'failed' || input.remoteStatus === 'closed') {
    return {
      status: 'failed',
      message: '支付未完成，请重新发起支付',
      shouldRetry: false,
      clearPendingOrder: true,
    }
  }

  if (input.attempt >= input.maxAttempts) {
    return {
      status: 'pending',
      message: '支付处理中，请稍后查看我的订单',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  return {
    status: 'polling',
    message: '正在确认支付结果...',
    shouldRetry: true,
    clearPendingOrder: false,
  }
}

export function getPaymentStatusErrorDecision(input: {
  attempt: number
  maxAttempts: number
}): PaymentVerificationDecision {
  if (input.attempt >= input.maxAttempts) {
    return {
      status: 'pending',
      message: '支付结果确认稍有延迟，请稍后继续查询订单',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  return {
    status: 'polling',
    message: '支付结果确认稍有延迟，正在继续查询...',
    shouldRetry: true,
    clearPendingOrder: false,
  }
}