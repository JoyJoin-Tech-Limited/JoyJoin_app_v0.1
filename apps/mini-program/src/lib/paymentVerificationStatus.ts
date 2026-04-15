import {
  getPaymentVerificationErrorDecision as getSharedPaymentVerificationErrorDecision,
  getPaymentVerificationStatusDecision as getSharedPaymentVerificationStatusDecision,
  type PaymentVerificationDecision as SharedPaymentVerificationDecision,
  type PaymentVerificationState,
} from '@shared/api'

export type MiniProgramPaymentVerificationState = PaymentVerificationState

export interface PaymentVerificationDecision extends SharedPaymentVerificationDecision {
  message: string
}

function toMiniProgramDecision(
  decision: SharedPaymentVerificationDecision,
  message: string,
): PaymentVerificationDecision {
  return {
    ...decision,
    message,
  }
}

function getMiniProgramPaymentStatusMessage(status: PaymentVerificationState): string {
  switch (status) {
    case 'paid':
      return '支付已确认，正在为你发放权益...'
    case 'failed':
      return '支付未完成，请重新发起支付'
    case 'pending':
      return '支付处理中，请稍后查看我的订单'
    case 'polling':
    default:
      return '正在确认支付结果...'
  }
}

function getMiniProgramPaymentErrorMessage(status: PaymentVerificationState): string {
  switch (status) {
    case 'pending':
      return '支付结果确认稍有延迟，请稍后继续查询订单'
    case 'polling':
      return '支付结果确认稍有延迟，正在继续查询...'
    default:
      return getMiniProgramPaymentStatusMessage(status)
  }
}

export function getPaymentStatusDecision(input: {
  remoteStatus?: string
  attempt: number
  maxAttempts: number
}): PaymentVerificationDecision {
  const decision = getSharedPaymentVerificationStatusDecision(input)
  return toMiniProgramDecision(decision, getMiniProgramPaymentStatusMessage(decision.status))
}

export function getPaymentStatusErrorDecision(input: {
  attempt: number
  maxAttempts: number
}): PaymentVerificationDecision {
  const decision = getSharedPaymentVerificationErrorDecision(input)
  return toMiniProgramDecision(decision, getMiniProgramPaymentErrorMessage(decision.status))
}