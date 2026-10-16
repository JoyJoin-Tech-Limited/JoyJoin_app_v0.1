import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'

/**
 * Session phase sequence model (sprint icebreaker-uiux-wave2, AC-01/AC-02).
 *
 * Single data source for the shell's resident progress chip (「第 N/M 环 ·
 * 环节名」) and the entry phase map (「话题卡 → 挑战 → 回顾」). Pure
 * derivation from session state fields the client already polls —
 * `runPlan.segments` (compiled plan) with `enabledPhases` as the fallback
 * and a trailing `recap` appended when the plan doesn't carry it. Custom
 * sessions (no plan, host-picked phases) degrade to a loose chip with no
 * total, never to a fabricated M.
 *
 * No Taro / React imports — keep this module pure (unit-testable).
 */

/** Phases the map/chip never lists (meta/transitional states). */
const NON_GAME_PHASES: ReadonlySet<string> = new Set(['phase_selection'])

export interface SessionPhaseSequenceItem {
  phase: SocialIcebreakerPhase
  /** True when this item is the session's current phase. */
  current: boolean
  /** True when this item finished before the current phase. */
  done: boolean
}

export interface SessionPhaseSequence {
  /** Ordered game phases (warmup … recap), meta phases filtered out. */
  items: SessionPhaseSequenceItem[]
  /** 0-based index of the current phase inside `items`; -1 when not listed. */
  currentIndex: number
  /** Total listed phases — the M in 「第 N/M 环」. */
  total: number
  /** False for custom/unknown sequences — the chip must not render a total. */
  hasTotal: boolean
}

interface SessionPhaseSequenceSource {
  phase?: string
  completedPhases?: SocialIcebreakerPhase[]
  enabledPhases?: SocialIcebreakerPhase[]
  runPlan?: { segments?: Array<{ phase: SocialIcebreakerPhase }> }
}

/**
 * Resolve the ordered phase list the session will walk. Priority:
 *  1. `runPlan.segments` — the compiled plan is the authoritative order.
 *  2. `enabledPhases` + trailing `recap` — legacy preset sessions.
 *  3. `completedPhases` + current — custom sessions (host picks ad hoc);
 *     `hasTotal` is false here because the future is unknowable.
 */
export function resolveSessionPhaseSequence(
  session: SessionPhaseSequenceSource | null | undefined,
): SessionPhaseSequence {
  const current = session?.phase ?? ''
  const completed = session?.completedPhases ?? []

  let ordered: SocialIcebreakerPhase[] = []
  let hasTotal = true

  const planPhases = (session?.runPlan?.segments ?? [])
    .map((segment) => segment.phase)
    .filter((phase) => !NON_GAME_PHASES.has(phase))
  if (planPhases.length > 0) {
    ordered = planPhases
  } else {
    const enabled = (session?.enabledPhases ?? []).filter(
      (phase) => !NON_GAME_PHASES.has(phase),
    )
    if (enabled.length > 0) {
      ordered = enabled.includes('recap') ? enabled : [...enabled, 'recap']
    } else {
      // Custom mode / unknown: only the walked path + the current phase are
      // knowable. No total — the chip renders the loose variant.
      const walked = completed.filter((phase) => !NON_GAME_PHASES.has(phase))
      const rest: SocialIcebreakerPhase[] = []
      if (current && !NON_GAME_PHASES.has(current) && current !== 'waiting' && current !== 'ended') {
        rest.push(current as SocialIcebreakerPhase)
      }
      ordered = [...walked, ...rest]
      hasTotal = false
    }
  }

  const currentIndex = ordered.indexOf(current as SocialIcebreakerPhase)
  const items = ordered.map((phase, index) => ({
    phase,
    current: index === currentIndex,
    done: index < currentIndex || (currentIndex === -1 && completed.includes(phase)),
  }))

  return { items, currentIndex, total: ordered.length, hasTotal }
}

/**
 * Chip payload for the shell. Null when the chip must stay hidden:
 * waiting/warmup render the entry map instead (AC-01 ↔ AC-02 division of
 * labour — the two states never duplicate the same information), and
 * ended/phase_selection carry no progress meaning.
 */
export function resolvePhaseChipPayload(
  session: SessionPhaseSequenceSource | null | undefined,
): { index1Based: number; total: number; phase: SocialIcebreakerPhase } | { loose: true; phase: SocialIcebreakerPhase } | null {
  const current = session?.phase ?? ''
  if (!current || current === 'waiting' || current === 'warmup' || current === 'ended' || current === 'phase_selection') {
    return null
  }
  const sequence = resolveSessionPhaseSequence(session)
  if (!sequence.hasTotal) {
    return { loose: true, phase: current as SocialIcebreakerPhase }
  }
  if (sequence.currentIndex < 0) {
    return null
  }
  return {
    index1Based: sequence.currentIndex + 1,
    total: sequence.total,
    phase: current as SocialIcebreakerPhase,
  }
}

/**
 * Entry phase map payload (AC-02) — rendered on the session's first screens
 * (waiting view + warmup shell). Null once the session leaves warmup: from
 * the first game phase onward the resident chip (AC-01) owns orientation.
 */
export function resolvePhaseMapPayload(
  session: SessionPhaseSequenceSource | null | undefined,
): SessionPhaseSequence | null {
  const current = session?.phase ?? ''
  if (current !== 'waiting' && current !== 'warmup') {
    return null
  }
  const sequence = resolveSessionPhaseSequence(session)
  // A map of one item (or an unknowable custom sequence with nothing walked)
  // teaches nothing — hide it rather than rendering a degenerate strip.
  if (sequence.items.length < 2) {
    return null
  }
  return sequence
}
