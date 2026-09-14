import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SignalQualityVerdict } from '@shared/personality/responseSignalQuality'
import type { useOnboardingAnalytics } from '../../../../../hooks/onboarding/useOnboardingAnalytics'
import { haptics } from '../../../../../lib/utils/haptics'
import { logInfo, logWarn } from '../../../../../lib/utils/logger'

/**
 * P5a signal-quality retest prompt (2026-09-14) — once-per-session-result
 * suppression for the quiet 「悦仔有点拿不准你的风格，要不要再聊一轮？」 banner
 * on the personality results FinalStage.
 *
 * Semantics (locked by PM+UIUX review):
 * - `quality === 'low'` → show the prompt as a SECONDARY affordance (never
 *   blocking, never a modal, never between the user and their result).
 * - `'ok'` or ABSENT (legacy snapshots / degraded compute) → render nothing.
 * - Shown at most once per session result: dismissal AND retake both persist
 *   suppression in Taro storage, keyed by sessionId (bio-prompt dismissal
 *   precedent: joyjoin_profile_bio_prompt_dismissed:<userId>).
 * - `reasons` is machine-only and must never be rendered.
 *
 * The prefix is registered in lib/auth/userScopedStorage.ts so the hard-reset
 * path clears it together with the session snapshot it refers to.
 */
export const SIGNAL_RETEST_DISMISS_STORAGE_PREFIX = 'joyjoin_signal_retest_dismissed'

export function getSignalRetestDismissKey(sessionId: string): string {
  return `${SIGNAL_RETEST_DISMISS_STORAGE_PREFIX}:${sessionId}`
}

export function isSignalRetestDismissed(sessionId: string): boolean {
  try {
    return Taro.getStorageSync(getSignalRetestDismissKey(sessionId)) === true
  } catch (error) {
    logWarn('[SignalRetestPrompt] Failed to read dismiss state', {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export function markSignalRetestDismissed(sessionId: string): void {
  try {
    Taro.setStorageSync(getSignalRetestDismissKey(sessionId), true)
  } catch (error) {
    logWarn('[SignalRetestPrompt] Failed to persist dismiss state', {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Pure visibility rule — exported for the contract test. */
export function shouldShowSignalRetestPrompt(input: {
  quality: SignalQualityVerdict['quality'] | null | undefined
  sessionId: string | null | undefined
  dismissed: boolean
}): boolean {
  return input.quality === 'low' && Boolean(input.sessionId) && !input.dismissed
}

interface UseSignalRetestPromptParams {
  /** Session the displayed result belongs to (real assessment session id). */
  sessionId: string | null
  /** Verdict carried inside the result object; null/absent → treat as 'ok'. */
  signalQuality: SignalQualityVerdict | null | undefined
  analytics: ReturnType<typeof useOnboardingAnalytics>
  /** The reveal hook's restart handler — reLaunches the test in ?mode=restart. */
  onRestart: () => void
}

export function useSignalRetestPrompt({
  sessionId,
  signalQuality,
  analytics,
  onRestart,
}: UseSignalRetestPromptParams) {
  const [dismissed, setDismissed] = useState(false)

  // The result (and its sessionId) can resolve asynchronously on the
  // server-fetch path — re-read suppression whenever the session changes. A
  // new session gets a fresh read, so a retaken test can prompt again.
  useEffect(() => {
    if (!sessionId) {
      setDismissed(false)
      return
    }
    setDismissed(isSignalRetestDismissed(sessionId))
  }, [sessionId])

  const quality = signalQuality?.quality ?? null
  const visible = shouldShowSignalRetestPrompt({ quality, sessionId, dismissed })

  // Impression fires once per session per page-mount when the prompt is visible.
  const impressionTrackedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!visible || !sessionId) return
    if (impressionTrackedForRef.current === sessionId) return
    impressionTrackedForRef.current = sessionId
    logInfo('[SignalRetestPrompt] Shown', { sessionId, score: signalQuality?.score ?? null })
    analytics.interaction('signal_retest_prompt_impression', {
      sessionId,
      score: signalQuality?.score ?? null,
    })
  }, [visible, sessionId, signalQuality?.score, analytics])

  const handleDismiss = useCallback(() => {
    if (!sessionId) return
    haptics('light')
    markSignalRetestDismissed(sessionId)
    setDismissed(true)
    analytics.interaction('signal_retest_prompt_dismissed', { sessionId })
  }, [sessionId, analytics])

  const handleRetest = useCallback(() => {
    // Suppress before navigating away: the user has acted on the prompt, so
    // this session's result must never nag again (retake counts as consumed).
    if (sessionId) {
      markSignalRetestDismissed(sessionId)
      setDismissed(true)
      analytics.interaction('signal_retest_prompt_accepted', { sessionId })
    }
    haptics('light')
    onRestart()
  }, [sessionId, analytics, onRestart])

  return {
    showSignalRetestPrompt: visible,
    handleSignalRetest: handleRetest,
    handleSignalRetestDismiss: handleDismiss,
  }
}
