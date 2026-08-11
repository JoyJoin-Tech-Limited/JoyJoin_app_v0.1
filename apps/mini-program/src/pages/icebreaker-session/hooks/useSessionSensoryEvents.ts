import { useEffect, useRef } from 'react'
import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'
import type { SocialHapticPattern } from '../../../lib/utils/haptics'

// ─── Session sensory-event detector (icebreaker fluid-UX S1, 2026-08-11) ─────
//
// Compares successive SocialSessionState snapshots from the EXISTING 3s poll
// and emits typed sensory events on meaningful social transitions. Pure diff
// (diffSessionSensoryEvents) + thin React wrapper (useSessionSensoryEvents);
// no timers, subscriptions, or fetches of its own. Reused by later slices:
// S2 (reveal-bloom timing), S4 (transition choreography), S6-fallback
// (poll-detected group beats).

export type SessionSensoryEventKind =
  | 'phase_entered'
  | 'reveal_appeared'
  | 'own_turn_started'
  | 'all_ready'
  | 'recap_started'

export interface SessionSensoryEvent {
  kind: SessionSensoryEventKind
  /** Phase of the `next` snapshot when the event fired. */
  phase: SocialIcebreakerPhase
  /** Which configured source produced the event (e.g. 'lie_detective'). */
  source?: string
  at: number
}

export interface SessionSensoryDiffContext {
  currentUserId?: string
  /** Injectable clock for tests. */
  now?: number
}

/**
 * Sensory event → haptic pattern mapping. The playbook §10 ruling-3
 * degradation ladder (Your-turn stays unique, Nudge absorbs lesser attention
 * events, Celebration folds into Reveal; floor = 3 patterns) is executed by
 * editing THIS map only — never by rewriting the detector or the grammar.
 */
export const SENSORY_EVENT_HAPTIC_PATTERNS: Record<SessionSensoryEventKind, SocialHapticPattern> = {
  phase_entered: 'socialNudge',
  reveal_appeared: 'socialReveal',
  own_turn_started: 'socialYourTurn',
  all_ready: 'socialNudge',
  recap_started: 'socialCelebration',
}

// Reveal sources: a stable string key per source; a key change to a non-null
// value means "a reveal appeared". Boolean reveals keep one key while true
// (no re-fire) and re-arm when the server scrubs them between rounds.
const REVEAL_SOURCES: ReadonlyArray<{
  id: string
  key: (state: SocialSessionState) => string | null
}> = [
  {
    id: 'lie_detective',
    key: (state) =>
      state.currentLieDetectiveReveal
        ? `${state.currentLieDetectiveReveal.targetUserId}:${state.currentLieDetectiveReveal.revealedAt}`
        : null,
  },
  { id: 'group_mirror', key: (state) => (state.groupMirrorRevealed ? 'revealed' : null) },
  { id: 'quip_battle', key: (state) => (state.quipBattleRevealed ? 'revealed' : null) },
  { id: 'undercover_word', key: (state) => (state.undercoverWordRevealed ? 'revealed' : null) },
  // Warmup card flip: re-arms per topic so each new dealt card is its own beat.
  {
    id: 'warmup_topic',
    key: (state) => (state.warmupTopicRevealed ? `topic:${state.currentTopicIndex ?? 0}` : null),
  },
  // Personality-dice synchronized reveal countdown start.
  {
    id: 'personality_dice',
    key: (state) =>
      typeof state.diceRevealCountdownEndsAt === 'number' ? `${state.diceRevealCountdownEndsAt}` : null,
  },
]

// All-ready sources: a ready-set that grows to cover the full roster while
// the session sits in the source's phase. Gated on currentPhase so stale
// sets from a previous phase can never misfire.
const READY_SOURCES: ReadonlyArray<{
  id: string
  phase: SocialIcebreakerPhase
  ids: (state: SocialSessionState) => string[] | undefined
}> = [
  { id: 'warmup', phase: 'warmup', ids: (state) => state.warmupReadyUserIds },
  { id: 'dice_reveal', phase: 'personality_dice', ids: (state) => state.diceRevealReadyBy },
]

