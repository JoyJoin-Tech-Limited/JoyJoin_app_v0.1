import { useCallback, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import type {
  MiniScriptGenerationStatus,
  MiniScriptGenre,
  MiniScriptLibraryItem,
  MiniScriptLibraryResponse,
  MiniScriptStyle,
} from '@shared/miniscriptStoryFramework'
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
  libraryScripts: MiniScriptLibraryItem[]
  isLibraryLoading: boolean
  libraryError: string | null
  loadLibrary: (style: MiniScriptStyle) => Promise<void>
  selectScript: (scriptId: string) => Promise<boolean>
  submitGenerate: (payload: {
    style: MiniScriptStyle
    genres: MiniScriptGenre[]
    lite?: boolean
    selectedLabel?: string
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
  const [libraryScripts, setLibraryScripts] = useState<MiniScriptLibraryItem[]>([])
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const selectedStyleRef = useRef<MiniScriptStyle | null>(null)
  // Foreground guard for completion toasts (see N3 fix).
  const isPageVisibleRef = useRef(true)
  // Local monotonic epoch. The previous cross-clock guard compared the
  // server's `updatedAt` against the device clock: whenever the device clock
  // ran ahead of the server, every poll update was rejected and the progress
  // bar froze at 5% for the whole generation (2026-08-13 生成卡住 incident).
  // A per-submit epoch makes stale poll responses and post-reset writes
  // structurally impossible without touching wall clocks.
  const generationEpochRef = useRef(0)
  useDidShow(() => {
    isPageVisibleRef.current = true
  })
  useDidHide(() => {
    isPageVisibleRef.current = false
  })

  const resetGeneration = useCallback(() => {
    generationEpochRef.current += 1
    setGenerationStatus(null)
    setIsSubmitting(false)
    setLibraryScripts([])
    setLibraryError(null)
    selectedStyleRef.current = null
  }, [])

  const loadLibrary = useCallback(async (style: MiniScriptStyle) => {
    if (!socialSessionId) return
    const epoch = generationEpochRef.current
    selectedStyleRef.current = style
    setIsLibraryLoading(true)
    setLibraryError(null)
    try {
      const result = await apiRequest<MiniScriptLibraryResponse>({
        path: `/api/miniscript/library?socialSessionId=${encodeURIComponent(socialSessionId)}&style=${encodeURIComponent(style)}`,
        timeout: 5000,
      })
      if (selectedStyleRef.current !== style) return
      if (generationEpochRef.current !== epoch) return
      setLibraryScripts(result.scripts)
      // The library response carries the same server generation snapshot as
      // the generation-status poll, so it gets the same triple guard (epoch
      // above; terminal latch + monotonic progress here). Without it, a stale
      // non-terminal snapshot (e.g. 'persisting' at progress ≥92, fetched via
      // the modal's library poll after completion) resurrected the generation
      // card — the ghost re-entrant render + double toast from the
      // 2026-08-19 picker audit.
      setGenerationStatus((current) => {
        const next = result.generationStatus
        if (!next) return current
        if (current?.stage === 'failed' || current?.stage === 'complete') return current
        if (current && next.progress < current.progress) return current
        return next
      })
    } catch (error) {
      if (selectedStyleRef.current === style) {
        setLibraryError(getErrorText(error, '剧本列表暂时没加载出来'))
      }
    } finally {
      if (selectedStyleRef.current === style) setIsLibraryLoading(false)
    }
  }, [socialSessionId])

  const selectScript = useCallback(async (scriptId: string): Promise<boolean> => {
    if (!socialSessionId) return false
    setIsSubmitting(true)
    try {
      await apiRequest({
        path: '/api/miniscript/select',
        method: 'POST',
        data: { socialSessionId, scriptId },
      })
      void refetchSession()
      if (isPageVisibleRef.current) {
        void Taro.showToast({ title: '剧本已选好', icon: 'success', duration: TOAST_DEFAULT_MS })
      }
      return true
    } catch (error) {
      const message = getErrorText(error, '选择没成功')
      setLibraryError(message)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [socialSessionId, refetchSession])

  const submitGenerate = useCallback(
    async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean; selectedLabel?: string }): Promise<boolean> => {
      if (!socialSessionId) {
        return false
      }

      const epoch = ++generationEpochRef.current
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
          // older response may resolve after a newer one. Three guards:
          //  1. Epoch: a poll from a previous submit/reset must never write
          //     state (resetGeneration bumps the epoch).
          //  2. Terminal: never let any poll resurrect a terminal local stage
          //     (failed / complete) — the POST already settled the outcome.
          //  3. Monotonic progress: server progress only increases within one
          //     run (5 → 15 → … → 100), so a poll carrying older progress
          //     cannot regress the bar. Compared by progress value, never by
          //     cross-clock `updatedAt` timestamps.
          .then((status) => {
            if (generationEpochRef.current !== epoch) return
            setGenerationStatus((current) => {
              if (current?.stage === 'failed' || current?.stage === 'complete') return current
              if (current && status.progress < current.progress) return current
              return status
            })
          })
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
            selectedLabel: payload.selectedLabel,
          },
        })
        // If the user cancelled (reset bumped the epoch) while the POST was in
        // flight, don't resurrect a terminal status — a stale 'complete' would
        // pin the reopened modal on the CTA-less success shell.
        if (generationEpochRef.current === epoch) {
          setGenerationStatus((current) => ({
            stage: 'complete',
            progress: 100,
            startedAt: current?.startedAt ?? startedAt,
            updatedAt: Date.now(),
            estimatedTotalMs: current?.estimatedTotalMs ?? 32_000,
          }))
        }
        await new Promise((resolve) => setTimeout(resolve, 400))
        void refetchSession()
        // N3: the page may be in the background stack when the POST settles —
        // a toast firing on top of an unrelated page is noise, not feedback.
        // The AiGenerationShell's success state is the foreground signal; the
        // 3s poll delivers the framework either way.
        // Epoch guard: a superseded submit (reset / newer submit bumped the
        // epoch while this POST was in flight) must never toast.
        if (isPageVisibleRef.current && generationEpochRef.current === epoch) {
          void Taro.showToast({ title: '剧本已生成', icon: 'success', duration: TOAST_DEFAULT_MS })
        }
        return true
      } catch (error) {
        const message = getErrorText(error, '生成没成功')
        logError('[IcebreakerSession] MiniScript generate failed', { socialSessionId, message })
        if (generationEpochRef.current === epoch) {
          setGenerationStatus((current) => ({
            stage: 'failed',
            progress: current?.progress ?? 5,
            startedAt: current?.startedAt ?? startedAt,
            updatedAt: Date.now(),
            estimatedTotalMs: current?.estimatedTotalMs ?? 32_000,
          }))
        }
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
    libraryScripts,
    isLibraryLoading,
    libraryError,
    loadLibrary,
    selectScript,
    submitGenerate,
    resetGeneration,
  }
}
