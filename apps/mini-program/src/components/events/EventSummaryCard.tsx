import React, { useMemo, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
} from '@shared/archetypeColors'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { usePageVisibility } from '../../hooks/usePageVisibility'
import SegmentedCountdownClock from '../ui/SegmentedCountdownClock'
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
  matched: '排桌完成',
  venue_unlocked: '场地已解锁',
  confirmed: '已确认',
  upcoming: '即将开始',
  pending: '排桌中',
  registered: '报名成功',
  completed: '圆满结束',
  attended: '已参加',
  cancelled: '已取消',
  declined: '已取消',
  no_show: '未出席',
}

// Explicit "what you are waiting for" copy. Empty means no extra waiting hint.
const STATUS_WAITING_COPY: Record<string, string> = {
  pending: '系统正在安排本场同桌，请耐心等待',
  registered: '报名成功，等待排桌',
  upcoming: '报名成功，活动即将开始',
  matched: '排桌完成，场地安排中',
  confirmed: '已确认，期待见面',
  venue_unlocked: '场地已解锁，期待见面',
}

// Venue is only disclosed once the group has been assigned a venue.
const VENUE_VISIBLE_STATUSES = new Set(['confirmed', 'venue_unlocked'])

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
  /**
   * Right-side info rail. When provided, the card renders a two-rail layout
   * with `rightRail` pinned to the right. Used by FootprintOracleCard.
   */
  rightRail?: React.ReactNode
  /** When true, the card renders in a two-rail layout mode. */
  railMode?: boolean
  /** Accessible description for the right rail contents (e.g. countdown, group size, price). */
  railAriaLabel?: string
}

function EventSummaryCard({
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
  rightRail,
  railMode = false,
  railAriaLabel,
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
  const { isPageVisible } = usePageVisibility()

  const computedAriaLabel = useMemo(
    () =>
      [
        title ?? '悦聚活动',
        statusLabel,
        dateTimeText,
        locationLine ?? undefined,
        footerHint,
        railAriaLabel,
      ]
        .filter(Boolean)
        .join('，'),
    [title, statusLabel, dateTimeText, locationLine, footerHint, railAriaLabel],
  )

  const waitingCopy = STATUS_WAITING_COPY[status]

  const cardClass = [
    'footprint-oracle-card',
    `footprint-oracle-card--family-${family}`,
    isTerminal ? 'footprint-oracle-card--terminal' : '',
    isMatched ? 'footprint-oracle-card--matched' : '',
    railMode ? 'footprint-oracle-card--rail' : '',
    effectiveDegradation ? 'footprint-oracle-card--low-end' : '',
    reduceMotion ? 'footprint-oracle-card--reduced-motion' : '',
    !isPageVisible ? 'footprint-oracle-card--page-hidden' : '',
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
        <View className='footprint-oracle-card__main'>
          <View className='footprint-oracle-card__body'>
            {/* L2 Topline: status pill only when railMode (clock lives in right rail) */}
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
              {!railMode && (
                <SegmentedCountdownClock
                  target={dateTime ?? null}
                  enabled={clockEnabled}
                  accentColor={familyColor}
                  clockId={`${uid}-clock`}
                />
              )}
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

            {/* L4 Footer hint (kept for non-rail consumers) */}
            {footerHint && (
              <View className='footprint-oracle-card__footer'>
                <Text className='footprint-oracle-card__footer-hint'>{footerHint}</Text>
              </View>
            )}
          </View>

          {railMode && rightRail && (
            <View className='footprint-oracle-card__rail'>
              {rightRail}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

type EventSummaryCardComponent = React.NamedExoticComponent<EventSummaryCardProps>

const MemoEventSummaryCard = React.memo(EventSummaryCard) as unknown as EventSummaryCardComponent

export default MemoEventSummaryCard
