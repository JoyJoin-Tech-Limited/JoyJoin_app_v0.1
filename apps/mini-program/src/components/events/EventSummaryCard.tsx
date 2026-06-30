import React, { useMemo, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
} from '@shared/archetypeColors'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { useEventCountdown } from '../../hooks/useEventCountdown'
import { getOracleCardCornerAsset } from '../discover/oracleCardAssets'
import {
  formatEventDateTime,
  getJoinedEventStatusLabel,
  isJoinedEventTerminal,
} from '../../lib/utils/eventDisplay'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import './FootprintOracleCard.scss'

// ─── Constants ─────────────────────────────────────────────────

const FALLBACK_FAMILY_COLOR = ARCHETYPE_FAMILY_COLORS.calm
const CLOCK_TOTAL_BLOCKS = 12

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
  declined: 'cool',
  no_show: 'cool',
}

// Human, playful momentum copy for each status.
const STATUS_MOMENTUM_COPY: Record<string, string> = {
  matched: '匹配成功',
  venue_unlocked: '场地已解锁',
  confirmed: '已确认',
  upcoming: '即将开始',
  pending: '匹配中',
  registered: '报名成功',
  completed: '圆满结束',
  attended: '已参加',
  cancelled: '已取消',
  declined: '已取消',
  no_show: '未出席',
}

// Explicit "what you are waiting for" copy. Empty means no extra waiting hint.
const STATUS_WAITING_COPY: Record<string, string> = {
  pending: '系统正在撮合本场成员，请耐心等待',
  registered: '报名成功，等待系统匹配',
  upcoming: '报名成功，活动即将开始',
  matched: '匹配成功，场地安排中',
  confirmed: '已确认，期待见面',
  venue_unlocked: '场地已解锁，期待见面',
}

// Venue is only disclosed once the group has been assigned a venue.
const VENUE_VISIBLE_STATUSES = new Set(['confirmed', 'venue_unlocked'])

// ─── Helpers ───────────────────────────────────────────────────

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatClockPair(value: number): string {
  return pad2(Math.max(0, value))
}

// ─── Segmented Clock Component ─────────────────────────────────
// Self-contained: owns its countdown hook so the parent card does not
// re-render every second.

interface EventCountdownClockProps {
  target: string | null
  enabled: boolean
  accentColor: string
  clockId: string
}

const EventCountdownClock = React.memo(function EventCountdownClock({
  target,
  enabled,
  accentColor,
  clockId,
}: EventCountdownClockProps) {
  const { display, segments, isUrgent, hasStarted, isLive } = useEventCountdown({
    target,
    enabled,
    urgentThresholdMinutes: 60,
    elementId: clockId,
  })

  if (!display) {
    return null
  }

  if (hasStarted) {
    return (
      <View
        id={clockId}
        className='footprint-oracle-card__clock footprint-oracle-card__clock--started'
        style={{ '--clock-accent': accentColor } as React.CSSProperties}
        aria-label={display}
      >
        <View className='footprint-oracle-card__clock-started-dot' />
        <Text className='footprint-oracle-card__clock-started-label'>{display}</Text>
      </View>
    )
  }

  if (!segments) {
    return null
  }

  const { days, hours, minutes, seconds, progress } = segments
  const filledBlocks = Math.max(
    0,
    Math.min(CLOCK_TOTAL_BLOCKS, Math.round(progress * CLOCK_TOTAL_BLOCKS)),
  )

  return (
    <View
      id={clockId}
      className='footprint-oracle-card__clock'
      style={{ '--clock-accent': accentColor } as React.CSSProperties}
      aria-label={`倒计时 ${display}`}
      aria-live={isLive ? 'polite' : undefined}
      aria-atomic='true'
    >
      <View className='footprint-oracle-card__clock-digits'>
        {days > 0 && (
          <>
            <View className='footprint-oracle-card__clock-cell'>
              <Text className='footprint-oracle-card__clock-value'>{formatClockPair(days)}</Text>
              <Text className='footprint-oracle-card__clock-unit'>天</Text>
            </View>
            <Text className='footprint-oracle-card__clock-separator'>:</Text>
          </>
        )}
        <View className='footprint-oracle-card__clock-cell'>
          <Text className='footprint-oracle-card__clock-value'>{formatClockPair(hours)}</Text>
          <Text className='footprint-oracle-card__clock-unit'>时</Text>
        </View>
        <Text className='footprint-oracle-card__clock-separator'>:</Text>
        <View className='footprint-oracle-card__clock-cell'>
          <Text className='footprint-oracle-card__clock-value'>{formatClockPair(minutes)}</Text>
          <Text className='footprint-oracle-card__clock-unit'>分</Text>
        </View>
        <Text className='footprint-oracle-card__clock-separator'>:</Text>
        <View className='footprint-oracle-card__clock-cell'>
          <Text className='footprint-oracle-card__clock-value'>{formatClockPair(seconds)}</Text>
          <Text className='footprint-oracle-card__clock-unit'>秒</Text>
        </View>
      </View>

      <View className='footprint-oracle-card__clock-progress' aria-hidden='true'>
        {Array.from({ length: CLOCK_TOTAL_BLOCKS }, (_, i) => {
          const filled = i < filledBlocks
          return (
            <View
              key={i}
              className={[
                'footprint-oracle-card__clock-progress-block',
                filled ? 'footprint-oracle-card__clock-progress-block--filled' : '',
                filled && isUrgent && isLive
                  ? 'footprint-oracle-card__clock-progress-block--urgent'
                  : '',
              ].filter(Boolean).join(' ')}
            />
          )
        })}
      </View>
    </View>
  )
})

