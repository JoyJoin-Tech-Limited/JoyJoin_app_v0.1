import Taro from '@tarojs/taro'
import { logWarn } from '../utils/logger'

/**
 * Group seat-vacancy detection (post-reveal Phase 0 安心补位).
 *
 * After a post-reveal cancel the server decrements `eventPoolGroups.memberCount`
 * and deletes the exiter's registration, so a fresh payload carries no signal
 * that a seat was vacated. To keep the group view honest (neutral 「排桌中…」
 * placeholder, never the exiter's identity) the client remembers the highest
 * seat count it has observed per group (storage-seeded baseline, same pattern
 * as `jj_revealed_<groupId>`) and derives the vacated count from the drop.
 *
 * Driven purely by existing queries (group details / registrations refetch) —
 * no new polling.
 */

const STORAGE_KEY_PREFIX = 'jj_group_seat_count_'

/** Cap on rendered placeholders — a matched group can lose at most a couple
 *  of seats before the collapse path (<4 remaining) takes over. */
export const MAX_VACATED_SEAT_PLACEHOLDERS = 3

export interface GroupSeatVacancy {
  /** Number of neutral 「排桌中…」 placeholder seats to render. */
  vacatedSeatCount: number
  /** Actual remaining headcount for shrink copy (「今晚是温馨的 N 人局」). */
  displayCount: number
}

export function readGroupSeatBaseline(groupId: string): number | null {
  if (!groupId) return null
  try {
    const value = Taro.getStorageSync<number>(`${STORAGE_KEY_PREFIX}${groupId}`)
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  } catch (error) {
    logWarn('[GroupSeatVacancy] Failed to read seat baseline', {
      groupId,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export function writeGroupSeatBaseline(groupId: string, count: number): void {
  if (!groupId || count <= 0) return
  try {
    Taro.setStorageSync(`${STORAGE_KEY_PREFIX}${groupId}`, count)
  } catch (error) {
    logWarn('[GroupSeatVacancy] Failed to persist seat baseline', {
      groupId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Pure vacancy resolution. Two signals:
 *  1. baseline gap — the remembered seat count dropped (post-reveal cancel
 *     committed while we had seen the fuller table);
 *  2. skew gap — `memberCount` is fresh but the members payload is still
 *     catching up mid-vacancy (cache skew window).
 * Only applies while the group is still matched/active; collapsed, completed,
 * or cancelled groups render no placeholders.
 */
export function resolveGroupSeatVacancy(params: {
  baseline: number | null
  advertisedCount: number
  membersLength: number
  isMatched: boolean
}): GroupSeatVacancy {
  const { baseline, advertisedCount, membersLength, isMatched } = params

  if (!isMatched || advertisedCount <= 0) {
    return { vacatedSeatCount: 0, displayCount: Math.max(advertisedCount, membersLength) }
  }

  const baselineGap = baseline != null ? Math.max(baseline - advertisedCount, 0) : 0
  const skewGap = Math.max(advertisedCount - membersLength, 0)
  const vacatedSeatCount = Math.min(Math.max(baselineGap, skewGap), MAX_VACATED_SEAT_PLACEHOLDERS)

  return { vacatedSeatCount, displayCount: advertisedCount }
}
