import React, { useMemo, useRef, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
} from '@shared/archetypeColors'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { computeCountdownResult } from '../../hooks/useEventCountdown'
import { useCountdownTickValue } from '../../hooks/useCountdownTick'
import { usePageVisibility } from '../../hooks/usePageVisibility'
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
// Self-contained countdown leaf. The list path derives its readout from the
// page-level shared ticker (CountdownTickProvider) so N cards share ONE
// interval instead of owning N timers. Outside a provider it renders a
// static readout computed at render time (no ticking) — same behavior as the
// reduced-motion/low-end static readout path.

interface EventCountdownClockProps {
  target: string | null
  enabled: boolean
  /** When omitted the clock falls back to the primary brand color via CSS. */
  accentColor?: string
  clockId: string
  /** Compact vertical layout for the right info rail. */
  compact?: boolean
}

const EventCountdownClock = React.memo(function EventCountdownClock({
  target,
  enabled,
  accentColor,
  clockId,
  compact = false,
}: EventCountdownClockProps) {
  const tickValue = useCountdownTickValue()
  const { isDegradation } = useDeviceTier()
  const { isPageVisible } = usePageVisibility()
  // Memoized: getSystemInfoSync is synchronous + deprecated; the clock
  // re-renders every second per card — an unmemoized read taxes the JS thread.
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  // Live gating: motion enabled, primary-tier device, page visible, valid target.
  const live = Boolean(target) && enabled && !isDegradation && !reduceMotion && isPageVisible

  // While not live (hidden, reduced-motion, low-end, no provider) the readout
  // FREEZES at the last live value — identical to the pre-P2 hook, where the
  // per-card interval simply stopped and left a static "paused" readout.
  const frozenNowRef = useRef<number>(Date.now())
  const tickNow = tickValue?.now
  if (live && tickNow != null) {
    frozenNowRef.current = tickNow
  }
  const now = live && tickNow != null ? tickNow : frozenNowRef.current

  const { display, segments, isUrgent, hasStarted, isLive } = useMemo(
    () => computeCountdownResult(target, enabled, now, 60, live),
    [target, enabled, now, live],
  )

  // Track previous segment values to pulse only the digit group that changed.
  const prevSegmentsRef = useRef(segments)
  const [pulseSegment, setPulseSegment] = React.useState<'days' | 'hours' | 'minutes' | 'seconds' | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!segments || !prevSegmentsRef.current) {
      prevSegmentsRef.current = segments
      return
    }

    const prev = prevSegmentsRef.current
    let changed: typeof pulseSegment = null
    if (segments.seconds !== prev.seconds) changed = 'seconds'
    else if (segments.minutes !== prev.minutes) changed = 'minutes'
    else if (segments.hours !== prev.hours) changed = 'hours'
    else if (segments.days !== prev.days) changed = 'days'

    if (changed) {
      setPulseSegment(changed)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => setPulseSegment(null), 160)
    }
    prevSegmentsRef.current = segments

    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [segments])

  if (!display) {
    return null
  }

  const clockStyle = accentColor
    ? ({ '--clock-accent': accentColor } as React.CSSProperties)
    : undefined

  if (hasStarted) {
    return (
      <View
        id={clockId}
        className='footprint-oracle-card__clock footprint-oracle-card__clock--started'
        style={clockStyle}
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
      className={[
        'footprint-oracle-card__clock',
        compact ? 'footprint-oracle-card__clock--compact' : '',
      ].filter(Boolean).join(' ')}
      style={clockStyle}
      aria-label={`倒计时 ${display}`}
      aria-live={isLive ? 'polite' : undefined}
      aria-atomic='true'
    >
      <View className='footprint-oracle-card__clock-digits'>
        {days > 0 && (
          <>
            <View className='footprint-oracle-card__clock-cell'>
              <Text className={['footprint-oracle-card__clock-value', pulseSegment === 'days' ? 'footprint-oracle-card__clock-value--pulse' : ''].filter(Boolean).join(' ')}>{formatClockPair(days)}</Text>
              <Text className='footprint-oracle-card__clock-unit'>天</Text>
            </View>
            <Text className='footprint-oracle-card__clock-separator'>:</Text>
          </>
        )}
        <View className='footprint-oracle-card__clock-cell'>
          <Text className={['footprint-oracle-card__clock-value', pulseSegment === 'hours' ? 'footprint-oracle-card__clock-value--pulse' : ''].filter(Boolean).join(' ')}>{formatClockPair(hours)}</Text>
          <Text className='footprint-oracle-card__clock-unit'>时</Text>
        </View>
        <Text className='footprint-oracle-card__clock-separator'>:</Text>
        <View className='footprint-oracle-card__clock-cell'>
          <Text className={['footprint-oracle-card__clock-value', pulseSegment === 'minutes' ? 'footprint-oracle-card__clock-value--pulse' : ''].filter(Boolean).join(' ')}>{formatClockPair(minutes)}</Text>
          <Text className='footprint-oracle-card__clock-unit'>分</Text>
        </View>
        <Text className='footprint-oracle-card__clock-separator'>:</Text>
        <View className='footprint-oracle-card__clock-cell'>
          <Text className={['footprint-oracle-card__clock-value', pulseSegment === 'seconds' ? 'footprint-oracle-card__clock-value--pulse' : ''].filter(Boolean).join(' ')}>{formatClockPair(seconds)}</Text>
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
                <EventCountdownClock
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

// Expose the countdown clock as a static sub-component so the right-rail
// layout in FootprintOracleCard can reuse it without duplicating logic.
type EventSummaryCardComponent = React.NamedExoticComponent<EventSummaryCardProps> & {
  CountdownClock: typeof EventCountdownClock
}
const MemoEventSummaryCard = React.memo(EventSummaryCard) as unknown as EventSummaryCardComponent
MemoEventSummaryCard.CountdownClock = EventCountdownClock

export default MemoEventSummaryCard
