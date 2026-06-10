import type { EventThemeVibe } from '@shared/api'

/**
 * Shared mini-program group-display formatters.
 *
 * Consolidated from matching-status, squad-unboxing, and pool-group-detail
 * page-local copies. Behavior is preserved byte-for-byte; pages pass an
 * optional `fallbackLabel` to getVibeLabel when they need a non-empty
 * default (e.g., squad-unboxing previously defaulted to "今晚成桌").
 */

export function formatDateTime(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) return '时间待定'

  const now = new Date()
  const includeYear = parsedDate.getFullYear() !== now.getFullYear()

  return parsedDate.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTimeParts(dateTime?: string | null): { date: string; time: string } {
  if (!dateTime) return { date: '时间待定', time: '' }
  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) return { date: '时间待定', time: '' }

  const now = new Date()
  const includeYear = parsedDate.getFullYear() !== now.getFullYear()

  const date = parsedDate.toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  const time = parsedDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return { date, time }
}

export function getVibeLabel(
  vibe?: EventThemeVibe | string | null,
  fallbackLabel: string = '',
): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意碰撞'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? fallbackLabel
  }
}
