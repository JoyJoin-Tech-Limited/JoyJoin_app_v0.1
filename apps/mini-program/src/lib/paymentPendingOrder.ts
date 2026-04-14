import { normalizeMiniProgramRoute } from './authSessionRules'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from './onboardingRoutes'

export const MINI_PROGRAM_PENDING_ORDER_MAX_AGE_MS = 30 * 60 * 1000

export interface MiniProgramPendingOrderContext {
  orderId: string
  type: string
  userId: string | null
  createdAt: number
  manualLeave: boolean
}

export interface ReadyMiniProgramPendingOrder {
  orderId: string
  context: MiniProgramPendingOrderContext
}

export type MiniProgramPendingOrderClearReason =
  | 'missing-order'
  | 'missing-context'
  | 'invalid-context'
  | 'expired'
  | 'wrong-user'

export type MiniProgramPendingOrderLookupResult =
  | { status: 'missing' }
  | { status: 'clear'; reason: MiniProgramPendingOrderClearReason }
  | ({ status: 'ready' } & ReadyMiniProgramPendingOrder)

export type MiniProgramPendingOrderAutoResumeWaitReason =
  | 'missing'
  | 'auth-pending'
  | 'unauthenticated'
  | 'payment-flow-route'
  | 'manual-leave'

export type MiniProgramPendingOrderAutoResumeDecision =
  | { action: 'wait'; reason: MiniProgramPendingOrderAutoResumeWaitReason }
  | { action: 'clear'; reason: MiniProgramPendingOrderClearReason }
  | ({ action: 'resume' } & ReadyMiniProgramPendingOrder)

const MINI_PROGRAM_PAYMENT_FLOW_ROUTES = new Set<string>([
  MINI_PROGRAM_PAGE_PATHS.blindBoxPayment,
  MINI_PROGRAM_PAGE_PATHS.paymentVerification,
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export function buildPendingOrderContext(input: {
  orderId: string
  type?: string | null
  userId?: string | null
  createdAt?: number
  manualLeave?: boolean
}, now = Date.now()): MiniProgramPendingOrderContext {
  return {
    orderId: input.orderId,
    type: normalizeNonEmptyString(input.type) ?? 'event_bundle',
    userId: normalizeNonEmptyString(input.userId) ?? null,
    createdAt:
      typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
        ? input.createdAt
        : now,
    manualLeave: input.manualLeave === true,
  }
}

export function normalizePendingOrderContext(rawContext: unknown): MiniProgramPendingOrderContext | null {
  if (!isRecord(rawContext)) {
    return null
  }

  const orderId = normalizeNonEmptyString(rawContext.orderId)
  const type = normalizeNonEmptyString(rawContext.type)
  const userId = normalizeNonEmptyString(rawContext.userId)
  const createdAt = rawContext.createdAt

  if (!orderId || !type) {
    return null
  }

  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
    return null
  }

  return {
    orderId,
    type,
    userId,
    createdAt,
    manualLeave: rawContext.manualLeave === true,
  }
}

export function isPendingOrderExpired(
  context: MiniProgramPendingOrderContext,
  now = Date.now(),
): boolean {
  return now - context.createdAt > MINI_PROGRAM_PENDING_ORDER_MAX_AGE_MS
}

export function isPaymentFlowRoute(route?: string | null): boolean {
  return MINI_PROGRAM_PAYMENT_FLOW_ROUTES.has(normalizeMiniProgramRoute(route))
}

export function resolvePendingOrder(input: {
  orderId: unknown
  context: unknown
  currentUserId?: string | null
  now?: number
}): MiniProgramPendingOrderLookupResult {
  const normalizedOrderId = normalizeNonEmptyString(input.orderId)
  const hasRawContext = input.context !== undefined && input.context !== null && input.context !== ''

  if (!normalizedOrderId && !hasRawContext) {
    return { status: 'missing' }
  }

  if (!normalizedOrderId) {
    return { status: 'clear', reason: 'missing-order' }
  }

  if (!hasRawContext) {
    return { status: 'clear', reason: 'missing-context' }
  }

  const normalizedContext = normalizePendingOrderContext(input.context)
  if (!normalizedContext || normalizedContext.orderId !== normalizedOrderId) {
    return { status: 'clear', reason: 'invalid-context' }
  }

  if (isPendingOrderExpired(normalizedContext, input.now)) {
    return { status: 'clear', reason: 'expired' }
  }

  const normalizedCurrentUserId = normalizeNonEmptyString(input.currentUserId)
  if (
    normalizedCurrentUserId &&
    normalizedContext.userId &&
    normalizedContext.userId !== normalizedCurrentUserId
  ) {
    return { status: 'clear', reason: 'wrong-user' }
  }

  return {
    status: 'ready',
    orderId: normalizedOrderId,
    context: normalizedContext,
  }
}

export function decidePendingOrderAutoResume(input: {
  authResolved: boolean
  isAuthenticated: boolean
  currentRoute?: string | null
  currentUserId?: string | null
  orderId: unknown
  context: unknown
  now?: number
}): MiniProgramPendingOrderAutoResumeDecision {
  if (!input.authResolved) {
    return { action: 'wait', reason: 'auth-pending' }
  }

  const pendingOrder = resolvePendingOrder({
    orderId: input.orderId,
    context: input.context,
    currentUserId: input.currentUserId,
    now: input.now,
  })

  if (pendingOrder.status === 'clear') {
    return { action: 'clear', reason: pendingOrder.reason }
  }

  if (pendingOrder.status === 'missing') {
    return { action: 'wait', reason: 'missing' }
  }

  if (!input.isAuthenticated) {
    return { action: 'wait', reason: 'unauthenticated' }
  }

  if (isPaymentFlowRoute(input.currentRoute)) {
    return { action: 'wait', reason: 'payment-flow-route' }
  }

  if (pendingOrder.context.manualLeave) {
    return { action: 'wait', reason: 'manual-leave' }
  }

  return {
    action: 'resume',
    orderId: pendingOrder.orderId,
    context: pendingOrder.context,
  }
}

export function buildPaymentVerificationUrl(orderId: string): string {
  return `${MINI_PROGRAM_ROUTES.paymentVerification}?outTradeNo=${encodeURIComponent(orderId)}`
}
