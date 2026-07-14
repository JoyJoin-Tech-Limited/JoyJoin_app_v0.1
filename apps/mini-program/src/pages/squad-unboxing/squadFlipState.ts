/**
 * Squad-unboxing tap-to-reveal flip session — the pure, dependency-injected
 * state machine behind the face-down fan game (locked contract:
 * .git/.orchestration/sprints/sprint-contract.squad-tap-to-reveal.md).
 *
 * Everything here is deterministic and unit-testable in a node environment:
 * the clock, timers, and analytics sink are injected, so fake-timer tests can
 * assert the one-step ordering (narration never tap-instant), the arrival
 * guard (auto-me without chrome/narration), burst guards, and the single-fire
 * `all_revealed` semantics without rendering any Taro component.
 *
 * Ownership (AC-13): `useSquadUnboxingController` wraps this session and
 * exposes `flippedIds` / `flipOne` / `flipAll` / `unflippedCount`; focus
 * state stays page-owned; per-card local flip state stays banned.
 */

import {
  AUTO_ME_FLIP_DELAY_MS,
  FLIP_DURATION_MS,
  FLIP_IN_FLIGHT_GUARD_MS,
  FLIP_NARRATION_DELAY_MS,
  computeBurstStaggerMs,
  computeBurstTotalMs,
} from './squadDealTiming'

export { AUTO_ME_FLIP_DELAY_MS, FLIP_DURATION_MS, FLIP_IN_FLIGHT_GUARD_MS, FLIP_NARRATION_DELAY_MS }

/** How a card came to be face-up — drives the `method` analytics dimension. */
export type CardFlipMethod = 'tap' | 'auto_me' | 'reveal_all'

export interface CardFlipMeta {
  /** Flattened roster index of the flipped card. */
  index: number
  isBestPartner: boolean
}

