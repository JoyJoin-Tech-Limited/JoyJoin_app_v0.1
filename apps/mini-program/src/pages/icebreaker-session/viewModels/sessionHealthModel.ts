/**
 * Session health model (sprint icebreaker-polish-p1, contract AC-06).
 *
 * `session_health_snapshot` rides the recap first-display moment once per
 * user: { phaseCount, myActionCount, playerCount }. `myActionCount` is
 * DERIVED from the final session state the client already holds — zero new
 * requests (contract 补6: 「从既有本地动作计数推导」). It counts the user's
 * own visible contributions across the playable phases:
 *
 *   undercover_word  — my descriptions (per round) + my vote
 *   group_mirror     — my submitted answers
 *   quip_battle      — my answers + (1 when I voted)
 *   lie_detective    — my statements + my votes
 *   micro_challenge  — 1 when I completed
 *   personality_dice — 1 when I completed or passed
 *   auction          — my bids
 *   mini_script      — ready + evidence presented + votes
 *   speed_friending  — rounds I was seated in
 *
 * No Taro / React imports — pure and unit-testable.
 */

export interface SessionHealthSource {
  // undercover_word
  undercoverWordRounds?: Array<{ descriptions?: Array<{ userId?: string }> }>
  undercoverWordVotes?: Array<{ voterId?: string }>
  // group_mirror
  groupMirrorAnswers?: Array<{ userId?: string }>
  // quip_battle
  quipBattleAnswers?: Array<{ userId?: string }>
  quipBattleVotedUserIds?: string[]
  // lie_detective
  lieDetectivePlayers?: Array<{ userId?: string; statements?: unknown[] }>
  votes?: Array<{ voterId?: string }>
  // micro_challenge
  challengeCompletedBy?: string[]
  // personality_dice
  diceCompletedBy?: string[]
  dicePassedBy?: string[]
  // auction
  auctionBidHistory?: Array<{ userId?: string }>
  // mini_script
  miniScriptPlayerReady?: Record<string, boolean>
  miniScriptVotes?: Array<{ userId?: string }>
  // speed_friending
  speedFriendingPairs?: Array<{ userIdA?: string; userIdB?: string }>
}

export function countMySessionActions(
  session: SessionHealthSource | null | undefined,
  currentUserId: string,
): number {
  if (!session || !currentUserId) return 0
  let count = 0

  // undercover_word
  for (const round of session.undercoverWordRounds ?? []) {
    for (const desc of round.descriptions ?? []) {
      if (desc.userId === currentUserId) count += 1
    }
  }
  if ((session.undercoverWordVotes ?? []).some((v) => v.voterId === currentUserId)) count += 1

  // group_mirror
  count += (session.groupMirrorAnswers ?? []).filter((a) => a.userId === currentUserId).length

  // quip_battle
  count += (session.quipBattleAnswers ?? []).filter((a) => a.userId === currentUserId).length
  if ((session.quipBattleVotedUserIds ?? []).includes(currentUserId)) count += 1

  // lie_detective
  const me = (session.lieDetectivePlayers ?? []).find((p) => p.userId === currentUserId)
  count += me?.statements?.length ?? 0
  count += (session.votes ?? []).filter((v) => v.voterId === currentUserId).length

  // micro_challenge
  if ((session.challengeCompletedBy ?? []).includes(currentUserId)) count += 1

  // personality_dice
  if ((session.diceCompletedBy ?? []).includes(currentUserId)) count += 1
  if ((session.dicePassedBy ?? []).includes(currentUserId)) count += 1

  // auction
  count += (session.auctionBidHistory ?? []).filter((b) => b.userId === currentUserId).length

  // mini_script
  if (session.miniScriptPlayerReady?.[currentUserId] === true) count += 1
  count += (session.miniScriptVotes ?? []).filter((v) => v.userId === currentUserId).length

  // speed_friending
  count += (session.speedFriendingPairs ?? []).filter(
    (p) => p.userIdA === currentUserId || p.userIdB === currentUserId,
  ).length

  return count
}
