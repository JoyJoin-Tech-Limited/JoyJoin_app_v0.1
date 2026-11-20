/**
 * Tab indicator arbitration.
 *
 * Five destinations can each want attention at once. When all of them light,
 * none of them means anything — so the bar enforces a budget:
 *
 *   - at most 2 indicators are visible at any moment
 *   - at most 1 of them is a number (numbers are expensive: they imply a count
 *     the user is expected to act on)
 *   - 发现 is never badged: the header bell already carries `counts.total`, and
 *     a second count on the same screen competes with itself
 *
 * Priority is fixed and product-owned, not dynamic:
 *   连接 (number, never suppressed) > 进行中 (dot) > 足迹 (dot) > 我的 (dot)
 *
 * 连接 is the only conversation surface, so its count is never suppressed —
 * the budget bends around it instead.
 */

export const MAX_VISIBLE_TAB_INDICATORS = 2

export interface TabIndicatorInputs {
  /** 连接 — unread conversations. Numbered, never suppressed. */
  chat: number
  /** 进行中 — center CTA: an unseen event-state change (排桌完成 / 场地已出 / 今日开局). */
  center: boolean
  /** 足迹 — unread event-status notification. */
  activities: boolean
  /** 我的 — a pending equipment draw. */
  profile: boolean
}

export interface TabIndicatorPlan {
  /** 发现 never carries an indicator. Present so the call site cannot forget it. */
  discover: 0
  chat: number
  center: boolean
  activities: boolean
  profile: boolean
}

function toCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

export function arbitrateTabIndicators(inputs: TabIndicatorInputs): TabIndicatorPlan {
  const chat = toCount(inputs.chat)

  // Ordered by product priority, so the first entries survive the budget.
  const dotCandidates: Array<'center' | 'activities' | 'profile'> = []
  if (inputs.center) dotCandidates.push('center')
  if (inputs.activities) dotCandidates.push('activities')
  if (inputs.profile) dotCandidates.push('profile')

  const dotBudget = Math.max(0, MAX_VISIBLE_TAB_INDICATORS - (chat > 0 ? 1 : 0))
  const visibleDots = new Set(dotCandidates.slice(0, dotBudget))

  return {
    discover: 0,
    chat,
    center: visibleDots.has('center'),
    activities: visibleDots.has('activities'),
    profile: visibleDots.has('profile'),
  }
}