export interface SquadFlipSessionDeps {
  now: () => number
  setTimer: (cb: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  track: (eventType: string, payload: Record<string, unknown>) => void
}

export interface DealSettledInput {
  /** Visible (fan-capped) roster ids in deal order. */
  visibleIds: readonly string[]
  currentUserId?: string | null
  bestPartnerUserId?: string | null
  /** First-visit session (reveal flag absent at arrival). Re-entry all-up
   *  sessions never auto-flip and never fire `all_revealed`. */
  interactive: boolean
  /** Reduced-motion / degradation: auto-flip fires instantly, no timers. */
  instant: boolean
}

export interface FlipSnapshot {
  flippedIds: ReadonlySet<string>
  /** Per-card flip transition delay (ms) — burst stagger; 0 for single flips. */
  flipDelayById: ReadonlyMap<string, number>
}

export interface FlipAllResult {
  /** Ids that were face-down and are now flipping, in burst order. */
  flippedNow: readonly string[]
  delayById: ReadonlyMap<string, number>
  /** Wall-clock until the last burst flip settles (0 when nothing flipped). */
  totalMs: number
}

export interface SquadFlipSession {
  getSnapshot: () => FlipSnapshot
  subscribe: (listener: () => void) => () => void
  notifyDealSettled: (input: DealSettledInput) => void
  flipOne: (id: string, method: 'tap' | 'auto_me', meta: CardFlipMeta) => { flipped: boolean }
  flipAll: (metaOf: (id: string) => CardFlipMeta) => FlipAllResult
  isFlipInFlight: () => boolean
  /** Story-mode seeding: mark ids face-up without analytics or timers. */
  seedFlipped: (ids: readonly string[]) => void
  destroy: () => void
}

export function createSquadFlipSession(deps: SquadFlipSessionDeps): SquadFlipSession {
  let flippedIds = new Set<string>()
  let flipDelayById = new Map<string, number>()
  let visibleIds: readonly string[] = []
  let interactive = false
  let dealSettledAt: number | null = null
  let allRevealedFired = false
  let flippedByTap = 0
  let flippedByRevealAll = 0
  let inFlightUntil = 0
  let autoMeTimer: unknown = null
  const listeners = new Set<() => void>()

  const emit = () => {
    listeners.forEach((listener) => listener())
  }

  const clearAutoMeTimer = () => {
    if (autoMeTimer !== null) {
      deps.clearTimer(autoMeTimer)
      autoMeTimer = null
    }
  }

  const armInFlightGuard = (windowMs: number) => {
    const until = deps.now() + windowMs
    if (until > inFlightUntil) inFlightUntil = until
  }

  const checkAllRevealed = () => {
    if (!interactive || allRevealedFired || visibleIds.length === 0) return
    const allUp = visibleIds.every((id) => flippedIds.has(id))
    if (!allUp) return
    allRevealedFired = true
    deps.track('squad_unboxing_all_revealed', {
      flippedByTap,
      flippedByRevealAll,
      durationMs: dealSettledAt === null ? 0 : Math.max(0, deps.now() - dealSettledAt),
    })
  }

  const flipOne: SquadFlipSession['flipOne'] = (id, method, meta) => {
    if (flippedIds.has(id)) return { flipped: false }
    flippedIds = new Set([...flippedIds, id])
    flipDelayById = new Map([[id, 0]])
    armInFlightGuard(FLIP_IN_FLIGHT_GUARD_MS)
    if (method === 'tap') flippedByTap += 1
    deps.track('squad_unboxing_card_flip', {
      method,
      index: meta.index,
      isBestPartner: meta.isBestPartner,
    })
    checkAllRevealed()
    emit()
    return { flipped: true }
  }

  const notifyDealSettled: SquadFlipSession['notifyDealSettled'] = (input) => {
    visibleIds = input.visibleIds
    interactive = input.interactive
    if (dealSettledAt === null) dealSettledAt = deps.now()

    const meId = input.currentUserId
    if (!input.interactive || !meId || flippedIds.has(meId)) return
    // Overflow guard (A2): the viewer can sit beyond the fan cap — never
    // auto-flip a card that is not visible. `visibleIds.indexOf(meId)` would
    // be -1 and the flip would fire analytics for a card the user can't see.
    if (!visibleIds.includes(meId)) return

    const autoFlip = () => {
      // Arrival guard (AC-17): the auto flip is a pure face change — no focus
      // chrome, no narration. Those live in the page and are never touched
      // here.
      flipOne(meId, 'auto_me', {
        index: visibleIds.indexOf(meId),
        isBestPartner: false,
      })
    }

    if (input.instant) {
      autoFlip()
      return
    }
    clearAutoMeTimer()
    autoMeTimer = deps.setTimer(autoFlip, AUTO_ME_FLIP_DELAY_MS)
  }

  const flipAll: SquadFlipSession['flipAll'] = (metaOf) => {
    const remaining = visibleIds.filter((id) => !flippedIds.has(id))
    if (remaining.length === 0) {
      return { flippedNow: [], delayById: new Map(), totalMs: 0 }
    }

    const staggerMs = computeBurstStaggerMs(remaining.length)
    const delayById = new Map<string, number>()
    remaining.forEach((id, order) => delayById.set(id, order * staggerMs))

    flippedIds = new Set([...flippedIds, ...remaining])
    flipDelayById = delayById
    flippedByRevealAll += remaining.length
    const totalMs = computeBurstTotalMs(remaining.length)
    armInFlightGuard(totalMs + FLIP_IN_FLIGHT_GUARD_MS)

    remaining.forEach((id) => {
      const meta = metaOf(id)
      deps.track('squad_unboxing_card_flip', {
        method: 'reveal_all',
        index: meta.index,
        isBestPartner: meta.isBestPartner,
      })
    })
    checkAllRevealed()
    emit()
    return { flippedNow: remaining, delayById, totalMs }
  }

  return {
    getSnapshot: () => ({ flippedIds, flipDelayById }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notifyDealSettled,
    flipOne,
    flipAll,
    isFlipInFlight: () => deps.now() < inFlightUntil,
    seedFlipped: (ids) => {
      const fresh = ids.filter((id) => !flippedIds.has(id))
      if (fresh.length === 0) return
      flippedIds = new Set([...flippedIds, ...fresh])
      flipDelayById = new Map(fresh.map((id) => [id, 0]))
      emit()
    },
    destroy: () => {
      clearAutoMeTimer()
      listeners.clear()
    },
  }
}

/**
 * Count of visible cards still face-down. Pure derivation used by the
 * controller's `unflippedCount` and the hint-chip label (AC-04).
 */
export function computeUnflippedCount(
  visibleIds: readonly string[],
  flippedIds: ReadonlySet<string>,
): number {
  let count = 0
  for (const id of visibleIds) {
    if (!flippedIds.has(id)) count += 1
  }
  return count
}

export interface NarrationScheduleDeps {
  setTimer: (cb: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
}

/**
 * One-step beat ordering (AC-02): the dock-bubble narration swap is scheduled
 * AFTER the flip ends — never tap-instant. Returns a cancel function; the
 * caller cancels on unmount and on any new focus action so an interrupted
 * flip never narrates a stale card (REL-04).
 */
export function scheduleFlipSettleNarration(
  deps: NarrationScheduleDeps,
  onNarrate: () => void,
  delayMs: number = FLIP_NARRATION_DELAY_MS,
): () => void {
  const handle = deps.setTimer(onNarrate, delayMs)
  return () => deps.clearTimer(handle)
}
