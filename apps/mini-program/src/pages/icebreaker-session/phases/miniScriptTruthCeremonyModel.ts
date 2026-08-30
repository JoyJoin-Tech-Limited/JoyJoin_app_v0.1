/**
 * MiniScript V2 P3 — staged truth-reveal ceremony model (pure, no Taro/React).
 *
 * The truth sub-phase currently renders the whole solution statically. P3
 * replaces that with a four-beat ceremony for flag-snapshot-on sessions that
 * actually played round 2:
 *
 *   tally   → 嫌疑人投票分布 (round-1 tally)
 *   motive  → 真动机揭示 (only when the reveal carries motive text)
 *   culprit → 当事人落锤 (culprit card, heavy haptic + land animation)
 *   honor   → 两步全对荣誉登场 (本桌名侦探 cards, staggered pop-in)
 *
 * Host-paced beats (locked Q14): tally and motive stay free (auto-advance +
 * tap-through); culprit and honor hold until the server advances
 * `miniScriptCeremonyBeat` via POST /api/miniscript/advance-ceremony (host
 * only). Culprit content renders once beat ≥ 1, honor once beat ≥ 2.
 *
 * Degrade paths (locked grill Q13 / P2 contract):
 *  - flag snapshot off, round 2 never played, or a legacy script → 'static':
 *    the EXISTING static truth view renders untouched.
 *  - reduced-motion (useMiniRevealMotion / getSystemReducedMotion precedent)
 *    → 'static' as well: instant render, no staged timing, no haptics.
 *
 * The hook (useTruthCeremonyStage) is the SOLE owner of ceremony timing —
 * the AnalyzingAnimation precedent: one owner advances stages, the user can
 * tap through, and no sibling effect may set stage state on its own timer.
 */

export type TruthCeremonyStage = 'tally' | 'culprit' | 'motive' | 'honor'

export type TruthCeremonyMode = 'hidden' | 'static' | 'staged'

export interface TruthCeremonyPlan {
  mode: TruthCeremonyMode
  /** Ordered stages for 'staged' mode; empty otherwise. */
  stages: TruthCeremonyStage[]
}

export interface TruthCeremonyPlanInput {
  solutionRevealed: boolean
  /** Flag snapshot taken at mini_script phase entry (miniScriptV2Enabled). */
  v2Enabled: boolean
  /** Round 2 was actually played (motive results recorded at reveal). */
  showTwoStepResults: boolean
  /** revealedSolution.why present — the motive stage is skipped without it. */
  hasMotiveText: boolean
  /** Round-1 tally has at least one row — the tally stage is skipped empty. */
  hasTallyRows: boolean
  reduceMotion: boolean
}

/**
 * Auto-advance dwell per stage (ms). Reading-time driven, not animation
 * driven: the tally needs a scan of 2–6 rows, the culprit is the climax beat
 * (land animation + heavy haptic settle), the motive is one line, and honor
 * carries the staggered card pop-in (last delay 450ms) plus name reading.
 * A full auto run is ≈12.6s; every stage is tap-through-able, so an eager
 * table finishes in four taps.
 */
export const TRUTH_CEREMONY_STAGE_MS: Record<TruthCeremonyStage, number> = {
  tally: 2800,
  culprit: 3400,
  motive: 2800,
  honor: 3600,
}

/** Haptic fired on ENTERING the stage (null = silent). Typed as the literal
 *  subset of HapticType so this module stays Taro-free; the view maps it
 *  through `haptics()`. */
export const TRUTH_CEREMONY_STAGE_HAPTIC: Record<TruthCeremonyStage, 'heavy' | 'success' | null> = {
  tally: null,
  culprit: 'heavy',
  motive: null,
  honor: 'success',
}

/** Per-stage headline copy (no emoji — JoyJoinIcon carries the visuals). */
export const TRUTH_CEREMONY_STAGE_TITLE: Record<TruthCeremonyStage, string> = {
  tally: '嫌疑人投票分布',
  culprit: '当事人落锤',
  motive: '真动机揭示',
  honor: '本桌名侦探',
}

/** Tap-to-continue affordance caption shown under every ceremony stage. */
export const TRUTH_CEREMONY_CONTINUE_HINT = '轻触继续'

/** Host CTA on the held beats (culprit / honor) — POSTs advance-ceremony. */
export const TRUTH_CEREMONY_HOST_NEXT_CTA = '下一段 ›'

/** Non-host waiting hint on the held beats. */
export const TRUTH_CEREMONY_WAITING_HOST_HINT = '等主持人揭晓下一段…'

/** V2 P3 Q14: which server `miniScriptCeremonyBeat` unlocks each stage's
 *  content. null = free stage (auto-advance + tap-through, no server gate).
 *  Mirrors the server contract exactly (beat 1 = culprit, beat 2 = honor). */
export const TRUTH_CEREMONY_STAGE_GATE_BEAT: Record<TruthCeremonyStage, number | null> = {
  tally: null,
  motive: null,
  culprit: 1,
  honor: 2,
}

/** Whether a stage's content may render at the given server beat. Free
 *  stages are always revealed; gated stages wait for advance-ceremony. */
export function isCeremonyStageRevealedByBeat(stage: TruthCeremonyStage, serverBeat: number): boolean {
  const gate = TRUTH_CEREMONY_STAGE_GATE_BEAT[stage]
  return gate === null || serverBeat >= gate
}

export function planTruthCeremony(input: TruthCeremonyPlanInput): TruthCeremonyPlan {
  if (!input.solutionRevealed) {
    return { mode: 'hidden', stages: [] }
  }
  // Staged ceremony requires the full P2 two-step path: flag snapshot on AND
  // round 2 actually played. Anything less (legacy script, flag off, host
  // revealed from round 1) keeps the existing static truth view untouched.
  const staged = input.v2Enabled && input.showTwoStepResults && !input.reduceMotion
  if (!staged) {
    return { mode: 'static', stages: [] }
  }
  const stages: TruthCeremonyStage[] = [
    ...(input.hasTallyRows ? (['tally'] as const) : []),
    ...(input.hasMotiveText ? (['motive'] as const) : []),
    'culprit',
    'honor',
  ]
  return { mode: 'staged', stages }
}
