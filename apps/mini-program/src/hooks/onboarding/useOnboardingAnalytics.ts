import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ExperimentMarker } from '../../lib/experiments'
import {
  onboardingAnalytics,
  type MiniProgramOnboardingAnalyticsStep,
} from '../../lib/onboarding/onboardingAnalytics'

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

  const stepEnter = useCallback((metadata?: Record<string, unknown>) => {
    onboardingAnalytics.stepEnter(step, metadata)
  }, [step])

  const stepCompleted = useCallback((metadata?: Record<string, unknown>) => {
    onboardingAnalytics.stepCompleted(step, metadata)
  }, [step])

  const stepAbandoned = useCallback((reason?: string, metadata?: Record<string, unknown>) => {
    onboardingAnalytics.stepAbandoned(step, reason, metadata)
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

  // R3-10: attach/clear the active experiment marker — while set, every
  // onboarding analytics event carries { flagKey, bucket }.
  const setExperiment = useCallback((marker: ExperimentMarker | null) => {
    onboardingAnalytics.setActiveExperiment(marker)
  }, [])

  useEffect(() => {
    if (!enabled || !autoTrackStart || hasStartedRef.current) {
      return
    }

    stepStarted(options.startMetadata)
  }, [autoTrackStart, enabled, options.startMetadata, stepStarted])

  return useMemo(() => ({
    stepStarted,
    stepEnter,
    stepCompleted,
    stepAbandoned,
    validationFailed,
    errorOccurred,
    interaction,
    setExperiment,
  }), [errorOccurred, interaction, setExperiment, stepAbandoned, stepCompleted, stepEnter, stepStarted, validationFailed])
}
