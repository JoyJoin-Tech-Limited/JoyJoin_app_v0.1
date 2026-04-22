import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  onboardingAnalytics,
  type MiniProgramOnboardingAnalyticsStep,
} from '../lib/onboardingAnalytics'

interface UseOnboardingAnalyticsOptions {
  enabled?: boolean
  autoTrackStart?: boolean
  startMetadata?: Record<string, unknown>
}

export function useOnboardingAnalytics(
  step: MiniProgramOnboardingAnalyticsStep,
  options: UseOnboardingAnalyticsOptions = {},
) {
  const hasStartedRef = useRef(false)
  const enabled = options.enabled ?? true
  const autoTrackStart = options.autoTrackStart ?? true

  const stepStarted = useCallback((metadata?: Record<string, unknown>) => {
    hasStartedRef.current = true
    onboardingAnalytics.stepStarted(step, metadata)
  }, [step])

  const stepCompleted = useCallback((metadata?: Record<string, unknown>) => {
    onboardingAnalytics.stepCompleted(step, metadata)
  }, [step])

  const stepAbandoned = useCallback((reason?: string) => {
    onboardingAnalytics.stepAbandoned(step, reason)
  }, [step])

  const validationFailed = useCallback((field: string, reason: string) => {
    onboardingAnalytics.validationFailed(step, field, reason)
  }, [step])

  const errorOccurred = useCallback((errorType: string, errorMessage: string) => {
    onboardingAnalytics.errorOccurred(step, errorType, errorMessage)
  }, [step])

  const interaction = useCallback((action: string, metadata?: Record<string, unknown>) => {
    onboardingAnalytics.interaction(step, action, metadata)
  }, [step])

  useEffect(() => {
    if (!enabled || !autoTrackStart || hasStartedRef.current) {
      return
    }

    stepStarted(options.startMetadata)
  }, [autoTrackStart, enabled, options.startMetadata, stepStarted])

  return useMemo(() => ({
    stepStarted,
    stepCompleted,
    stepAbandoned,
    validationFailed,
    errorOccurred,
    interaction,
  }), [errorOccurred, interaction, stepAbandoned, stepCompleted, stepStarted, validationFailed])
}