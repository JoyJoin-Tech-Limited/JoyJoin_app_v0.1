/**
 * Phase 2: Hook for easy onboarding analytics tracking
 * 
 * Usage:
 * const analytics = useOnboardingAnalytics('essential-data');
 * analytics.stepCompleted({ fieldsCompleted: 7 });
 * analytics.validationFailed('birthdate', 'Age under 18');
 */

import { useEffect, useRef } from 'react';
import { onboardingAnalytics, type OnboardingStep } from '@/lib/onboardingAnalytics';

export function useOnboardingAnalytics(step: OnboardingStep) {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Track step started on mount (only once)
    if (!hasStartedRef.current) {
      onboardingAnalytics.stepStarted(step);
      hasStartedRef.current = true;
    }

    // Track step abandoned on unmount (if not completed)
    return () => {
      // This will be called when component unmounts
      // The stepCompleted call should happen before unmounting
    };
  }, [step]);

  return {
    stepCompleted: (metadata?: Record<string, any>) => {
      onboardingAnalytics.stepCompleted(step, metadata);
    },
    stepAbandoned: (reason?: string) => {
      onboardingAnalytics.stepAbandoned(step, reason);
    },
    validationFailed: (field: string, reason: string) => {
      onboardingAnalytics.validationFailed(step, field, reason);
    },
    errorOccurred: (errorType: string, errorMessage: string) => {
      onboardingAnalytics.errorOccurred(step, errorType, errorMessage);
    },
  };
}
