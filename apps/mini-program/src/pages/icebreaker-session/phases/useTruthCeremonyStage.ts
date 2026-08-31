import { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TRUTH_CEREMONY_STAGE_MS,
  isCeremonyStageRevealedByBeat,
  type TruthCeremonyPlan,
  type TruthCeremonyStage,
} from './miniScriptTruthCeremonyModel'

export interface TruthCeremonyController {
  /** Index into plan.stages; ≥ stages.length once the ceremony completes. */
  stageIndex: number
  /** Current stage, or null when inactive / complete. */
  stage: TruthCeremonyStage | null
  /** True in static/hidden modes and after the final stage. */
  isComplete: boolean
  /** Whether the current stage's CONTENT may render — free stages are always
   *  revealed; host-paced beats (culprit / honor) wait for the server
   *  miniScriptCeremonyBeat (Q14). */
  stageRevealed: boolean
  /** True while a host-paced beat holds the ceremony (host sees the 下一段
   *  CTA, everyone else sees the waiting hint). */
  awaitingHost: boolean
  /** Tap-through: advance to the next stage immediately (user skip). The
   *  view only calls this when stageRevealed — a held beat cannot be
   *  tap-skipped past its server gate. */
  advance: () => void
}

/** Rejoin / re-show landing index for an already-revealed session: the first
 *  stage still held behind the server beat, or complete when every gate has
 *  passed (beat ≥ 2 → straight to the final static view). Never replays. */
function rejoinStageIndex(stages: TruthCeremonyStage[], serverBeat: number): number {
  const firstHeld = stages.findIndex((stage) => !isCeremonyStageRevealedByBeat(stage, serverBeat))
  return firstHeld === -1 ? Number.MAX_SAFE_INTEGER : firstHeld
}

/**
 * useTruthCeremonyStage — SOLE owner of truth-ceremony reveal timing
 * (AnalyzingAnimation precedent): one hook advances the stage machine on
 * per-stage timers, the user can tap through via `advance`, and no other
 * effect may drive stage state.
 *
 * Host-paced beats (V2 P3 Q14): the auto-advance timer only runs while the
 * current stage is revealed. On a held beat (culprit needs beat ≥ 1, honor
 * needs beat ≥ 2) the machine parks until the poll lands the advanced
 * miniScriptCeremonyBeat — then the dwell timer starts from that moment.
 *
 * Replay semantics (swipe-back safety, page-stack hide/show):
 *  - A mount into an already-revealed session (rejoin) lands on the first
 *    still-held stage, or COMPLETE once beat ≥ 2 — the ceremony never
 *    replays for late joiners.
 *  - `useDidShow` applies the same jump, so swiping back and re-entering
 *    mid-ceremony never rewinds stages the table already saw.
 */
export function useTruthCeremonyStage(
  plan: TruthCeremonyPlan,
  solutionRevealed: boolean,
  serverBeat: number,
): TruthCeremonyController {
  const staged = plan.mode === 'staged'
  const stages = plan.stages

  // Lazy init: revealed-at-mount → land on the first still-held stage (or
  // complete). Otherwise start at stage 0; the ceremony only plays when the
  // reveal lands live while this view is mounted.
  const [stageIndex, setStageIndex] = useState(() =>
    solutionRevealed ? (staged ? rejoinStageIndex(stages, serverBeat) : Number.MAX_SAFE_INTEGER) : 0,
  )

  const advance = useCallback(() => {
    setStageIndex((index) => index + 1)
  }, [])

  const stageRevealed =
    staged && stageIndex < stages.length
      ? isCeremonyStageRevealedByBeat(stages[stageIndex], serverBeat)
      : false

  // Auto-advance — the single timer chain. Cleanup on every stage change
  // cancels the pending auto-timer, so a manual tap-through never
  // double-fires. Held beats run no timer at all: the poll-driven serverBeat
  // flip re-runs this effect and starts the dwell from the reveal moment.
  useEffect(() => {
    if (!staged || stageIndex >= stages.length || !stageRevealed) return undefined
    const stage = stages[stageIndex]
    const timer = setTimeout(advance, TRUTH_CEREMONY_STAGE_MS[stage])
    return () => clearTimeout(timer)
  }, [staged, stageIndex, stages, advance, stageRevealed])

  // Swipe-back safety: a re-shown page with the solution already revealed
  // jumps to the first still-held stage (or complete) — no ceremony replay
  // after a hide/show cycle.
  //
  // Note (perf-audit NIT): these refs are written during render, a
  // legacy-React-mode pattern. Taro's mini-program React runtime runs legacy
  // mode (no concurrent features), so the write is idempotent and safe; the
  // useDidShow callback below only ever needs the latest polled values.
  const solutionRevealedRef = useRef(solutionRevealed)
  solutionRevealedRef.current = solutionRevealed
  const serverBeatRef = useRef(serverBeat)
  serverBeatRef.current = serverBeat
  const stagesRef = useRef(stages)
  stagesRef.current = stages
  useDidShow(() => {
    if (solutionRevealedRef.current && staged) {
      setStageIndex(rejoinStageIndex(stagesRef.current, serverBeatRef.current))
    }
  })

  return {
    stageIndex,
    stage: staged && stageIndex < stages.length ? stages[stageIndex] : null,
    isComplete: !staged || stageIndex >= stages.length,
    stageRevealed,
    awaitingHost: staged && stageIndex < stages.length && !stageRevealed,
    advance,
  }
}
