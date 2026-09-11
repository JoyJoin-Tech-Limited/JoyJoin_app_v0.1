import { useCallback, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { registerForPool, type EventPoolRegistrationPayload } from '@shared/api'
import { getErrorMessage, ERROR_CODE_GENERIC_FALLBACK, type ErrorCode } from '@shared/copy/errorBaselines'

import { apiRequest, type ApiError } from '../lib/api/api'
import { bustRegistrationCaches } from '../lib/api/registrationCacheBust'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import { interactionLatency } from '../lib/analytics/interactionLatency'
import { useOptimisticMutation } from './useOptimisticMutation'
import {
  buildPoolRegistrationPaymentReturnContext,
  type MiniProgramPaymentEntitlementCode,
  type MiniProgramPoolRegistrationReturnContext,
} from '../lib/payment/paymentPendingOrder'
import {
  clearPaymentReturnContextStorage,
  persistPaymentReturnContext,
} from '../lib/payment/paymentPendingOrderStorage'
import { haptics } from '../lib/utils/haptics'
import { logInfo, logError } from '../lib/utils/logger'
import { shouldShowFlow } from '../components/flow-animation/FlowStorage'
import { MINI_PROGRAM_ROUTES } from '../lib/onboarding/onboardingRoutes'
import { TOAST_DEFAULT_MS } from '../lib/utils/uiConstants'
import type { PoolEventType } from '../pages/pool-registration/flowConfig'
import type { RegistrationStep } from '../pages/pool-registration/poolRegistrationForm'

/** True when a server-supplied string is safe to show a WeChat user directly:
 *  non-empty, not a bare machine code, and Chinese (so English/technical
 *  transport strings never leak into the UI). */
function isUserFacingServerMessage(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return false
  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed)) return false
  return /[\u4e00-\u9fff]/.test(trimmed)
}

/** Map a server error to copy-governed text.
 *
 *  Order: known `data.code` → governed template; otherwise the server's own
 *  Chinese message; otherwise the localized `Error.message`; otherwise the
 *  caller's fallback code. An UNMAPPED code must NOT short-circuit to the
 *  generic sentinel — that was the swallowed-error class behind the duplicate
 *  registration dead-end (2026-09-10): the server sent a human message but the
 *  client showed "出了点问题，稍后再试". */
export function resolveMessage(error: unknown, fallbackCode: ErrorCode): string {
  const apiError = error as ApiError | undefined
  const data = apiError?.data

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const code = (data as { code?: unknown }).code
    if (typeof code === 'string') {
      const mapped = getErrorMessage(code as ErrorCode)
      if (mapped !== ERROR_CODE_GENERIC_FALLBACK) return mapped
    }
    const serverMessage = (data as { message?: unknown }).message
    if (isUserFacingServerMessage(serverMessage)) return serverMessage
  }

  // Legacy: the response body itself was a bare ErrorCode string.
  if (error instanceof Error && error.message) {
    const mapped = getErrorMessage(error.message as ErrorCode)
    if (mapped !== ERROR_CODE_GENERIC_FALLBACK) return mapped
    if (isUserFacingServerMessage(error.message)) return error.message
  }

  return getErrorMessage(fallbackCode)
}

/** Read the entitlement handoff code off a server rejection (AC-5 stale-credit
 *  path). Returns null when the error carries no such code. */
export function getEntitlementCode(error: unknown): MiniProgramPaymentEntitlementCode | null {
  const data = (error as ApiError | undefined)?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }

  const code = (data as { code?: unknown }).code
  if (code === 'NO_ACTIVE_ENTITLEMENT' || code === 'NO_AVAILABLE_EVENT_PACK_CREDITS') {
    return code
  }

  return null
}

/** True when the server rejected the submit with code ALREADY_REGISTERED —
 *  the registration row EXISTS (double-confirm held re-fire, retry after a
 *  network-swallowed success, or a payment-fulfillment-created registration
 *  invisible to a stale registrations cache). This is a terminal joined
 *  state, not a failure: treating it as one shows a generic error card whose
 *  retry can never succeed (2026-09-10 duplicate-submit trap fix). */
export function isAlreadyRegisteredError(error: unknown): boolean {
  const data = (error as ApiError | undefined)?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }
  return (data as { code?: unknown }).code === 'ALREADY_REGISTERED'
}

/** Diagnostic fields for submit-failure logs — the mapped user copy alone
 *  swallows the real server code/message, so log the raw response too. */
export function describeSubmitError(error: unknown): {
  statusCode?: number
  serverCode?: string
  serverMessage?: string
} {
  const apiError = error as ApiError | undefined
  const data = apiError?.data
  const serverCode =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as { code?: unknown }).code
      : undefined
  return {
    statusCode: apiError?.statusCode,
    serverCode: typeof serverCode === 'string' ? serverCode : undefined,
    serverMessage: apiError instanceof Error ? apiError.message : undefined,
  }
}