// ─── Presentational Event Summary Card ─────────────────────────
// Shared visual base for FootprintOracleCard and any read-only
// confirmation surfaces (e.g. pool-registration terminal states).

export interface EventSummaryCardProps {
  id?: string
  title?: string
  eventType?: string
  dateTime?: string | null
  city?: string
  district?: string
  venueName?: string
  location?: string
  status?: string
  displayStatus?: string
  className?: string
  reduceMotion?: boolean
  isDegradation?: boolean
  /** When true, the card renders interactive affordances (hover, role). Default false. */
  interactive?: boolean
  onClick?: () => void
  hoverClass?: string
  /** Optional footer hint rendered below the meta line. */
  footerHint?: string
  role?: string
  ariaLabel?: string
  animationDelay?: string
}

export default React.memo(function EventSummaryCard({
  id,
  title,
  eventType,
  dateTime,
  city,
  district,
  venueName,
  location,
  status: rawStatus,
  displayStatus,
  className,
  reduceMotion: reduceMotionProp,
  isDegradation: isDegradationProp,
  interactive = false,
  onClick,
  hoverClass,
  footerHint,
  role,
  ariaLabel,
  animationDelay,
}: EventSummaryCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradationProp || deviceIsDegradation
  const deviceReduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const reduceMotion = reduceMotionProp ?? deviceReduceMotion
  const generatedUidRef = useRef(`event-summary-card-${Math.random().toString(36).slice(2, 8)}`)
  const uid = id ?? generatedUidRef.current

  const status = displayStatus ?? rawStatus ?? 'upcoming'
  const family = STATUS_FAMILY_MAP[status] ?? 'calm'
  const familyColor = ARCHETYPE_FAMILY_COLORS[family] ?? FALLBACK_FAMILY_COLOR
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[family] ?? ARCHETYPE_FAMILY_GRADIENTS.calm

  const statusLabel = getJoinedEventStatusLabel(status)
  const momentumLabel = STATUS_MOMENTUM_COPY[status] ?? statusLabel
  const isTerminal = isJoinedEventTerminal(status)
  const isLiveStatus = status === 'matched' || status === 'venue_unlocked'
  const showVenue = VENUE_VISIBLE_STATUSES.has(status)
  const isMatched = status === 'matched'

  const dateTimeText = formatEventDateTime(dateTime)

  const locationLine = useMemo(() => {
    const parts: string[] = []

    if (eventType) {
      parts.push(eventType)
    }

    const locationParts: string[] = []
    if (city) locationParts.push(city)
    if (district) locationParts.push(district)
    if (showVenue && venueName) locationParts.push(venueName)
    if (locationParts.length > 0) {
      parts.push(locationParts.join(' · '))
    } else if (location) {
      parts.push(location)
    }

    return parts.length > 0 ? parts.join('  ·  ') : null
  }, [eventType, city, district, venueName, location, showVenue])

  const cornerAssetSrc = getOracleCardCornerAsset(eventType)
  const showCornerAsset = cornerAssetSrc && !effectiveDegradation && !isTerminal

  const [cornerLoadFailed, setCornerLoadFailed] = React.useState(false)

  const computedAriaLabel = useMemo(
    () =>
      [
        title ?? '悦聚活动',
        statusLabel,
        dateTimeText,
        locationLine ?? undefined,
        footerHint,
      ]
        .filter(Boolean)
        .join('，'),
    [title, statusLabel, dateTimeText, locationLine, footerHint],
  )

  const waitingCopy = STATUS_WAITING_COPY[status]

  const cardClass = [
    'footprint-oracle-card',
    `footprint-oracle-card--family-${family}`,
    isTerminal ? 'footprint-oracle-card--terminal' : '',
    isMatched ? 'footprint-oracle-card--matched' : '',
    effectiveDegradation ? 'footprint-oracle-card--low-end' : '',
    reduceMotion ? 'footprint-oracle-card--reduced-motion' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const clockEnabled = !isTerminal && Boolean(dateTime)

  return (
    <View
      id={uid}
      className={cardClass}
      style={{
        animationDelay: effectiveDegradation ? undefined : animationDelay,
        background: gradient,
      }}
      onClick={onClick}
      hoverClass={interactive && hoverClass ? hoverClass : undefined}
      hoverStartTime={interactive ? 0 : undefined}
      hoverStayTime={interactive ? 100 : undefined}
      role={role}
      aria-label={ariaLabel ?? computedAriaLabel}
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
              className={`footprint-oracle-card__pulse-dot${isLiveStatus ? ' footprint-oracle-card__pulse-dot--live' : ''}`}
              style={{ backgroundColor: familyColor }}
            />
            <Text
              className='footprint-oracle-card__pulse-label'
              style={{ color: familyColor }}
            >
              {momentumLabel}
            </Text>
          </View>
          <EventCountdownClock
            target={dateTime ?? null}
            enabled={clockEnabled}
            accentColor={familyColor}
            clockId={`${uid}-clock`}
          />
        </View>

        {/* L1 Title */}
        <View className='footprint-oracle-card__title'>
          {title ?? '悦聚活动'}
        </View>

        {/* L3 Date / time / location line */}
        <View className='footprint-oracle-card__meta'>
          <Text className='footprint-oracle-card__date-time'>{dateTimeText}</Text>
          {locationLine && (
            <Text className='footprint-oracle-card__location'>{locationLine}</Text>
          )}
          {waitingCopy && (
            <Text className='footprint-oracle-card__waiting-hint'>{waitingCopy}</Text>
          )}
        </View>

        {/* L4 Footer hint */}
        {footerHint && (
          <View className='footprint-oracle-card__footer'>
            <Text className='footprint-oracle-card__footer-hint'>{footerHint}</Text>
          </View>
        )}
      </View>
    </View>
  )
})
