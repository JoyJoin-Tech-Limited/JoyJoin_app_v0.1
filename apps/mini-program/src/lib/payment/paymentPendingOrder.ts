import {
  normalizeEventPoolRegistrationPayload,
  type EventPoolRegistrationPayload,
  type NormalizedEventPoolRegistrationPayload,
} from '@shared/api'
import { normalizeMiniProgramRoute } from '../auth/authSessionRules'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'

export const MINI_PROGRAM_PENDING_ORDER_MAX_AGE_MS = 30 * 60 * 1000
export const MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_MAX_AGE_MS = 2 * 60 * 60 * 1000

export type MiniProgramPaymentEntitlementCode =
  | 'NO_ACTIVE_ENTITLEMENT'
  | 'NO_AVAILABLE_EVENT_PACK_CREDITS'

export interface MiniProgramPoolRegistrationReturnContext {
  kind: 'pool-registration'
  userId: string | null
  poolId: string
  poolTitle: string | null
  poolArea: string | null
  poolEventType: string | null
  draft: NormalizedEventPoolRegistrationPayload
  resumeStep: number
  handoffCode?: MiniProgramPaymentEntitlementCode
  paymentStatus: 'payment-required' | 'paid'
  createdAt: number
  updatedAt: number
}

export type MiniProgramPaymentReturnContext = MiniProgramPoolRegistrationReturnContext

export type MiniProgramPaymentReturnContextClearReason =
  | 'invalid-return-context'
  | 'expired'
  | 'wrong-user'

export type MiniProgramPaymentReturnContextLookupResult =
  | { status: 'missing' }
  | { status: 'clear'; reason: MiniProgramPaymentReturnContextClearReason }
  | { status: 'ready'; context: MiniProgramPaymentReturnContext }

export interface MiniProgramPendingOrderContext {
  orderId: string
  type: string
  userId: string | null
  createdAt: number
  manualLeave: boolean
  returnContext?: MiniProgramPaymentReturnContext
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
  MINI_PROGRAM_PAGE_PATHS.eventTicketPayment,
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

function normalizePositiveTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

function normalizeEntitlementCode(
  value: unknown,
): MiniProgramPaymentEntitlementCode | undefined {
  if (
    value === 'NO_ACTIVE_ENTITLEMENT' ||
    value === 'NO_AVAILABLE_EVENT_PACK_CREDITS'
  ) {
    return value
  }

  return undefined
}

function normalizePaymentStatus(
  value: unknown,
): MiniProgramPoolRegistrationReturnContext['paymentStatus'] {
  return value === 'paid' ? 'paid' : 'payment-required'
}

export function buildPoolRegistrationPaymentReturnContext(
  input: {
    userId?: string | null
    poolId: string
    poolTitle?: string | null
    poolArea?: string | null
    poolEventType?: string | null
    draft?: EventPoolRegistrationPayload | null
    resumeStep?: number
    handoffCode?: MiniProgramPaymentEntitlementCode | null
    paymentStatus?: MiniProgramPoolRegistrationReturnContext['paymentStatus']
    createdAt?: number
    updatedAt?: number
  },
  now = Date.now(),
): MiniProgramPoolRegistrationReturnContext {
  const createdAt = normalizePositiveTimestamp(input.createdAt) ?? now
  const updatedAt = normalizePositiveTimestamp(input.updatedAt) ?? createdAt

  return {
    kind: 'pool-registration',
    userId: normalizeNonEmptyString(input.userId) ?? null,
    poolId: input.poolId.trim(),
    poolTitle: normalizeNonEmptyString(input.poolTitle),
    poolArea: normalizeNonEmptyString(input.poolArea),
    poolEventType: normalizeNonEmptyString(input.poolEventType),
    draft: normalizeEventPoolRegistrationPayload(input.draft),
    resumeStep:
      typeof input.resumeStep === 'number' && Number.isFinite(input.resumeStep)
        ? input.resumeStep
        : 3,
    handoffCode: normalizeEntitlementCode(input.handoffCode),
    paymentStatus: normalizePaymentStatus(input.paymentStatus),
    createdAt,
    updatedAt,
  }
}

export function normalizePaymentReturnContext(
  rawContext: unknown,
): MiniProgramPaymentReturnContext | null {
  if (!isRecord(rawContext)) {
    return null
  }

  if (rawContext.kind !== 'pool-registration') {
    return null
  }

  const poolId = normalizeNonEmptyString(rawContext.poolId)
  const createdAt = normalizePositiveTimestamp(rawContext.createdAt)
  const updatedAt = normalizePositiveTimestamp(rawContext.updatedAt)
  const draft = normalizeEventPoolRegistrationPayload(
    rawContext.draft as EventPoolRegistrationPayload | null | undefined,
  )

  if (!poolId || !createdAt || Object.keys(draft).length === 0) {
    return null
  }

  return {
    kind: 'pool-registration',
    userId: normalizeNonEmptyString(rawContext.userId) ?? null,
    poolId,
    poolTitle: normalizeNonEmptyString(rawContext.poolTitle),
    poolArea: normalizeNonEmptyString(rawContext.poolArea),
    poolEventType: normalizeNonEmptyString(rawContext.poolEventType),
    draft,
    resumeStep:
      typeof rawContext.resumeStep === 'number' && Number.isFinite(rawContext.resumeStep)
        ? rawContext.resumeStep
        : 3,
    handoffCode: normalizeEntitlementCode(rawContext.handoffCode),
    paymentStatus: normalizePaymentStatus(rawContext.paymentStatus),
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  }
}

export function isPaymentReturnContextExpired(
  context: MiniProgramPaymentReturnContext,
  now = Date.now(),
): boolean {
  return now - context.updatedAt > MINI_PROGRAM_PAYMENT_RETURN_CONTEXT_MAX_AGE_MS
}

export function resolvePaymentReturnContext(input: {
  context: unknown
  currentUserId?: string | null
  now?: number
}): MiniProgramPaymentReturnContextLookupResult {
  if (input.context === undefined || input.context === null || input.context === '') {
    return { status: 'missing' }
  }

  const normalizedContext = normalizePaymentReturnContext(input.context)
  if (!normalizedContext) {
    return { status: 'clear', reason: 'invalid-return-context' }
  }

  if (isPaymentReturnContextExpired(normalizedContext, input.now)) {
    return { status: 'clear', reason: 'expired' }
  }

  const normalizedCurrentUserId = normalizeNonEmptyString(input.currentUserId)
  if (normalizedCurrentUserId) {
    if (!normalizedContext.userId || normalizedContext.userId !== normalizedCurrentUserId) {
      return { status: 'clear', reason: 'wrong-user' }
    }
  }

  return {
    status: 'ready',
    context: normalizedContext,
  }
}

export function markPaymentReturnContextPaid(
  context: MiniProgramPaymentReturnContext,
  now = Date.now(),
): MiniProgramPaymentReturnContext {
  return {
    ...context,
    paymentStatus: 'paid',
    updatedAt: now,
  }
}

export function buildPendingOrderContext(input: {
  orderId: string
  type?: string | null
  userId?: string | null
  createdAt?: number
  manualLeave?: boolean
  returnContext?: MiniProgramPaymentReturnContext | null
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
    returnContext: input.returnContext ?? undefined,
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
  const returnContext = normalizePaymentReturnContext(rawContext.returnContext)

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
    returnContext: returnContext ?? undefined,
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
  if (normalizedCurrentUserId) {
    if (!normalizedContext.userId || normalizedContext.userId !== normalizedCurrentUserId) {
      return { status: 'clear', reason: 'wrong-user' }
    }
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