/** Structural subset of AuthUserResponse consumed by the optimistic
 *  registration machinery — keeps the hook decoupled from the full user DTO. */
export interface OptimisticRegistrationUser {
  id?: string
  entitlementMode?: string | null
  features?: { flowLifecycleEnabled?: boolean }
}

export interface UseOptimisticRegistrationOptions {
  poolId: string
  poolTitle?: string
  poolArea: string
  eventType: PoolEventType
  step: RegistrationStep
  registered: boolean
  user?: OptimisticRegistrationUser
  setRegistered: (value: boolean) => void
  setError: (message: string) => void
  setResumeContext: (context: MiniProgramPoolRegistrationReturnContext | null) => void
  setShowBlindBoxFlow: (visible: boolean) => void
}

export interface UseOptimisticRegistrationResult {
  /** Fire the optimistic registration for the current pool. */
  registerOptimistically: (payload: EventPoolRegistrationPayload, t0: number) => void
}

/**
 * M4 optimistic registration machinery (extracted from pool-registration):
 * the useOptimisticMutation wiring, celebratedRef/handledErrorRef guards,
 * entitlement handoff, and success side-effects (cache busts, duo-status
 * invalidate, return-context clear, analytics, blind-box flow trigger).
 * The page keeps form state, step machine, submit-blocker validation, the
 * AC-2 gate branching, marker calls, and UI.
 */
