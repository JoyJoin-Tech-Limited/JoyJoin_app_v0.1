/**
 * Pure state machine behind `useStepAbandonGuard`.
 *
 * Problem: onboarding pages fire `step_abandoned` from Taro page lifecycle
 * (hide/unload), but the same lifecycle also fires during the normal
 * post-submit navigation — a completed step must never count as abandoned.
 * And both `useDidHide` and the `__taroRouterChange`-based unload shim can
 * fire for a single exit, so the signal must be idempotent per page visit.
 *
 * Rules:
 * - `markCompleted()` — the step's success path ran; no abandonment for the
 *   rest of this page instance's life.
 * - `shouldTrackAbandon()` — true exactly once per visit (until `reset()`).
 * - `reset()` — re-arm on page show: a user who swipes back into the wizard
 *   and leaves again produces a fresh abandonment event.
 */
export interface AbandonGuard {
  markCompleted: () => void
  reset: () => void
  shouldTrackAbandon: () => boolean
}

export function createAbandonGuard(): AbandonGuard {
  let completed = false
  let tracked = false

  return {
    markCompleted() {
      completed = true
    },
    reset() {
      tracked = false
    },
    shouldTrackAbandon() {
      if (completed || tracked) {
        return false
      }
      tracked = true
      return true
    },
  }
}
