import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'
import { PHASE_REGISTRY } from '@shared/phaseRegistry'

/**
 * phaseOptOutModel — W3 honest opt-out (只想听 / 换一个).
 *
 * Pure, server-contract-shaped helpers shared by `PhaseOptOutControl` and the
 * action hook. The server is the authority: this module only mirrors the
 * documented state fields (`phaseOptOutUserIds`, `phaseSilentCompletedUserIds`,
 * `phaseRosterSnapshot`) and the per-phase completion arrays so the client
 * renders the same "complete" truth the guard uses.
 */

/** Approval copy — keep in one place so the surface and tests never drift. */
export const PHASE_OPT_OUT_COPY = {
  affordanceLabel: '只想听',
  affordanceHint: '换一个方式参与本轮，也算完成',
  busyLabel: '同步中…',
  optedOutTitle: '你选择了只想听',
  optedOutBody: '本轮已算完成，先听大家说',
  // G3: silent auto-complete is a real, server-written outcome — surface it
  // honestly instead of dropping `isSilentCompleted` on the floor.
  silentTitle: '本轮已自动跳过',
  silentBody: '这轮没等到你的参与，已自动算作完成',
} as const

export type PhaseActionErrorCode =
  | 'PHASE_MISMATCH'
  | 'OPT_OUT_NOT_APPLICABLE'
  | 'PHASE_ROSTER_LOCKED'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN'

export interface PhaseActionNotice {
  code: PhaseActionErrorCode
  title: string
  body: string
}

/**
 * The server allows opt-out in any `participation: 'full'` phase. The registry
 * is the shared authority, so we derive applicability rather than hardcoding
 * the phase list (a newly added full phase opts in automatically).
 */
export function isFullParticipationPhase(phase: string): boolean {
  const module = PHASE_REGISTRY[phase as SocialIcebreakerPhase]
  return module?.participation === 'full'
}

/**
 * Mirror of the server's per-phase completion array mapping
 * (`socialIcebreakerHelpers.getPhaseCompletionUserIds`). Opted-out and silent
 * players are appended to these arrays server-side, so reading them here keeps
 * the ready/complete counter honest and avoids a separate "skipped" badge.
 */
export function getPhaseCompletionUserIds(
  state: SocialSessionState,
  phase: string,
): string[] | undefined {
  switch (phase) {
    case 'micro_challenge':
      return state.challengeCompletedBy
    case 'lie_detective':
      return state.lieDetectiveCompletedUserIds
    case 'warmup':
      return state.warmupReadyUserIds
    case 'quip_battle':
      return state.quipBattleVotedUserIds
    case 'group_mirror':
      return state.groupMirrorSubmittedUserIds
    case 'undercover_word':
      return state.undercoverWordVotedUserIds
    default:
      return undefined
  }
}

/**
 * Mirror of the server's snapshot-scoped required set
 * (`socialIcebreakerHelpers.getPhaseRequiredRosterIds`): the phase-roster
 * snapshot minus anyone who opted out or was silently auto-completed. Empty
 * when the session predates the snapshot — callers then fall back to
 * `playerCount`.
 */
export function getPhaseRequiredParticipantIds(state: SocialSessionState): string[] {
  const snapshot = state.phaseRosterSnapshot?.length
    ? [...new Set(state.phaseRosterSnapshot)]
    : undefined
  if (!snapshot) return []

  const departed = new Set([
    ...(state.phaseOptOutUserIds ?? []),
    ...(state.phaseSilentCompletedUserIds ?? []),
  ])
  return snapshot.filter((userId) => !departed.has(userId))
}

/**
 * Client mirror of the server's synchronous snapshot-scoped completion check
 * (`isPhaseRosterComplete`, evaluated with unknown presence so nobody is
 * auto-completed). Every required snapshot member must appear in the phase's
 * completion array. Legacy sessions without a snapshot keep the historical
 * `completed >= playerCount` semantics.
 *
 * This is what stops a mid-phase late joiner (who grows `playerCount` but not
 * the snapshot) from disabling the host's advance button while the server guard
 * would already pass.
 */
export function isPhaseRosterCompleteForClient(
  state: SocialSessionState,
  phase: string,
  fallbackPlayerCount: number,
): boolean {
  const completed = new Set(getPhaseCompletionUserIds(state, phase) ?? [])
  if (!state.phaseRosterSnapshot?.length) {
    return completed.size >= fallbackPlayerCount
  }

  return getPhaseRequiredParticipantIds(state).every((userId) => completed.has(userId))
}

