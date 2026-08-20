/**
 * Squad-unboxing auto-pocket handoff (2026-08-19) — the pure,
 * dependency-injected scheduler behind UX Strategy A "auto-pocket".
 *
 * The bug it fixes: the revealed state locks to 100dvh, and the fan-phase
 * column (bubble + transition line + 桌卡 + event panel) needs ~830-900rpx
 * against a ~563rpx budget — the 桌型诊断 chips and the transition line
 * rendered clipped. Once ALL cards are face-up in an interactive session the
 * fan has done its job, so the deck folds itself into the top pill via the
 * EXISTING manual-collapse path (cascade, heartbeat glow, spacer collapse,
 * SR announcement, persisted flag — all identical), handing the column the
 * relaxed ~1000rpx.
 *
 * Everything here is deterministic and unit-testable in a node environment:
 * timers and the fire-time guard probe are injected, so fake-timer tests can
 * assert the arm/cancel/fire semantics without rendering any Taro component
 * (same split as squadFlipState.ts). This module never imports Taro.
 *
 * Ownership: `useSquadUnboxingController` creates one session per groupId,
 * calls `arm` on the LIVE all-cards-up transition, `cancelPermanently` when
 * the user takes control (card focus) or the page resets, and `destroy` on
 * unmount. The fold itself is invoked through the controller's collapseDeck
 * via `onFire`, so manual and auto folds are byte-identical downstream.
 */

import { AUTO_POCKET_DELAY_MS, type DeckPhase } from './squadDeckCollapseState'
import { SETTLE_BREATH_TOTAL_MS, computeBurstTotalMs } from './squadDealTiming'

export type SquadAutoPocketState = 'idle' | 'armed' | 'fired' | 'cancelled'

export interface SquadAutoPocketArmInput {
  /** First-visit interactive session only — revisit / allRevealed never arms. */
  interactive: boolean
  /** The deck must be in the fan phase at arm time (a persisted-pocketed
   *  re-entry starts pocketed — nothing to do). */
  deckPhase: DeckPhase
  /** A focused card at the transition beat means the user is already engaged
   *  (the last flip auto-focuses in the one-step beat) — never arm over it. */
  focusedIndex: number
  /** Zero visible cards → nothing to fold (members still loading). */
  visibleCount: number
  /** Remote kill switch — the manual 收起卡组 affordance is hidden too. */
  pocketDeckEnabled: boolean
  /** Reduced-motion / degradation: the settle breath never plays on these
   *  tiers, so the pre-fold wait shortens to just the flip burst + quiet beat. */
  motionInstant: boolean
  /** Screenshot story states stay timer-independent (deterministic captures). */
  storyMode: boolean
  /**
   * How many cards went from face-down to face-up in the beat that triggered
   * the all-up transition. On instant tiers the reveal-all burst is still
   * in-flight when we arm, so the hold must last at least the burst wall-clock
   * before the fire-time guard can pass.
   */
  lastFlipCount: number
}

export interface SquadAutoPocketDeps {
  setTimer: (cb: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  /**
   * Fire-time guards re-probed against the LATEST state when the hold
   * expires: still fan phase, no focused card, no flip in flight. Returning
   * false consumes the handoff without firing (the user beat the fold to it).
   */
  canFire: () => boolean
  /** Invoked exactly once when the fold actually triggers (analytics + fold). */
  onFire: () => void
}

export interface SquadAutoPocketSession {
  /**
   * Start the hold. No-op unless every arm condition holds and the session is
   * still idle — the handoff fires at most ONCE per session.
   */
  arm: (input: SquadAutoPocketArmInput) => void
  /**
   * The user took control during the hold (card focus/tap) or the page reset
   * (swipe-back resetSignal): drop the pending fold PERMANENTLY — never
   * re-arm this session (掌控感: the deck stays where the user left it).
   */
  cancelPermanently: () => void
  getState: () => SquadAutoPocketState
  /** Clear the pending timer (unmount / groupId swap). */
  destroy: () => void
}

export function createSquadAutoPocketSession(deps: SquadAutoPocketDeps): SquadAutoPocketSession {
  let state: SquadAutoPocketState = 'idle'
  let timer: unknown = null

  const clearPendingTimer = () => {
    if (timer !== null) {
      deps.clearTimer(timer)
      timer = null
    }
  }

  const arm: SquadAutoPocketSession['arm'] = (input) => {
    if (state !== 'idle') return
    if (input.storyMode) return
    if (!input.interactive) return
    if (input.deckPhase !== 'fan') return
    if (input.focusedIndex >= 0) return
    if (input.visibleCount === 0) return
    if (!input.pocketDeckEnabled) return
    state = 'armed'
    // Motion tiers wait for the settle breath to finish (420 + 480ms) plus
    // the quiet beat; instant tiers skip the breath but must still wait out
    // the reveal-all burst (if any) so the fire-time guard is not falsely
    // tripped while cards are mid-flip.
    const burstMs = computeBurstTotalMs(input.lastFlipCount)
    const waitMs = input.motionInstant
      ? burstMs + AUTO_POCKET_DELAY_MS
      : SETTLE_BREATH_TOTAL_MS + AUTO_POCKET_DELAY_MS
    timer = deps.setTimer(() => {
      timer = null
      if (state !== 'armed') return
      // Fire-time guards: a manual collapse, a focused card, or a mid-flip
      // during the hold means the user beat the fold to it — the moment is
      // consumed either way and never re-arms.
      if (!deps.canFire()) {
        state = 'cancelled'
        return
      }
      state = 'fired'
      deps.onFire()
    }, waitMs)
  }

  const cancelPermanently = () => {
    if (state !== 'armed') return
    clearPendingTimer()
    state = 'cancelled'
  }

  return {
    arm,
    cancelPermanently,
    getState: () => state,
    destroy: clearPendingTimer,
  }
}