export function useOptimisticRegistration(
  options: UseOptimisticRegistrationOptions,
): UseOptimisticRegistrationResult {
  const {
    poolId,
    poolTitle,
    poolArea,
    eventType,
    step,
    registered,
    user,
    setRegistered,
    setError,
    setResumeContext,
    setShowBlindBoxFlow,
  } = options
  const queryClient = useQueryClient()

  // M4 optimistic path (AC-2): its own busy state — never reuses
  // isRegistering's await semantics.
  const [optimisticBusy, setOptimisticBusy] = useState(false)
  // AC-3a: celebration (blind-box flow / toast / analytics) fires at most
  // once per page session — the held-waiter path resolves two caller
  // promises for one logical registration.
  const celebratedRef = useRef(false)
  // AC-5a: only the first rejection per coalesced batch is handled;
  // held-waiter re-fire rejections are no-ops.
  const handledErrorRef = useRef(false)

  // M4 (AC-4): shared optimistic mutation with NO cache patches — perceived
  // feedback is the local success card, not the cache. Dedupe (double-tap)
  // comes from the hook; queryKeys: [] coalesces every optimistic tap on the
  // '[]' key. The hook re-throws the ORIGINAL error so getEntitlementCode
  // keeps reading error.data.code.
  const optimisticRegistration = useOptimisticMutation<EventPoolRegistrationPayload, { id: string }>({
    mutationFn: (payload) => {
      if (!poolId) {
        return Promise.reject(new Error('缺少报名信息'))
      }
      return registerForPool(apiRequest, poolId, payload)
    },
    queryKeys: [],
    // No-op by construction: with queryKeys: [] the per-key loop never runs,
    // so this updater is never invoked (no cache patches — AC-4).
    optimisticUpdate: (_vars, prev) => prev,
    // AC-5b/N-8: the hook owns the failure toast — same copy resolution as
    // the existing catch. Entitlement-code rejections suppress the toast
    // entirely: the payment-handoff navigation is the feedback, and a generic
    // toast right before navigation would read as noise. ALREADY_REGISTERED
    // is suppressed too: the terminal-joined branch below owns the feedback
    // (a "failure" toast after a confirmed registration would be a lie).
    rollbackMessage: (error) =>
      getEntitlementCode(error) || isAlreadyRegisteredError(error)
        ? null
        : resolveMessage(error, 'submit-failed'),
  })

  // M4 optimistic path (AC-2/3): instant local success at tap, celebration
  // gated on server confirm, recoverable rollback into the existing payment
  // handoff. Separate busy state; never awaits like the null branch.
  const registerOptimistically = useCallback(
    (payload: EventPoolRegistrationPayload, t0: number) => {
      if (!poolId || registered || optimisticBusy || optimisticRegistration.isPending) return

      // New coalesced batch — reset the first-rejection guard.
      handledErrorRef.current = false
      setOptimisticBusy(true)
      setError('')

      logInfo('[PoolRegistration] Optimistic registration engaged', {
        poolId,
        eventType,
        step,
        entitlementMode: user?.entitlementMode,
      })

      // AC-3 layered feedback: instant success card + haptic + M0 feedback
      // mark at the optimistic point (~0ms). t0 is from handler entry.
      // N-3: distinct event name so the baseline can compare optimistic vs
      // confirm-gated perceived latency.
      setRegistered(true)
      haptics('success')
      interactionLatency.trackInteraction('registration_submit_optimistic', t0)

      void optimisticRegistration.mutate(payload).then(
        () => {
          setOptimisticBusy(false)
          // AC-3a/AC-6: server confirm — side-effects + celebration run once
          // per page session (the held-waiter path resolves both callers).
          // C-3: a rejection already handled for this batch means the held
          // duplicate succeeded late — skip side-effects + celebration
          // (the first rejection already navigated/rolled back).
          if (celebratedRef.current || handledErrorRef.current) return
          celebratedRef.current = true
          void bustRegistrationCaches(queryClient, { poolId })
          // Refresh duo state so the success page reflects a fresh binding.
          void queryClient.invalidateQueries({ queryKey: ['mini-program', 'duo-status', poolId] })
          clearPaymentReturnContextStorage()
          setResumeContext(null)
          discoverAnalytics.track('registration_complete', poolId)
          if (shouldShowFlow('blind-box-lifecycle', user?.id) && user?.features?.flowLifecycleEnabled !== false) {
            setShowBlindBoxFlow(true)
          } else {
            Taro.showToast({ title: '报名成功！', icon: 'success', duration: TOAST_DEFAULT_MS })
          }
        },
        (err) => {
          setOptimisticBusy(false)
          // A confirmed registration never rolls back (a held duplicate
          // re-submit can fail after the first succeeded).
          if (celebratedRef.current) return
          // AC-5a: only the first rejection per coalesced batch is handled.
          if (handledErrorRef.current) return
          handledErrorRef.current = true

          // AC-5: revert the local success state, restore prior UI.
          setRegistered(false)

          const entitlementCode = getEntitlementCode(err)

          if (entitlementCode) {
            // AC-5 stale-credit handoff — existing resumeContext path verbatim.
            const nextResumeContext = buildPoolRegistrationPaymentReturnContext({
              userId: user?.id,
              poolId,
              poolTitle,
              poolArea,
              poolEventType: eventType,
              draft: payload,
              resumeStep: step,
              handoffCode: entitlementCode,
            })

            persistPaymentReturnContext(nextResumeContext)
            setResumeContext(nextResumeContext)
            logInfo('[PoolRegistration] Entitlement handoff after optimistic rollback', {
              poolId,
              entitlementCode,
            })

            Taro.navigateTo({
              url: `${MINI_PROGRAM_ROUTES.eventTicketPayment}?poolId=${encodeURIComponent(poolId)}`,
            })
            return
          }

          // ALREADY_REGISTERED: the row exists server-side, so the user IS
          // in — convert to the terminal joined surface instead of an error
          // card whose 重新提交 can never succeed. Mirrors the success branch
          // side-effects; celebration analytics are NOT re-fired (the
          // original registration already counted).
          if (isAlreadyRegisteredError(err)) {
            celebratedRef.current = true
            setRegistered(true)
            void bustRegistrationCaches(queryClient, { poolId })
            void queryClient.invalidateQueries({ queryKey: ['mini-program', 'duo-status', poolId] })
            clearPaymentReturnContextStorage()
            setResumeContext(null)
            discoverAnalytics.track('registration_already_registered', poolId, { step })
            logInfo('[PoolRegistration] Server reports existing registration; joined surface engaged', {
              poolId,
              eventType,
              step,
              ...describeSubmitError(err),
            })
            Taro.showToast({ title: '报名成功！', icon: 'success', duration: TOAST_DEFAULT_MS })
            return
          }

          // AC-7: capacity/availability rejections roll back like any other
          // failure — server remains authority; existing error handling
          // applies through the hook's re-thrown error.
          const message = resolveMessage(err, 'submit-failed')
          setError(message)
          discoverAnalytics.track('registration_submit_error', poolId, {
            message,
            step,
            ...describeSubmitError(err),
          })
          logError('[PoolRegistration] Failed (optimistic)', {
            poolId,
            eventType,
            step,
            message,
            ...describeSubmitError(err),
          })
          // AC-5b: the failure toast is owned by useOptimisticMutation
          // (rollbackMessage) — no Taro.showToast in this branch.
        },
      )
    },
    [
      eventType,
      optimisticBusy,
      optimisticRegistration,
      poolTitle,
      poolArea,
      poolId,
      registered,
      step,
      user?.features?.flowLifecycleEnabled,
      user?.id,
    ],
  )

  return { registerOptimistically }
}
