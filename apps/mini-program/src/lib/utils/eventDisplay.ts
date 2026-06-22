/**
 * Shared event display helpers for the mini-program.
 *
 * Centralises date/time formatting and status labelling so the Events tab,
 * Center Hub, and any future surfaces stay consistent.
 */

export function formatEventDateTime(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return '时间待定'

  const now = new Date()
  const includeYear = parsed.getFullYear() !== now.getFullYear()

  return parsed.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatEventDateShort(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return '时间待定'

  const now = new Date()
  const includeYear = parsed.getFullYear() !== now.getFullYear()

  return parsed.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
