import type { SocialSessionState } from '@shared/socialIcebreaker'

/**
 * P0 E2 (2026-10-20 E-track): host 误切确认 — count players who have NOT
 * submitted in the current submission-type phase. The host's advance tap
 * confirms via Taro.showModal only when this returns > 0.
 *
 * Zero-disturbance rules (deliberation §8 E2):
 *   - fully submitted → 0 (no modal)
 *   - host-paced phases (speed_friending, warmup, …) → 0 (never modal)
 *   - already-revealed / no-content-yet states → 0 (nothing to lose)
 *
 * Completion unions mirror the phase views: W3 honest opt-out
 * (`phaseOptOutUserIds`) and server auto-completed silent players
 * (`phaseSilentCompletedUserIds`) count as done everywhere; quip's voted
 * set implies submitted (the server appends opt-outs there too).
 *
 * Source of truth is the polled session state — no local caching.
 */
export function countPendingSubmissionsForAdvance(
  session: SocialSessionState,
  playerCount: number,
): number {
  const passiveCompleted = [
    ...(session.phaseOptOutUserIds ?? []),
    ...(session.phaseSilentCompletedUserIds ?? []),
  ]

  const missing = (submitted: Iterable<string>): number => {
    const done = new Set(submitted)
    for (const id of passiveCompleted) done.add(id)
    return Math.max(0, playerCount - done.size)
  }

  switch (session.currentPhase) {
    case 'group_mirror': {
      if (session.groupMirrorRevealed) return 0
      if (!session.groupMirrorQuestions || session.groupMirrorQuestions.length === 0) return 0
      return missing(session.groupMirrorSubmittedUserIds ?? [])
    }
    case 'undercover_word': {
      if (!session.undercoverWordPair || session.undercoverWordRevealed) return 0
      const round = session.undercoverWordRounds?.[session.undercoverWordCurrentRound ?? 0]
      return missing((round?.descriptions ?? []).map((d) => d.userId))
    }
    case 'quip_battle': {
      if (session.quipBattleRevealed) return 0
      if (!session.quipBattlePrompts || session.quipBattlePrompts.length === 0) return 0
      return missing([
        ...(session.quipBattleSubmittedUserIds ?? []),
        ...(session.quipBattleVotedUserIds ?? []),
      ])
    }
    default:
      return 0
  }
}
