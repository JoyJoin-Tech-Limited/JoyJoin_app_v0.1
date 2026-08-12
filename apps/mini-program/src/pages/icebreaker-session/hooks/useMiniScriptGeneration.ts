import { useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import type { MiniScriptGenerationStatus, MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import { apiRequest } from '../../../lib/api/api'
import { getErrorText } from '../icebreakerSessionModel'
import { logError } from '../../../lib/utils/logger'
import { TOAST_DEFAULT_MS } from '../../../lib/utils/uiConstants'

const MINISCRIPT_GENERATION_TIMEOUT_MS = 35_000

interface UseMiniScriptGenerationOptions {
  socialSessionId: string | null
  playerCount: number
  refetchSession: () => Promise<unknown>
}

interface UseMiniScriptGenerationReturn {
  isSubmitting: boolean
  generationStatus: MiniScriptGenerationStatus | null
  submitGenerate: (payload: {
    style: MiniScriptStyle
    genres: MiniScriptGenre[]
    lite?: boolean
  }) => Promise<boolean>
  resetGeneration: () => void
}

/**
 * Encapsulates the mini-script AI-generation flow: optimistic status,
 * server-progress polling, completion toast, and error cleanup.
 */
export function useMiniScriptGeneration({
  socialSessionId,
  playerCount,
  refetchSession,
}: UseMiniScriptGenerationOptions): UseMiniScriptGenerationReturn {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<MiniScriptGenerationStatus | null>(null)

  const resetGeneration = useCallback(() => {
    setGenerationStatus(null)
    setIsSubmitting(false)
  }, [])

  const submitGenerate = useCallback(
    async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean }): Promise<boolean> => {
      if (!socialSessionId) {
        return false
      }

      setIsSubmitting(true)
      const startedAt = Date.now()
      setGenerationStatus({
        stage: 'queued',
        progress: 5,
        startedAt,
        updatedAt: startedAt,
        estimatedTotalMs: 32_000,
      })

      const refreshGenerationStatus = () => {
        void apiRequest<MiniScriptGenerationStatus>({
          path: `/api/miniscript/generation-status?socialSessionId=${encodeURIComponent(socialSessionId)}`,
          timeout: 3000,
        })
          // Polls can overlap (800ms interval vs 3s request timeout), so a slow
          // older response may resolve after a newer one. Two guards:
          //  1. Never let any poll resurrect a terminal local stage (failed /
          //     complete) — the POST already settled the outcome locally.
          //  2. Monotonic updatedAt: a stale poll carrying an older server
          //     timestamp cannot regress the progress bar mid-flight.
          .then((status) =>
            setGenerationStatus((current) => {
              if (current?.stage === 'failed' || current?.stage === 'complete') return current
              if (current && status.updatedAt < current.updatedAt) return current
              return status
            }),
          )
          .catch(() => undefined)
      }

      const progressTimer = setInterval(refreshGenerationStatus, 800)
      refreshGenerationStatus()

      try {
        await apiRequest({
          path: '/api/miniscript/generate',
          method: 'POST',
          timeout: MINISCRIPT_GENERATION_TIMEOUT_MS,
          data: {
            socialSessionId,
            playerCount,
            style: payload.style,
            genres: payload.genres,
            lite: payload.lite,
          },
        })
        setGenerationStatus((current) => ({
          stage: 'complete',
          progress: 100,
          startedAt: current?.startedAt ?? startedAt,
          updatedAt: Date.now(),
          estimatedTotalMs: current?.estimatedTotalMs ?? 32_000,
        }))
        await new Promise((resolve) => setTimeout(resolve, 400))
        void refetchSession()
        void Taro.showToast({ title: '剧本已生成', icon: 'success', duration: TOAST_DEFAULT_MS })
        return true
      } catch (error) {
        const message = getErrorText(error, '生成没成功')
        logError('[IcebreakerSession] MiniScript generate failed', { socialSessionId, message })
        setGenerationStatus((current) => ({
          stage: 'failed',
          progress: current?.progress ?? 5,
          startedAt: current?.startedAt ?? startedAt,
          updatedAt: Date.now(),
          estimatedTotalMs: current?.estimatedTotalMs ?? 32_000,
        }))
        return false
      } finally {
        clearInterval(progressTimer)
        setIsSubmitting(false)
      }
    },
    [socialSessionId, playerCount, refetchSession],
  )

  return {
    isSubmitting,
    generationStatus,
    submitGenerate,
    resetGeneration,
  }
}
