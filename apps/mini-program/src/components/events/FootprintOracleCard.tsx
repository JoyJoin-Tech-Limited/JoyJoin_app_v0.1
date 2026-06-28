import React, { useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
} from '@shared/archetypeColors'
import type { JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { useEventCountdown } from '../../hooks/useEventCountdown'
import { getOracleCardCornerAsset } from '../discover/oracleCardAssets'
import {
  formatEventDateTime,
  getJoinedEventDisplayDateTime,
  getJoinedEventStatusLabel,
} from '../../lib/utils/eventDisplay'
import './FootprintOracleCard.scss'

// ─── Constants ─────────────────────────────────────────────────

const FALLBACK_FAMILY_COLOR = ARCHETYPE_FAMILY_COLORS.calm

// Status → accent family mapping for Oracle Card shell consistency.
const STATUS_FAMILY_MAP: Record<string, 'fire' | 'calm' | 'warm' | 'cool'> = {
  pending: 'calm',
  registered: 'calm',
  upcoming: 'calm',
  matched: 'fire',
  confirmed: 'fire',
  venue_unlocked: 'fire',
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

// Statuses that should never show a countdown.
const TERMINAL_STATUSES = new Set(['completed', 'attended', 'cancelled'])

// ─── Helpers ───────────────────────────────────────────────────

function isTerminalStatus(status?: string | null): boolean {
  return !status || TERMINAL_STATUSES.has(status)
}

function getCountdownTarget(event: JoinedEventSummary): string | null {
  // The countdown target must always match the displayed datetime.
  const display = getJoinedEventDisplayDateTime(event)
  return display ?? null
}

function buildLocationLine(event: JoinedEventSummary): string | null {
  const parts: string[] = []

  if (event.eventType) {
    parts.push(event.eventType)
  }

  const locationParts: string[] = []
  if (event.city) locationParts.push(event.city)
  if (event.district) locationParts.push(event.district)
  if (event.venueName) locationParts.push(event.venueName)
  if (locationParts.length > 0) {
    parts.push(locationParts.join(' · '))
  } else if (event.location) {
    parts.push(event.location)
  }

  return parts.length > 0 ? parts.join('  ·  ') : null
}

export interface FootprintOracleCardProps {
  event: JoinedEventSummary
  index?: number
  onClick?: (event: JoinedEventSummary) => void
  isDegradation?: boolean
}

export default React.memo(function FootprintOracleCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
}: FootprintOracleCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradation || deviceIsDegradation
  const uid = useMemo(() => `footprint-card-${event.id}`, [event.id])

  const status = event.status ?? 'upcoming'
  const family = STATUS_FAMILY_MAP[status] ?? 'calm'
  const familyColor = ARCHETYPE_FAMILY_COLORS[family] ?? FALLBACK_FAMILY_COLOR
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[family] ?? ARCHETYPE_FAMILY_GRADIENTS.calm

  const statusLabel = getJoinedEventStatusLabel(status)
  const momentumLabel = STATUS_MOMENTUM_COPY[status] ?? statusLabel
  const isTerminal = isTerminalStatus(status)
  const isLive = status === 'matched' || status === 'venue_unlocked'

  const countdownTarget = getCountdownTarget(event)
  const { display: countdownDisplay, isUrgent } = useEventCountdown({
    target: countdownTarget,
    enabled: !isTerminal && Boolean(countdownTarget),
    urgentThresholdMinutes: 60,
    elementId: uid,
  })

  const shouldAnimate = !effectiveDegradation && index < 6
  const animDelay = shouldAnimate ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  const handleClick = React.useCallback(() => {
    haptics('light')
    onClick?.(event)
  }, [event, onClick])

  const displayDateTime = getJoinedEventDisplayDateTime(event)
  const dateTimeText = formatEventDateTime(displayDateTime)
  const locationLine = buildLocationLine(event)
  const cornerAssetSrc = getOracleCardCornerAsset(event.eventType)
  const showCornerAsset = cornerAssetSrc && !effectiveDegradation && !isTerminal

  const [cornerLoadFailed, setCornerLoadFailed] = React.useState(false)

  const cardAriaLabel = [
    event.title ?? '悦聚活动',
    statusLabel,
    countdownDisplay ? `倒计时 ${countdownDisplay}` : undefined,
    dateTimeText,
    locationLine ?? undefined,
    isTerminal ? '点击查看详情与回顾' : '点击查看活动详情',
  ]
    .filter(Boolean)
    .join('，')

  const footerHint = isTerminal ? '点击查看详情与回顾' : '点击查看活动详情'

  const cardClass = [
    'footprint-oracle-card',
    `footprint-oracle-card--family-${family}`,
    isTerminal ? 'footprint-oracle-card--terminal' : '',
    effectiveDegradation ? 'footprint-oracle-card--low-end' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      id={uid}
      className={cardClass}
      style={{
        animationDelay: effectiveDegradation ? undefined : animDelay,
        background: gradient,
      }}
      onClick={handleClick}
      hoverClass='footprint-oracle-card--pressed'
      hoverStartTime={0}
      hoverStayTime={100}
      role='button'
      aria-label={cardAriaLabel}
    >
      {showCornerAsset && !cornerLoadFailed && (
        <Image
          className='footprint-oracle-card__type-corner'
          src={cornerAssetSrc}
          mode='aspectFill'
          aria-hidden='true'
          lazyLoad
          onError={() => setCornerLoadFailed(true)}
        />
      )}

      <View className='footprint-oracle-card__content'>
        {/* L2 Topline: status pill + LED countdown */}
        <View className='footprint-oracle-card__topline'>
          <View className='footprint-oracle-card__pulse-pill'>
            <View
              className={`footprint-oracle-card__pulse-dot${isLive ? ' footprint-oracle-card__pulse-dot--live' : ''}`}
              style={{ backgroundColor: familyColor }}
            />
            <Text
              className='footprint-oracle-card__pulse-label'
              style={{ color: familyColor }}
            >
              {momentumLabel}
            </Text>
          </View>
          {countdownDisplay && (
            <Text
              className={[
                'footprint-oracle-card__countdown',
                isUrgent ? 'footprint-oracle-card__countdown--urgent' : '',
              ].filter(Boolean).join(' ')}
            >
              {countdownDisplay}
            </Text>
          )}
        </View>

        {/* L1 Title */}
        <View className='footprint-oracle-card__title'>
          {event.title ?? '悦聚活动'}
        </View>

        {/* L3 Date / time / location line */}
        <View className='footprint-oracle-card__meta'>
          <Text className='footprint-oracle-card__date-time'>{dateTimeText}</Text>
          {locationLine && (
            <Text className='footprint-oracle-card__location'>{locationLine}</Text>
          )}
        </View>

        {/* L4 Footer hint */}
        <View className='footprint-oracle-card__footer'>
          <Text className='footprint-oracle-card__footer-hint'>{footerHint}</Text>
        </View>
      </View>
    </View>
  )
})
