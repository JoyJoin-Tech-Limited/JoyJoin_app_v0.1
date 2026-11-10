import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * ConnectionPendingCard — prototype surface for the 24h mutual-selection loop
 * (G0 slice, 2026-11-10). Presentational only: no query, no countdown timer.
 *
 * Privacy hard rule: this card may only ever show a COUNT and a REVEAL MOMENT.
 * It must never receive names, selected targets, or per-person selection data —
 * the props below are the whole contract on purpose. There is deliberately no
 * `members`, `targets` or `peerName` slot to widen later by accident.
 *
 * Layout-shift rule: the shell reserves its height (`min-height` in the SCSS)
 * and both lines are single-line truncated, so a count refresh (or a missing
 * reveal label) never reflows the list around it. `count <= 0` renders nothing
 * rather than an empty card.
 *
 * Product tone: one quiet card. No red dot, no fake urgency, no emoji.
 */

/** Reveal-time moments arrive pre-formatted (e.g. `明晚 21:00 揭晓`). */
export function buildConnectionPendingCountLabel(count: number): string {
  return `有 ${count} 个选择等待揭晓`
}

/**
 * Format a server UTC reveal instant for display in Asia/Shanghai without
 * trusting the device timezone. This only renders a timestamp; the reveal
 * window itself is always computed server-side.
 */
export function formatConnectionRevealLabel(revealAt: string | null | undefined): string {
  if (!revealAt) return ''
  const parsed = new Date(revealAt)
  if (Number.isNaN(parsed.getTime())) return ''
  const shanghai = new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
  const month = shanghai.getUTCMonth() + 1
  const day = shanghai.getUTCDate()
  const hours = String(shanghai.getUTCHours()).padStart(2, '0')
  const minutes = String(shanghai.getUTCMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes} 揭晓`
}

export interface ConnectionPendingCardProps {
  /** How many selections the viewer made in the current reveal cycle. */
  count: number
  /** Pre-formatted reveal moment. Never a live countdown, never a due date. */
  revealAtLabel?: string
  /** Optional tap handler; without it the card stays a static, quiet surface. */
  onTap?: () => void
  className?: string
}

export default function ConnectionPendingCard({
  count,
  revealAtLabel,
  onTap,
  className = '',
}: ConnectionPendingCardProps) {
  const safeCount = Number.isFinite(count) ? Math.floor(count) : 0
  if (safeCount <= 0) return null

  const countLabel = buildConnectionPendingCountLabel(safeCount)
  const revealLabel = revealAtLabel?.trim() ?? ''
  const tappable = typeof onTap === 'function'
  const rootClassName = `connection-pending-card${tappable ? ' connection-pending-card--tappable' : ''}${
    className ? ` ${className}` : ''
  }`

  return (
    <View
      className={rootClassName}
      hoverClass={tappable ? 'connection-pending-card--pressed' : undefined}
      onClick={tappable ? onTap : undefined}
      role={tappable ? 'button' : undefined}
      aria-label={tappable ? (revealLabel ? `${countLabel}，${revealLabel}` : countLabel) : undefined}
    >
      <Text className='connection-pending-card__count'>{countLabel}</Text>
      <Text className='connection-pending-card__reveal'>{revealLabel}</Text>
    </View>
  )
}
