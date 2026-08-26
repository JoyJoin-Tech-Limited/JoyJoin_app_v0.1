import { useCallback } from 'react'
import Taro from '@tarojs/taro'
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

const PENDING_CHECKPOINT_STORAGE_KEY = 'joyjoin_pending_onboarding_checkpoint'

interface PendingCheckpoint {
  step: OnboardingCheckpointStep
  timestamp: number
}

function persistPendingCheckpoint(step: OnboardingCheckpointStep): void {
  try {
    const pending: PendingCheckpoint = { step, timestamp: Date.now() }
    Taro.setStorageSync(PENDING_CHECKPOINT_STORAGE_KEY, pending)
  } catch {
    // Storage unavailable — the checkpoint is simply lost; saveCheckpoint
    // already reported the failure.
  }
}

async function postCheckpoint(step: OnboardingCheckpointStep, timestamp: number): Promise<void> {
  await apiRequest<{ success?: boolean }>({
    path: '/api/onboarding/checkpoint',
    method: 'POST',
    data: {
      step,
      timestamp,
    },
  })
}

/**
 * Best-effort compensation flush for a checkpoint stranded by an earlier
 * failed saveCheckpoint. Attempts once; a repeated failure leaves the entry
 * in storage for the next attempt.
 */
export async function replayPendingCheckpoint(): Promise<boolean> {
  let pending: PendingCheckpoint | null = null
  try {
    pending = (Taro.getStorageSync(PENDING_CHECKPOINT_STORAGE_KEY) as PendingCheckpoint | '') || null
  } catch {
    return false
  }
  if (!pending || typeof pending.step !== 'string') {
    return false
  }
  try {
    await postCheckpoint(pending.step, pending.timestamp ?? Date.now())
    try {
      Taro.removeStorageSync(PENDING_CHECKPOINT_STORAGE_KEY)
    } catch {
      // Best-effort cleanup only.
    }
    return true
  } catch {
    return false
  }
}

export function useOnboardingCheckpoint() {
  const queryClient = useQueryClient()

  const saveCheckpoint = useCallback(async (step: OnboardingCheckpointStep): Promise<boolean> => {
    // Flush any checkpoint stranded by an earlier failed save (fire-and-forget;
    // a repeated failure just leaves the entry for the next attempt).
    void replayPendingCheckpoint()

    try {
      await postCheckpoint(step, Date.now())

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/profile'] }),
      ])

      return true
    } catch (error) {
      persistPendingCheckpoint(step)
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