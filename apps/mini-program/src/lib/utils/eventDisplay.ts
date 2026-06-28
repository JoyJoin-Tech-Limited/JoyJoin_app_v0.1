/**
 * Shared event display helpers for the mini-program.
 *
 * Centralises date/time formatting and status labelling so the Events tab,
 * Center Hub, and any future surfaces stay consistent.
 */

// Statuses eligible to use the finalized group time as the displayed datetime.
const FINAL_DATE_TARGET_STATUSES = new Set(['upcoming', 'pending', 'registered', 'matched', 'confirmed', 'venue_unlocked'])

/**
 * Returns the datetime that should be displayed on a joined-event card,
 * matching the countdown target precedence.
 *
 * For active events that have been assigned to a group and received a finalized
 * time, `finalDateTime` is preferred. Otherwise fall back to the top-level
 * `dateTime`. This keeps partition logic, card display, and countdown in sync.
 */
export function getJoinedEventDisplayDateTime(event: { status?: string | null; dateTime?: string | null; finalDateTime?: string | null; groupId?: string | null }): string | undefined {
  const status = event.status ?? 'upcoming'

  if (event.groupId && event.finalDateTime && FINAL_DATE_TARGET_STATUSES.has(status)) {
    return event.finalDateTime
  }

  return event.dateTime ?? undefined
}

export function formatEventDateTime(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return '时间待定'

  const now = new Date()
  const includeYear = parsed.getFullYear() !== now.getFullYear()

  // Friendly relative labels for today / tomorrow / day after tomorrow.
  const dateMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((dateMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))

  let datePrefix: string | undefined
  if (diffDays === 0) datePrefix = '今天'
  else if (diffDays === 1) datePrefix = '明天'
  else if (diffDays === 2) datePrefix = '后天'

  const datePart = parsed.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  const timePart = parsed.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return datePrefix ? `${datePrefix} ${timePart}` : `${datePart} ${timePart}`
}

export function formatEventDateShort(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return '时间待定'

  const now = new Date()
  const includeYear = parsed.getFullYear() !== now.getFullYear()

  const dateMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((dateMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return `今天 ${formatTimePart(parsed)}`
  if (diffDays === 1) return `明天 ${formatTimePart(parsed)}`

  return parsed.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatTimePart(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function getCountdownText(startTime: string): string {
  const now = new Date()
  const start = new Date(startTime)
  const diff = start.getTime() - now.getTime()
  if (diff < 0) return '进行中'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `${hours}小时后开始`
  const days = Math.floor(hours / 24)
  return `${days}天后开始`
}

export function getJoinedEventStatusLabel(status?: string | null): string {
  switch (status) {
    case 'matched':
      return '已匹配'
    case 'pending':
      return '匹配中'
    case 'registered':
      return '已报名'
    case 'confirmed':
      return '已确认'
    case 'venue_unlocked':
      return '场地已解锁'
    case 'completed':
    case 'attended':
      return '已完成'
    case 'cancelled':
      return '已取消'
    case 'upcoming':
      return '待参加'
    default:
      return ''
  }
}
