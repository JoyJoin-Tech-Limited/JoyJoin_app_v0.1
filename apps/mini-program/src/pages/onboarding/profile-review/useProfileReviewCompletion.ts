import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnboardingNextStep } from '@shared/onboarding'
import { getErrorForSurface } from '@shared/copy/errorBaselines'
import { looksLikeOfflineError } from '../../../lib/utils/offlineDetection'

export const PROFILE_REVIEW_SUCCESS_DWELL_MS = 720

export type ProfileReviewCompletionPhase =
  | 'idle'
  | 'submitting'
  | 'celebrating'
  | 'navigating'
  | 'error'

interface CompletionResponse {
  nextStep?: OnboardingNextStep | null
}

interface CompletedCompletion {
  nextStep?: OnboardingNextStep | null
  stepCompletedReported: boolean
}

export interface UseProfileReviewCompletionOptions {
  shouldReduceMotion: boolean
  complete: () => Promise<CompletionResponse>
  resolveNextStep: () => Promise<CompletionResponse>
  navigate: (nextStep: OnboardingNextStep | null | undefined) => Promise<unknown>
  onServerComplete?: (nextStep: OnboardingNextStep | null | undefined) => void
  onStepCompleted?: (nextStep: OnboardingNextStep | null | undefined) => void
  onNavigate?: (nextStep: OnboardingNextStep | null | undefined) => void
  onFailure?: (stage: 'complete' | 'navigate', error: unknown, message: string) => void
}

function resolveCompletionErrorMessage(error: unknown): string {
  return getErrorForSurface(
    looksLikeOfflineError(error) ? 'offline-preflight' : 'operation-failed',
    'inline-error',
  )
}

/**
 * Owns the one-tap Profile Review completion state machine.
 *
 * Submission and navigation use synchronous promise latches: a second tap in
 * the same tick receives the live promise instead of starting another request.
 * A completed server mutation is retained separately, so a routing failure can
 * retry navigation without completing the profile or reporting success twice.
 */
export function useProfileReviewCompletion(
  options: UseProfileReviewCompletionOptions,
) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [phase, setPhase] = useState<ProfileReviewCompletionPhase>('idle')
  const [error, setError] = useState('')
  const phaseRef = useRef<ProfileReviewCompletionPhase>('idle')
  const mountedRef = useRef(true)
  const visibleRef = useRef(true)
  const completionRequestRef = useRef<Promise<void> | null>(null)
  const navigationRequestRef = useRef<Promise<void> | null>(null)
  const completedRef = useRef<CompletedCompletion | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePhase = useCallback((next: ProfileReviewCompletionPhase) => {
    phaseRef.current = next
    if (mountedRef.current) setPhase(next)
  }, [])

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      visibleRef.current = false
      clearSuccessTimer()
    }
  }, [clearSuccessTimer])

  const navigateCompleted = useCallback((completed: CompletedCompletion): Promise<void> => {
    if (navigationRequestRef.current) return navigationRequestRef.current
    if (!mountedRef.current || !visibleRef.current) return Promise.resolve()

    clearSuccessTimer()
    setError('')
    const request = (async () => {
      updatePhase('navigating')
      try {
        let nextStep = completed.nextStep
        if (nextStep == null) {
          const resolved = await optionsRef.current.resolveNextStep()
          // A hidden WeChat page remains mounted. Do not let a late auth
          // resolution navigate in the background; handleShow resumes it.
          if (!mountedRef.current || !visibleRef.current) return
          nextStep = resolved?.nextStep
        }
        if (!mountedRef.current || !visibleRef.current) return
        if (nextStep == null) {
          throw new Error('Profile review nextStep is unavailable')
        }
        if (!completed.stepCompletedReported) {
          completed.stepCompletedReported = true
          optionsRef.current.onStepCompleted?.(nextStep)
        }
        optionsRef.current.onNavigate?.(nextStep)
        await optionsRef.current.navigate(nextStep)
      } catch (navigationError) {
        if (!mountedRef.current) return
        const message = resolveCompletionErrorMessage(navigationError)
        setError(message)
        updatePhase('error')
        optionsRef.current.onFailure?.('navigate', navigationError, message)
      }
    })()

    navigationRequestRef.current = request
    void request.then(() => {
      if (navigationRequestRef.current === request) {
        navigationRequestRef.current = null
      }
    })
    return request
  }, [clearSuccessTimer, updatePhase])

  const scheduleNavigation = useCallback((completed: CompletedCompletion) => {
    if (
      navigationRequestRef.current
      || successTimerRef.current
      || !mountedRef.current
      || !visibleRef.current
    ) return

    if (optionsRef.current.shouldReduceMotion) {
      void navigateCompleted(completed)
      return
    }

    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null
      void navigateCompleted(completed)
    }, PROFILE_REVIEW_SUCCESS_DWELL_MS)
  }, [navigateCompleted])

  const begin = useCallback((): Promise<void> => {
    if (navigationRequestRef.current) return navigationRequestRef.current
    // A routing retry must never repeat the server mutation or success beat.
    if (completedRef.current) return navigateCompleted(completedRef.current)
    if (completionRequestRef.current) return completionRequestRef.current

    clearSuccessTimer()
    setError('')
    const request = (async () => {
      updatePhase('submitting')
      try {
        const response = await optionsRef.current.complete()
        if (!mountedRef.current) return

        const completed: CompletedCompletion = {
          nextStep: response?.nextStep,
          stepCompletedReported: false,
        }
        completedRef.current = completed
        optionsRef.current.onServerComplete?.(completed.nextStep)
        updatePhase('celebrating')
        scheduleNavigation(completed)
      } catch (completionError) {
        if (!mountedRef.current) return
        completedRef.current = null
        const message = resolveCompletionErrorMessage(completionError)
        setError(message)
        updatePhase('error')
        optionsRef.current.onFailure?.('complete', completionError, message)
      }
    })()

    completionRequestRef.current = request
    void request.then(() => {
      if (completionRequestRef.current === request) {
        completionRequestRef.current = null
      }
    })
    return request
  }, [clearSuccessTimer, navigateCompleted, scheduleNavigation, updatePhase])

  const handleHide = useCallback(() => {
    visibleRef.current = false
    // WeChat keeps hidden pages alive. Pause only the visual delay; live
    // completion/navigation promises remain latched until they settle.
    clearSuccessTimer()
  }, [clearSuccessTimer])

  const handleShow = useCallback(() => {
    visibleRef.current = true
    if (!completedRef.current) return
    if (phaseRef.current === 'celebrating') {
      scheduleNavigation(completedRef.current)
    } else if (phaseRef.current === 'navigating') {
      // A deferred nextStep lookup may have settled while hidden. Its live
      // latch is gone by now; resume routing without replaying the success beat.
      void navigateCompleted(completedRef.current)
    }
  }, [navigateCompleted, scheduleNavigation])

  return {
    phase,
    error,
    begin,
    handleHide,
    handleShow,
    isSubmitting: phase === 'submitting',
    isCelebrating: phase === 'celebrating',
    isPageExiting: phase === 'navigating',
  }
}
