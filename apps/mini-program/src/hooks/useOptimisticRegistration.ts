import { useCallback, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { registerForPool, type EventPoolRegistrationPayload } from '@shared/api'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'

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

/** Map a server error to copy-governed text: known `data.code` values resolve
 *  through the shared error-baseline templates; anything else falls back to
 *  the caller-supplied baseline code. */
export function resolveMessage(error: unknown, fallbackCode: ErrorCode): string {
  const apiError = error as ApiError | undefined
  if (apiError?.data && typeof apiError.data === 'object' && !Array.isArray(apiError.data)) {
    const code = (apiError.data as { code?: unknown }).code
    if (typeof code === 'string') {
      return getErrorMessage(code as ErrorCode) ?? getErrorMessage(fallbackCode)
    }
  }
  if (error instanceof Error && error.message) {
    const mapped = getErrorMessage(error.message as ErrorCode)
    if (mapped !== error.message) {
      return mapped
    }
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
    // toast right before navigation would read as noise.
    rollbackMessage: (error) =>
      getEntitlementCode(error) ? null : resolveMessage(error, 'submit-failed'),
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

          // AC-7: capacity/availability rejections roll back like any other
          // failure — server remains authority; existing error handling
          // applies through the hook's re-thrown error.
          const message = resolveMessage(err, 'submit-failed')
          setError(message)
          discoverAnalytics.track('registration_submit_error', poolId, { message, step })
          logError('[PoolRegistration] Failed (optimistic)', {
            poolId,
            eventType,
            step,
            message,
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