/**
 * Union of players who generated content and players the server marked complete
 * (opt-out / silent auto-complete). This is the honest ready set the phase
 * counter must read — opted-out players are appended to the completion array,
 * so they are counted like anyone else (never a separate "skipped" badge).
 */
export function resolveReadyParticipantIds(
  generatedUserIds: string[],
  completedUserIds: string[] | undefined,
): { readyIds: string[]; readyCount: number } {
  const ready = new Set([...generatedUserIds, ...(completedUserIds ?? [])])
  return { readyIds: [...ready], readyCount: ready.size }
}

export interface PhaseOptOutView {
  /** Phase accepts an honest opt-out (`participation: 'full'`). */
  applicable: boolean
  /** Viewer deliberately opted out of this phase. */
  hasOptedOut: boolean
  /** Viewer was auto-completed after the silent-player timeout. */
  isSilentCompleted: boolean
  /** Viewer already appears in the phase's completion array. */
  hasCompleted: boolean
  /** Render the opt-out affordance (not opted out, not complete). */
  showAffordance: boolean
}

export function resolvePhaseOptOutView(
  state: SocialSessionState,
  phase: string,
  currentUserId: string,
): PhaseOptOutView {
  const applicable = isFullParticipationPhase(phase)

  if (!applicable || !currentUserId) {
    return {
      applicable: false,
      hasOptedOut: false,
      isSilentCompleted: false,
      hasCompleted: false,
      showAffordance: false,
    }
  }

  const hasOptedOut = (state.phaseOptOutUserIds ?? []).includes(currentUserId)
  const isSilentCompleted = (state.phaseSilentCompletedUserIds ?? []).includes(currentUserId)
  const hasCompleted = (getPhaseCompletionUserIds(state, phase) ?? []).includes(currentUserId)

  return {
    applicable: true,
    hasOptedOut,
    isSilentCompleted,
    hasCompleted,
    showAffordance: !hasOptedOut && !isSilentCompleted && !hasCompleted,
  }
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const data = (error as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const nested = (data as { code?: unknown }).code
    if (typeof nested === 'string' && nested.trim() !== '') {
      return nested
    }
  }

  const direct = (error as { code?: unknown }).code
  if (typeof direct === 'string' && direct.trim() !== '') {
    return direct
  }

  return null
}

function readErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  const status = (error as { statusCode?: unknown }).statusCode
  return typeof status === 'number' ? status : null
}

export function classifyPhaseActionError(error: unknown): PhaseActionErrorCode {
  const code = readErrorCode(error)
  if (
    code === 'PHASE_MISMATCH' ||
    code === 'OPT_OUT_NOT_APPLICABLE' ||
    code === 'PHASE_ROSTER_LOCKED'
  ) {
    return code
  }

  if (code === 'SESSION_EXPIRED' || readErrorStatus(error) === 410) {
    return 'SESSION_EXPIRED'
  }

  const message = error instanceof Error ? error.message : ''
  if (message.includes('SESSION_EXPIRED')) {
    return 'SESSION_EXPIRED'
  }

  return 'UNKNOWN'
}

/**
 * Honest, non-generic copy per failure code. Rendered inline on the opt-out
 * control (never a bare "操作没成功" toast) so the user understands *why*.
 */
export function resolvePhaseOptOutNotice(error: unknown): PhaseActionNotice {
  const code = classifyPhaseActionError(error)
  switch (code) {
    case 'PHASE_MISMATCH':
      return {
        code,
        title: '环节已经切换',
        body: '刚刚进入新环节，回到当前回合再看一眼',
      }
    case 'OPT_OUT_NOT_APPLICABLE':
      return {
        code,
        title: '这一轮不能跳过',
        body: '这个环节需要大家一起参与，先和大家一起试试',
      }
    case 'PHASE_ROSTER_LOCKED':
      return {
        code,
        title: '这一轮已经开始',
        body: '你加入得晚了一点，先看看大家的陈述，下一轮再加入',
      }
    case 'SESSION_EXPIRED':
      return {
        code,
        title: '会话已结束',
        body: '这场破冰已经收尾，回到活动详情看看吧',
      }
    default:
      return {
        code: 'UNKNOWN',
        title: '操作没成功',
        body: '再试一次就好',
      }
  }
}
