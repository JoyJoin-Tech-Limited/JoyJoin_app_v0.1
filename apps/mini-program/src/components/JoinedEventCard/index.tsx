import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ARCHETYPE_FAMILY_COLORS } from '@shared/archetypeColors'
import type { JoinedEventSummary } from '@shared/api'
import {
  formatEventDateTime,
  getCountdownText,
  getJoinedEventStatusLabel,
} from '../../lib/utils/eventDisplay'
import './index.scss'

// ─── Constants ─────────────────────────────────────────────────

const FALLBACK_COLOR = '#8B5CF6'

// Status → accent family mapping. Keeps the Events tab visually consistent
// with the Oracle Card family system on Discover.
const STATUS_FAMILY_MAP: Record<string, 'fire' | 'calm' | 'warm' | 'cool'> = {
  matched: 'fire',
  venue_unlocked: 'fire',
  confirmed: 'fire',
  upcoming: 'calm',
  pending: 'calm',
  registered: 'calm',
  completed: 'warm',
  attended: 'warm',
  cancelled: 'cool',
}

// Human, playful momentum copy for each status.
const STATUS_MOMENTUM_COPY: Record<string, string> = {
  matched: '匹配成功，期待见面',
  venue_unlocked: '场地已解锁',
  confirmed: '报名成功',
  upcoming: '即将开始',
  pending: '匹配中',
  registered: '报名成功',
  completed: '圆满结束',
  attended: '已参加',
  cancelled: '已取消',
}

interface JoinedEventCardProps {
  event: JoinedEventSummary
  index?: number
  onClick?: () => void
  isDegradation?: boolean
}

export default React.memo(function JoinedEventCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
}: JoinedEventCardProps) {
  const status = event.status ?? 'upcoming'
  const family = STATUS_FAMILY_MAP[status] ?? 'calm'
  const familyColor = ARCHETYPE_FAMILY_COLORS[family] ?? FALLBACK_COLOR

  const statusLabel = getJoinedEventStatusLabel(status)
  const momentumLabel = STATUS_MOMENTUM_COPY[status] ?? statusLabel
  const isPast = status === 'completed' || status === 'attended' || status === 'cancelled'
  const isLive = status === 'matched' || status === 'venue_unlocked'
  const shouldAnimate = !isDegradation && index < 6
  const animDelay = shouldAnimate ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  const handleClick = React.useCallback(() => {
    try {
      if (Taro.vibrateShort) Taro.vibrateShort({ type: 'light' })
    } catch { /* haptic is decorative */ }
    onClick?.()
  }, [onClick])

  const dateTimeText = formatEventDateTime(event.dateTime)
  const countdownText =
    !isPast && typeof event.dateTime === 'string'
      ? getCountdownText(event.dateTime)
      : null

  // Decompose the formatted date/time into a visual hierarchy similar to
  // Oracle Card's decision facts: "6月24日 周六" + "19:00".
  const { datePart, timePart, weekdayPart } = React.useMemo(() => {
    if (!event.dateTime) return { datePart: '时间待定', timePart: '', weekdayPart: '' }
    const parsed = new Date(event.dateTime)
    if (Number.isNaN(parsed.getTime())) {
      return { datePart: '时间待定', timePart: '', weekdayPart: '' }
    }

    const now = new Date()
    const includeYear = parsed.getFullYear() !== now.getFullYear()

    const datePart = parsed.toLocaleDateString('zh-CN', {
      year: includeYear ? 'numeric' : undefined,
      month: 'long',
      day: 'numeric',
    })
    const weekdayPart = parsed.toLocaleDateString('zh-CN', { weekday: 'short' })
    const timePart = parsed.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return { datePart, timePart, weekdayPart }
  }, [event.dateTime])

  const cardAriaLabel = `${event.title ?? '悦聚活动'}，${dateTimeText}，${event.location ?? '地点待定'}，${statusLabel}`

  const cardClass = [
    'joined-event-card',
    `joined-event-card--family-${family}`,
    isPast ? 'joined-event-card--past' : '',
    isDegradation ? 'joined-event-card--low-end' : '',
    shouldAnimate ? '' : 'joined-event-card--static',
  ].filter(Boolean).join(' ')

  return (
    <View
      className={cardClass}
      style={{ animationDelay: animDelay }}
      onClick={handleClick}
      hoverClass='joined-event-card--pressed'
      hoverStartTime={0}
      hoverStayTime={100}
      role='button'
      aria-label={cardAriaLabel}
    >
      {/* L2 Topline: status pill + countdown */}
      <View className='joined-event-card__topline'>
        <View className='joined-event-card__pulse-pill'>
          <View
            className={`joined-event-card__pulse-dot${isLive ? ' joined-event-card__pulse-dot--live' : ''}`}
            style={{ backgroundColor: familyColor }}
          />
          <Text
            className='joined-event-card__pulse-label'
            style={{ color: familyColor }}
          >
            {momentumLabel}
          </Text>
        </View>
        {countdownText && (
          <Text className='joined-event-card__countdown' style={{ color: familyColor }}>
            {countdownText}
          </Text>
        )}
      </View>

      {/* L1 Title */}
      <Text className='joined-event-card__title'>
        {event.title ?? '悦聚活动'}
      </Text>

      {/* L3 Decision facts: date + time */}
      <View className='joined-event-card__facts'>
        <View className='joined-event-card__when-row'>
          <Text className='joined-event-card__date'>{datePart}</Text>
          {weekdayPart && (
            <Text className='joined-event-card__weekday'>{weekdayPart}</Text>
          )}
        </View>
        {timePart && (
          <Text className='joined-event-card__time'>{timePart}</Text>
        )}
      </View>

      {/* L4 Location */}
      {event.location && (
        <View className='joined-event-card__location-row'>
          <Text className='joined-event-card__location'>{event.location}</Text>
        </View>
      )}

      {/* L5 Footer hint */}
      <View className='joined-event-card__footer'>
        <Text className='joined-event-card__footer-hint'>
          {isPast ? '点击查看详情与回顾' : '点击查看活动详情'}
        </Text>
      </View>
    </View>
  )
})
