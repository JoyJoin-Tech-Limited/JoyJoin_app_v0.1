import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api/api'
import { AUTH_QUERY_KEY } from '../../lib/api/authSession'
import { logWarn } from '../../lib/utils/logger'

export type OnboardingCheckpointStep =
  | 'onboarding'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'

export function useOnboardingCheckpoint() {
  const queryClient = useQueryClient()

  const saveCheckpoint = useCallback(async (step: OnboardingCheckpointStep): Promise<boolean> => {
    try {
      await apiRequest<{ success?: boolean }>({
        path: '/api/onboarding/checkpoint',
        method: 'POST',
        data: {
          step,
          timestamp: Date.now(),
        },
      })

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/profile'] }),
      ])

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[OnboardingCheckpoint] Failed to save onboarding checkpoint', {
        step,
        message,
      })
      return false
    }
  }, [queryClient])

  return {
    saveCheckpoint,
  }
}