import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'

// ─── Mood-anchored ambient field model (icebreaker fluid-UX S2, 2026-08-11) ──
//
// Pure derivation: SocialSessionState (+ reveal-bloom signal from the S1
// sensory detector) → the three locked field states of playbook §3.4 —
// waiting (cool violet-indigo), active (tightening as votes/dones
// accumulate), reveal (warm coral bloom). The page renders static gradient
// layers and cross-fades them with these opacities; nothing here touches
// timers, polling, or rendering.

export type MoodFieldState = 'waiting' | 'active' | 'reveal'

// Locked micro-copy (L1 pictogram copy spec §5, 2026-08-11): the field speaks
// first; copy is optional hairline/L3-grade seasoning. The ACTIVE state
// carries no copy by design — silence is the design.
export const MOOD_FIELD_FRAGMENT_WAITING = '先聊着'
export const MOOD_FIELD_FRAGMENT_REVEAL = '一起揭晓'

/** Reveal-bloom hold (ms) — the ~2s group moment, paired with the S1 Reveal
 *  haptic (playbook zone 4 / spec §5). */
export const MOOD_FIELD_BLOOM_MS = 2000

export interface MoodFieldModel {
  state: MoodFieldState
  /** 0..1 participation progress driving the field tightening. */
  progress: number
  /** Cool violet-indigo layer opacity (0..1). */
  coolOpacity: number
  /** Warm coral layer opacity (0..1). */
  warmOpacity: number
  /** Warm layer scale — gathers inward (1.12 → 1) as progress accumulates. */
  warmScale: number
  /** Hairline fragment for the current state; null = no copy by design. */
  fragment: string | null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value >= 1 ? 1 : value
}

type ProgressSample = { done: number; total: number }

function sample(done: number | undefined, total: number | undefined): ProgressSample | null {
  if (typeof done !== 'number' || typeof total !== 'number' || total <= 0) return null
  return { done, total }
}

// Per-phase participation extractors — client-side derivations from state the
// poll already carries (iteration plan S2: no server change). A phase without
// an extractor contributes no tightening (progress 0).
const PROGRESS_EXTRACTORS: Partial<
  Record<SocialIcebreakerPhase, (state: SocialSessionState) => ProgressSample | null>
> = {
  warmup: (state) => sample(state.warmupReadyUserIds?.length, state.playerCount),
  micro_challenge: (state) => sample(state.challengeCompletedBy?.length, state.playerCount),
  lie_detective: (state) => {
    const currentPlayer = state.lieDetectivePlayers?.[state.currentLieDetectivePlayerIndex ?? 0]
    if (!currentPlayer) return null
    const votesForCurrent = state.votes?.filter((vote) => vote.targetUserId === currentPlayer.userId).length
    return sample(votesForCurrent, state.playerCount)
  },
  personality_dice: (state) => {
    const done = new Set([...(state.diceCompletedBy ?? []), ...(state.dicePassedBy ?? [])])
    return sample(done.size, state.playerCount)
  },
  quip_battle: (state) =>
    sample(
      Math.max(state.quipBattleSubmittedUserIds?.length ?? 0, state.quipBattleVotedUserIds?.length ?? 0),
      state.playerCount,
    ),
  undercover_word: (state) => sample(state.undercoverWordVotedUserIds?.length, state.playerCount),
  group_mirror: (state) =>
    sample(
      Math.max(state.groupMirrorSubmittedUserIds?.length ?? 0, state.groupMirrorVotes?.length ?? 0),
      state.playerCount,
    ),
  auction: (state) => {
    const totalLots = state.auctionLots?.length
    if (!totalLots) return null
    if (state.auctionAllLotsClosed) return { done: totalLots, total: totalLots }
    return sample(state.auctionCurrentLotIndex ?? 0, totalLots)
  },
  speed_friending: (state) => {
    if (state.speedFriendingAllRoundsComplete) return { done: 1, total: 1 }
    return sample(state.speedFriendingCurrentRound, state.speedFriendingTotalRounds)
  },
  // Recap is the connection-achieved state: steady warm field at full
  // tightness (the bloom moments inside phases are the reveal state).
  recap: () => ({ done: 1, total: 1 }),
}

/** Participation progress for the current phase (0 when the phase carries no
 *  accumulable signal). */
export function deriveMoodFieldProgress(state: SocialSessionState): number {
  const extractor = PROGRESS_EXTRACTORS[state.currentPhase]
  if (!extractor) return 0
  const progressSample = extractor(state)
  if (!progressSample) return 0
  return clamp01(progressSample.done / progressSample.total)
}

export interface DeriveMoodFieldOptions {
  /** True while the S1 detector's reveal_appeared bloom window is open. */
  revealActive?: boolean
}

/** State precedence: reveal bloom wins over everything; explicit waiting
 *  contexts (host picking the next phase, warmup generating, group's part
 *  done) cool the field; everything else is the active tightening field.
 *  Note: `SocialSessionState.currentPhase` has no 'waiting' value — the
 *  client 'waiting' SessionPhase only exists pre-bootstrap (session null),
 *  where the field model is not derived at all. */
export function deriveMoodFieldState(
  state: SocialSessionState,
  progress: number,
  options: DeriveMoodFieldOptions = {},
): MoodFieldState {
  if (options.revealActive) return 'reveal'
  if (state.currentPhase === 'phase_selection') return 'waiting'
  if (state.currentPhase === 'warmup' && state.warmupTopicsStatus === 'generating') return 'waiting'
  if (progress >= 1 && state.currentPhase !== 'recap') return 'waiting'
  return 'active'
}

/** Full field model: state + layer opacities/scale + locked fragment. */
export function deriveMoodField(
  state: SocialSessionState,
  options: DeriveMoodFieldOptions = {},
): MoodFieldModel {
  const progress = deriveMoodFieldProgress(state)
  const fieldState = deriveMoodFieldState(state, progress, options)

  let coolOpacity = 0
  let warmOpacity = 0
  let warmScale = 1.12
  let fragment: string | null = null

  if (fieldState === 'waiting') {
    coolOpacity = 1
    fragment = MOOD_FIELD_FRAGMENT_WAITING
  } else if (fieldState === 'reveal') {
    warmOpacity = 1
    warmScale = 1
    fragment = MOOD_FIELD_FRAGMENT_REVEAL
  } else {
    // Active: the cool wash recedes and the coral gathers as votes/dones
    // accumulate — tightening is opacity + inward scale only (transform/
    // opacity budget, playbook §3.1).
    coolOpacity = 1 - 0.7 * progress
    warmOpacity = 0.15 + 0.45 * progress
    warmScale = 1.12 - 0.12 * progress
  }

  return {
    state: fieldState,
    progress,
    coolOpacity: clamp01(coolOpacity),
    warmOpacity: clamp01(warmOpacity),
    warmScale,
    fragment,
  }
}
