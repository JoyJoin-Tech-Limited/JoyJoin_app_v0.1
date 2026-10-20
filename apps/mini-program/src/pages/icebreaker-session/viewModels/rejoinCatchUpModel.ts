/**
 * Rejoin catch-up model (sprint icebreaker-polish-p1, contract AC-02).
 *
 * Two pure derivations feeding the rejoin compensation surfaces:
 *
 *  1. `deriveRejoinDuty` — the current user's outstanding obligation in the
 *     live phase (「第 2 轮描述中 · 你还没描述」). Drives the ≤4s catch-up
 *     chip shown on (a) the away→back edge of `leftUserIds` and (b) cold
 *     re-entry bootstrap (强杀重进) when the phase is already past waiting.
 *     Null when the user owes nothing — the chip never fabricates urgency.
 *
 *  2. `deriveAwayMemberNames` — roster displayNames for `leftUserIds`
 *     (补5 掉线全桌可见): the waiting views render 「等 {名}（暂离）」 next
 *     to the count. Optional-chaining all the way: flag off / field absent
 *     → empty list → nothing renders.
 *
 * No Taro / React imports — keep this module pure (unit-testable), same
 * discipline as sessionPhaseSequence.ts.
 */

export interface RejoinDuty {
  /** What the table is doing now, e.g. 「第 2 轮描述中」. */
  context: string
  /** What I still owe, e.g. 「你还没描述」. */
  duty: string
}

/** Chip copy: one line, 「现在：{context} · {duty}」. */
export function formatRejoinCatchUpChip(duty: RejoinDuty): string {
  return `现在：${duty.context} · ${duty.duty}`
}

interface UndercoverRoundLike {
  descriptions?: Array<{ userId?: string }>
}

/**
 * Minimal session shape the duty derivation reads. Every field is optional —
 * a missing field means the duty is unknowable, never guessed.
 */
export interface RejoinDutySessionSource {
  phase?: string
  playerCount?: number
  // undercover_word
  undercoverWordPair?: unknown | null
  undercoverWordRounds?: UndercoverRoundLike[]
  undercoverWordCurrentRound?: number
  undercoverWordRevealed?: boolean
  undercoverWordVotedUserIds?: string[]
  // W3 completion union (opted-out / silent members count toward gates)
  phaseOptOutUserIds?: string[]
  phaseSilentCompletedUserIds?: string[]
  // group_mirror
  groupMirrorQuestions?: unknown[]
  groupMirrorSubmittedUserIds?: string[]
  groupMirrorRevealed?: boolean
  // quip_battle
  quipBattlePrompts?: unknown[]
  quipBattleSubmittedUserIds?: string[]
  quipBattleVotedUserIds?: string[]
  quipBattleRevealed?: boolean
  // lie_detective
  lieDetectivePlayers?: Array<{ userId?: string; statements?: unknown[] }>
  currentLieDetectivePlayerIndex?: number
  currentLieDetectiveReveal?: unknown | null
  votes?: Array<{ voterId?: string; targetUserId?: string }>
  // micro_challenge
  currentChallenge?: unknown | null
  challengeCompletedBy?: string[]
  // mini_script
  miniScriptPlayerReady?: Record<string, boolean>
  miniScriptVotes?: Array<{ userId?: string }>
  miniScriptVoteOpenedAt?: number
  miniScriptSolutionRevealed?: boolean
  miniScriptRoleAssignments?: Record<string, number>
}

/**
 * Resolve the current user's outstanding obligation. Returns null when:
 *  - the phase carries no per-player obligation (waiting/warmup/recap/ended/
 *    phase_selection/speed_friending/auction/personality_dice rotations), or
 *  - the user has already done their part, or
 *  - the state fields needed to tell are absent.
 */