/** Who the current phase is waiting on, derivable from state alone.
 *  Returns null for phases without a per-user turn (open-input phases) and
 *  for personality-dice choose-mode (self-paced — the client index is the
 *  viewer's own, not a turn pointer). */
function resolveActiveTurnUserId(state: SocialSessionState): string | null {
  switch (state.currentPhase) {
    case 'warmup':
      return state.warmupTurnUserId ?? null
    case 'lie_detective':
      return state.lieDetectivePlayers?.[state.currentLieDetectivePlayerIndex ?? 0]?.userId ?? null
    case 'personality_dice':
      if (state.personalityDiceChooseModeEnabled) return null
      return state.personalityDiceChallenges?.[state.currentDicePlayerIndex ?? 0]?.userId ?? null
    default:
      return null
  }
}

function isRosterCovered(ids: string[] | undefined, playerCount: number): boolean {
  return playerCount >= 2 && Array.isArray(ids) && ids.length >= playerCount
}

/**
 * Pure state-diff: which sensory events does the transition prev → next imply?
 * Returns [] for the first snapshot (baseline), for identical-content
 * snapshots, and when the session identity changes (silent re-baseline).
 */
export function diffSessionSensoryEvents(
  prev: SocialSessionState | null,
  next: SocialSessionState,
  ctx: SessionSensoryDiffContext = {},
): SessionSensoryEvent[] {
  if (!prev || prev.socialSessionId !== next.socialSessionId) return []

  const at = ctx.now ?? Date.now()
  const events: SessionSensoryEvent[] = []

  // Phase transition. Entering recap is the session's one Celebration beat —
  // it replaces the generic phase-entered nudge rather than doubling it.
  if (prev.currentPhase !== next.currentPhase) {
    events.push({
      kind: next.currentPhase === 'recap' ? 'recap_started' : 'phase_entered',
      phase: next.currentPhase,
      source: 'phase',
      at,
    })
  }

  for (const source of REVEAL_SOURCES) {
    const nextKey = source.key(next)
    if (nextKey !== null && source.key(prev) !== nextKey) {
      events.push({ kind: 'reveal_appeared', phase: next.currentPhase, source: source.id, at })
    }
  }

  // Own turn: fires only on the edge where the active turn BECOMES the
  // current user — never while it stays theirs, never for others' turns.
  if (ctx.currentUserId) {
    const nextTurnUserId = resolveActiveTurnUserId(next)
    if (nextTurnUserId === ctx.currentUserId && resolveActiveTurnUserId(prev) !== ctx.currentUserId) {
      events.push({ kind: 'own_turn_started', phase: next.currentPhase, source: next.currentPhase, at })
    }
  }

  for (const source of READY_SOURCES) {
    if (next.currentPhase !== source.phase) continue
    const wasCovered = isRosterCovered(source.ids(prev), prev.playerCount)
    const isCovered = isRosterCovered(source.ids(next), next.playerCount)
    if (!wasCovered && isCovered) {
      events.push({ kind: 'all_ready', phase: next.currentPhase, source: source.id, at })
    }
  }

  return events
}

export interface UseSessionSensoryEventsOptions {
  /** Latest snapshot from the existing 3s poll (null before bootstrap). */
  session: SocialSessionState | null
  currentUserId?: string
  /** Master gate (icebreakerHapticGrammarEnabled). When false the detector
   *  stays silent but KEEPS tracking the baseline, so enabling the flag
   *  mid-session never bursts stale events. */
  enabled: boolean
  onEvent: (event: SessionSensoryEvent) => void
}

/**
 * Memoized diff driver: re-runs only when the poll delivers a new snapshot
 * reference. The baseline ref always advances — emission is the only thing
 * `enabled` gates.
 */
export function useSessionSensoryEvents({
  session,
  currentUserId,
  enabled,
  onEvent,
}: UseSessionSensoryEventsOptions): void {
  const prevSessionRef = useRef<SocialSessionState | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const prev = prevSessionRef.current
    prevSessionRef.current = session
    if (!enabled || !session) return
    const events = diffSessionSensoryEvents(prev, session, { currentUserId })
    for (const event of events) {
      onEventRef.current(event)
    }
  }, [session, enabled, currentUserId])
}
