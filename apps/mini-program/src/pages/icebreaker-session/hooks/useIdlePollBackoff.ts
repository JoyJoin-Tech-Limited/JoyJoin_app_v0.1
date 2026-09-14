import { useCallback, useRef } from 'react'
import { POLL_SOCIAL_SESSION_MS } from '../../../lib/utils/uiConstants'

/**
 * Idle poll backoff for the Social Icebreaker session poll (W9, AC-W9.5).
 *
 * The 3s poll is the only state-delivery channel when WebSocket group beats are
 * disabled, so it must stay responsive while the table is active. When the
 * server state has not changed for a sustained window it is almost certainly an
 * idle beat (host reading a phase card, users between actions), and the poll can
 * safely slow down. `usePageVisibility` already pauses the poll entirely while
 * the page is hidden; this adds the "unchanged" dimension on top.
 *
 * Steady-state intervals: 3s ×3 → 6s ×3 → 12s (cap). Any content change (or a
 * re-show) resets to the base interval immediately. A failed poll holds at the
 * base interval too — network recovery must never wait on the idle backoff.
 */
export const IDLE_POLL_BASE_MS = POLL_SOCIAL_SESSION_MS // 3000
export const IDLE_POLL_MAX_MS = 12_000
/** Consecutive unchanged polls before each interval doubling. */
export const IDLE_POLL_UNCHANGED_STEPS = 3

/** Pure: interval after `unchangedPolls` consecutive unchanged results. */
export function nextPollInterval(unchangedPolls: number): number {
  const safe = Number.isFinite(unchangedPolls) ? Math.max(0, Math.floor(unchangedPolls)) : 0
  const tier = Math.min(Math.floor(safe / IDLE_POLL_UNCHANGED_STEPS), 2)
  return Math.min(IDLE_POLL_BASE_MS * 2 ** tier, IDLE_POLL_MAX_MS)
}

/** Pure: number of polls a fixed 3s interval would fire inside `windowMs` (inclusive of t=0). */
export function baselinePollCount(windowMs: number): number {
  if (windowMs < 0) return 0
  return Math.floor(windowMs / IDLE_POLL_BASE_MS) + 1
}

/** Pure: number of polls the backed-off schedule fires inside an idle `windowMs`. */
export function countIdlePolls(windowMs: number): number {
  if (windowMs < 0) return 0
  let elapsed = 0
  let polls = 1 // the t=0 poll
  let unchanged = 0
  for (;;) {
    elapsed += nextPollInterval(unchanged)
    if (elapsed > windowMs) break
    polls += 1
    unchanged += 1
  }
  return polls
}

/** Pure: fractional idle-poll reduction vs. the fixed baseline (0..1). */
export function idlePollReduction(windowMs: number): number {
  const baseline = baselinePollCount(windowMs)
  if (baseline === 0) return 0
  return 1 - countIdlePolls(windowMs) / baseline
}

interface PollStateRef {
  state: { data: unknown; status?: string }
}

export interface IdlePollBackoff {
  /**
   * TanStack Query `refetchInterval` callback. Returns `false` to pause while
   * `enabled` is false (hidden page / in-flight action), otherwise the
   * backoff interval derived from consecutive unchanged results.
   */
  intervalFor: (query: PollStateRef) => number | false
  /** Reset to the base interval (call on re-show / session change). */
  reset: () => void
}

/**
 * Tracks consecutive unchanged query results by **reference** — TanStack's
 * structural sharing returns the previous object when the parsed payload is
 * deeply equal, so reference identity is an exact "unchanged" signal.
 */
export function useIdlePollBackoff<TData>(enabled: boolean): IdlePollBackoff {
  const lastDataRef = useRef<unknown>(undefined)
  const hasDataRef = useRef(false)
  const unchangedRef = useRef(0)

  const reset = useCallback(() => {
    unchangedRef.current = 0
  }, [])

  const intervalFor = useCallback(
    (query: PollStateRef): number | false => {
      if (!enabled) return false
      // perf-W3: an error must not be mistaken for an idle beat. Keep the base
      // cadence during an outage (so reconnect recovery is prompt) and clear the
      // unchanged streak, otherwise the first post-recovery poll could jump
      // straight back to the 12s cap.
      if (query.state.status === 'error') {
        unchangedRef.current = 0
        return IDLE_POLL_BASE_MS
      }
      const data = query.state.data
      if (!hasDataRef.current) {
        hasDataRef.current = true
        lastDataRef.current = data
        unchangedRef.current = 0
      } else if (data !== undefined && data === lastDataRef.current) {
        unchangedRef.current += 1
      } else {
        lastDataRef.current = data
        unchangedRef.current = 0
      }
      return nextPollInterval(unchangedRef.current)
    },
    [enabled],
  )

  return { intervalFor, reset }
}