export function deriveRejoinDuty(
  session: RejoinDutySessionSource | null | undefined,
  currentUserId: string,
): RejoinDuty | null {
  if (!session || !currentUserId) return null

  switch (session.phase) {
    case 'undercover_word': {
      if (!session.undercoverWordPair || session.undercoverWordRevealed) return null
      const currentRound = session.undercoverWordCurrentRound ?? 0
      const round = session.undercoverWordRounds?.[currentRound]
      const myDescribed = round?.descriptions?.some((d) => d.userId === currentUserId) ?? false
      if (!myDescribed) {
        return { context: `第 ${currentRound + 1} 轮描述中`, duty: '你还没描述' }
      }
      // Vote duty only once the vote has actually OPENED — the view gate is
      // allDescribed (descriptions ∪ opt-out/silent completions ≥ playerCount)
      // && currentRound >= 1. Before that an unvoted user is waiting, not behind.
      const playerCount = session.playerCount ?? 0
      const votedUserIds = session.undercoverWordVotedUserIds ?? []
      const describedCount = new Set([
        ...(round?.descriptions?.map((d) => d.userId).filter(Boolean) ?? []),
        ...(session.phaseOptOutUserIds ?? []),
        ...(session.phaseSilentCompletedUserIds ?? []),
      ]).size
      if (currentRound >= 1 && playerCount > 0 && describedCount >= playerCount && !votedUserIds.includes(currentUserId)) {
        return { context: '卧底投票中', duty: '你还没投票' }
      }
      return null
    }

    case 'group_mirror': {
      if ((session.groupMirrorQuestions ?? []).length === 0 || session.groupMirrorRevealed) return null
      const submitted = session.groupMirrorSubmittedUserIds ?? []
      if (!submitted.includes(currentUserId)) {
        return { context: '群像镜像投票中', duty: '你还没提交' }
      }
      return null
    }

    case 'quip_battle': {
      if ((session.quipBattlePrompts ?? []).length === 0 || session.quipBattleRevealed) return null
      const submitted = new Set([
        ...(session.quipBattleSubmittedUserIds ?? []),
        // Voting implies submitting (same union the hero view uses).
        ...(session.quipBattleVotedUserIds ?? []),
      ])
      if (!submitted.has(currentUserId)) {
        return { context: '机智对决作答中', duty: '你还没提交答案' }
      }
      // Vote duty only once the vote has OPENED (everyone submitted) — same
      // gate as the hero view's voting branch.
      const playerCount = session.playerCount ?? 0
      const voted = session.quipBattleVotedUserIds ?? []
      if (playerCount > 0 && submitted.size >= playerCount && !voted.includes(currentUserId)) {
        return { context: '机智对决投票中', duty: '你还没投票' }
      }
      return null
    }

    case 'lie_detective': {
      const players = session.lieDetectivePlayers ?? []
      const me = players.find((p) => p.userId === currentUserId)
      if (me && (me.statements ?? []).length === 0) {
        return { context: '陈述准备中', duty: '你还没写好陈述' }
      }
      // Vote duty only once voting is open for the current player: every
      // roster player has statements and no reveal is on screen yet.
      const everyoneGenerated = players.length > 0 && players.every((p) => (p.statements ?? []).length > 0)
      const currentPlayer = players[session.currentLieDetectivePlayerIndex ?? 0]
      if (
        everyoneGenerated &&
        currentPlayer &&
        currentPlayer.userId !== currentUserId &&
        !session.currentLieDetectiveReveal &&
        !(session.votes ?? []).some(
          (v) => v.voterId === currentUserId && v.targetUserId === currentPlayer.userId,
        )
      ) {
        return { context: '侦探投票中', duty: '你还没投票' }
      }
      return null
    }

    case 'micro_challenge': {
      if (!session.currentChallenge) return null
      const completed = session.challengeCompletedBy ?? []
      if (!completed.includes(currentUserId)) {
        return { context: '挑战进行中', duty: '你还没完成' }
      }
      return null
    }

    case 'mini_script': {
      const assigned = session.miniScriptRoleAssignments ?? {}
      if (!(currentUserId in assigned)) return null
      const ready = session.miniScriptPlayerReady ?? {}
      if (ready[currentUserId] !== true) {
        return { context: '剧本准备中', duty: '你还没点「准备好了」' }
      }
      if (
        session.miniScriptVoteOpenedAt &&
        !session.miniScriptSolutionRevealed &&
        !(session.miniScriptVotes ?? []).some((v) => v.userId === currentUserId)
      ) {
        return { context: '剧本投票中', duty: '你还没投票' }
      }
      return null
    }

    default:
      return null
  }
}

/**
 * Phases where a bootstrap catch-up chip is meaningful — meta/terminal
 * phases never surface one (contract AC-02: 「phase 非 waiting 且有未竟义务」).
 */
export const CATCH_UP_CHIP_PHASES: ReadonlySet<string> = new Set([
  'undercover_word',
  'group_mirror',
  'quip_battle',
  'lie_detective',
  'micro_challenge',
  'mini_script',
])

/** Auto-dismiss window for the chip (contract: ≤4s). */
export const REJOIN_CATCH_UP_CHIP_MS = 4000

/**
 * One-shot chip text for a rejoin moment. Null when the phase is not
 * chip-eligible or the user owes nothing.
 */
export function resolveRejoinCatchUpText(
  session: RejoinDutySessionSource | null | undefined,
  currentUserId: string,
): string | null {
  const phase = session?.phase ?? ''
  if (!CATCH_UP_CHIP_PHASES.has(phase)) return null
  const duty = deriveRejoinDuty(session, currentUserId)
  return duty ? formatRejoinCatchUpChip(duty) : null
}

/**
 * 补5: displayNames of roster members currently marked away (`leftUserIds`).
 * Flag off / field absent → [] (callers render nothing). Order follows the
 * roster so the note is stable across polls.
 */
export function deriveAwayMemberNames(
  session: { leftUserIds?: string[] } | null | undefined,
  participants: ReadonlyArray<{ userId: string; displayName?: string }>,
): string[] {
  const left = session?.leftUserIds
  if (!left || left.length === 0) return []
  const leftSet = new Set(left)
  return participants
    .filter((p) => leftSet.has(p.userId))
    .map((p) => p.displayName)
    .filter((name): name is string => Boolean(name))
}

/**
 * 补5 waiting-view suffix (contract AC-02b): appended right next to the
 * count in a waiting status line — 「 · 等阿澈、桃桃（暂离）」. Empty list →
 * empty string (flag off / nobody away → the line renders unchanged).
 */
export function formatAwayWaitSuffix(names: ReadonlyArray<string>): string {
  if (names.length === 0) return ''
  return ` · 等${names.join('、')}（暂离）`
}
