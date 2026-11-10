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
  formatEventDateParts,
  formatEventDateTime,
  formatEventDateTimeParts,
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
  matched: '场地安排中',
  confirmed: '期待见面',
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
  /** Presentation-only context; never changes the canonical event status. */
  isHistorical?: boolean
  className?: string
  reduceMotion?: boolean
  isDegradation?: boolean
  /** When true, the card renders interactive affordances (hover, role). Default false. */
  interactive?: boolean
  onClick?: () => void
  hoverClass?: string
  /** Optional footer hint rendered below the meta line. */
  footerHint?: string
  /**
   * Match-time table theme. Rendered as a pill under the title so a formed
   * table keeps the identity it was created around (pool/Footprint cards).
   */
  themePill?: string
  /** Optional structured content for integrated card compositions. */
  titleAccessory?: React.ReactNode
  metaAccessory?: React.ReactNode
  footerContent?: React.ReactNode
  compactCountdown?: boolean
  /**
   * `stacked` (default) keeps every fact in the left column. `split` moves the
   * absolute date, time and countdown into a dedicated right "when" column so
   * the card stays balanced instead of piling all narrative copy on the left.
   */
  layout?: 'stacked' | 'split'
  role?: string
  ariaLabel?: string
  animationDelay?: string
  /**
   * Optional right rail for read-only summary surfaces. When provided, the card
   * renders a two-rail layout with `rightRail` pinned to the right.
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
  isHistorical = false,
  className,
  reduceMotion: reduceMotionProp,
  isDegradation: isDegradationProp,
  interactive = false,
  onClick,
  hoverClass,
  footerHint,
  titleAccessory,
  metaAccessory,
  footerContent,
  compactCountdown = false,
  layout = 'stacked',
  role,
  ariaLabel,
  animationDelay,
  rightRail,
  railMode = false,
  railAriaLabel,
  themePill,
}: EventSummaryCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradationProp || deviceIsDegradation
  const deviceReduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const reduceMotion = reduceMotionProp ?? deviceReduceMotion
  const generatedUidRef = useRef(`event-summary-card-${Math.random().toString(36).slice(2, 8)}`)
  const uid = id ?? generatedUidRef.current

  const status = displayStatus ?? rawStatus ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)
  const isHistoricalNonterminal = isHistorical && !isTerminal
  const isEnded = isTerminal || isHistoricalNonterminal
  const family = isHistoricalNonterminal ? 'warm' : STATUS_FAMILY_MAP[status] ?? 'calm'
  const familyColor = ARCHETYPE_FAMILY_COLORS[family] ?? FALLBACK_FAMILY_COLOR
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[family] ?? ARCHETYPE_FAMILY_GRADIENTS.calm

  const statusLabel = isHistoricalNonterminal ? '已结束' : getJoinedEventStatusLabel(status)
  const momentumLabel = isHistoricalNonterminal ? '已结束' : STATUS_MOMENTUM_COPY[status] ?? statusLabel
  const isLiveStatus = !isHistoricalNonterminal && (status === 'matched' || status === 'venue_unlocked')
  const showVenue = VENUE_VISIBLE_STATUSES.has(status)
  const isMatched = !isHistoricalNonterminal && status === 'matched'

  const dateTimeText = formatEventDateTime(dateTime)
  const dateTimeParts = useMemo(() => formatEventDateTimeParts(dateTime), [dateTime])
  const isSplit = layout === 'split'
  const sideDateParts = useMemo(
    () => (isSplit ? formatEventDateParts(dateTime) : null),
    [isSplit, dateTime],
  )
  // `主题 · 区域` is parsed for every layout. The split layout renders only the
  // theme and moves the area into the right-hand where/when column; the stacked
  // layout keeps the full title but still knows the suffix so the geography run
  // does not print the same area twice.
  const titleParts = useMemo(() => {
    const value = title ?? '悦聚活动'
    const match = value.match(/^(.*)\s*·\s*(.+)$/)
    return match
      ? { primary: match[1], district: match[2], full: value }
      : { primary: value, district: '', full: value }
  }, [title])

  const locationLine = useMemo(() => {
    const parts: string[] = []

    if (eventType) {
      parts.push(eventType)
    }

    const locationParts: string[] = []
    if (city) locationParts.push(city)
    // The area already appears — in the split side column, or inside the stacked
    // title suffix — so repeating it here reads as two different locations.
    if (district && !titleParts.district) locationParts.push(district)
    if (showVenue && venueName && !isSplit) locationParts.push(venueName)
    if (locationParts.length > 0) {
      parts.push(locationParts.join(' · '))
    } else if (location) {
      parts.push(location)
    }

    return parts.length > 0 ? parts.join('  ·  ') : null
  }, [eventType, city, district, venueName, location, showVenue, isSplit, titleParts.district])

  // Split layout gives the disclosed venue its own line instead of gluing it
  // onto the geography run, so "where" reads as type → city/district → place.
  const venueLine = isSplit && showVenue && venueName ? venueName : null

  const cornerAssetSrc = getOracleCardCornerAsset(eventType)
  const showCornerAsset = cornerAssetSrc && !effectiveDegradation

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

  // Upcoming already says 即将开始 in the status pill; repeating it as a
  // waiting sentence flattens the title/date hierarchy without adding truth.
  const waitingCopy = isHistoricalNonterminal || status === 'upcoming'
    ? undefined
    : STATUS_WAITING_COPY[status]

  const cardClass = [
    'footprint-oracle-card',
    `footprint-oracle-card--family-${family}`,
    isEnded ? 'footprint-oracle-card--terminal' : '',
    isMatched ? 'footprint-oracle-card--matched' : '',
    railMode ? 'footprint-oracle-card--rail' : '',
    isSplit ? 'footprint-oracle-card--split' : '',
    effectiveDegradation ? 'footprint-oracle-card--low-end' : '',
    reduceMotion ? 'footprint-oracle-card--reduced-motion' : '',
    !isPageVisible ? 'footprint-oracle-card--page-hidden' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const clockEnabled = !isEnded && Boolean(dateTime)

  // Within a day of start the chip gets the family tint so a T-44min card
  // cannot render identically to a T-4day card (designer P1, 2026-11-10).
  const hoursUntilStart = dateTime ? (new Date(dateTime).getTime() - Date.now()) / 3_600_000 : null
  const isStartingSoon = hoursUntilStart != null && hoursUntilStart > 0 && hoursUntilStart <= 24

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
          // The Footprint list is short and above-the-fold art is part of the
          // card identity; lazy loading left cached route transitions imageless.
          lazyLoad={false}
          onError={() => setCornerLoadFailed(true)}
        />
      )}

      <View className='footprint-oracle-card__content'>
        <View className='footprint-oracle-card__main'>
          <View className='footprint-oracle-card__body'>
            {/* Non-rail, non-split cards keep their countdown beside the status. */}
            <View className='footprint-oracle-card__topline'>
              <View className='footprint-oracle-card__pulse-pill'>
                <View
                  className={`footprint-oracle-card__pulse-dot${isLiveStatus ? ' footprint-oracle-card__pulse-dot--live' : ''}`}
                  style={{ backgroundColor: familyColor }}
                />
                <Text className='footprint-oracle-card__pulse-label'>{momentumLabel}</Text>
              </View>
              {!railMode && (
                isSplit ? (
                  // Gate on the clock's own enablement: an ended card renders no
                  // digits, and a bare chip would show as an empty pill beside
                  // the status (render-caught 2026-11-10).
                  clockEnabled ? (
                    <View
                      className={`footprint-oracle-card__countdown-chip${isStartingSoon ? ' footprint-oracle-card__countdown-chip--urgent' : ''}`}
                      style={isStartingSoon
                        ? { borderColor: `${familyColor}47` }
                        : undefined}
                    >
                      <SegmentedCountdownClock
                        variant='human'
                        target={dateTime ?? null}
                        enabled={clockEnabled}
                        accentColor={familyColor}
                        clockId={`${uid}-human-clock`}
                      />
                    </View>
                  ) : null
                ) : (
                  <SegmentedCountdownClock
                    target={dateTime ?? null}
                    enabled={clockEnabled}
                    accentColor={familyColor}
                    clockId={`${uid}-clock`}
                    compact={compactCountdown}
                  />
                )
              )}
            </View>

            {/* L1 Title: the only navigation cue lives beside the title. */}
            <View
              className={`footprint-oracle-card__title-row${themePill ? ' footprint-oracle-card__title-row--with-theme' : ''}`}
            >
              <View className='footprint-oracle-card__title'>
                {isSplit ? titleParts.primary : titleParts.full}
              </View>
              {titleAccessory}
            </View>

            {/* Table theme reads as annotated identity, not a third badge: it
                belongs to the title, so it hugs the title and opens space to
                the geography line below (designer C1/H1, 2026-11-10). */}
            {themePill && (
              <View className='footprint-oracle-card__theme-row'>
                <Text className='footprint-oracle-card__theme-label'>主题</Text>
                <Text className='footprint-oracle-card__theme-text'>{themePill}</Text>
              </View>
            )}

            {/* L3 Date / time / location line */}
            <View
              className={`footprint-oracle-card__meta${themePill ? ' footprint-oracle-card__meta--after-theme' : ''}`}
            >
              {!isSplit && (
                <Text className='footprint-oracle-card__date-time'>
                  <Text className='footprint-oracle-card__date-label'>{dateTimeParts.dateLabel}</Text>
                  {dateTimeParts.timeLabel && (
                    <Text className='footprint-oracle-card__date-clock'>{dateTimeParts.timeLabel}</Text>
                  )}
                </Text>
              )}
              {locationLine && (
                <Text className='footprint-oracle-card__location'>{locationLine}</Text>
              )}
              {venueLine && (
                <Text className='footprint-oracle-card__venue'>{venueLine}</Text>
              )}
              {waitingCopy && (
                <Text className='footprint-oracle-card__waiting-hint'>{waitingCopy}</Text>
              )}
              {!isSplit && metaAccessory}
            </View>

          </View>

          {isSplit && sideDateParts && (
            <View className='footprint-oracle-card__side'>
              {titleParts.district && (
                <Text className='footprint-oracle-card__side-district'>{titleParts.district}</Text>
              )}
              <View className='footprint-oracle-card__side-date'>
                {sideDateParts.yearLabel && (
                  <Text className='footprint-oracle-card__side-year'>{sideDateParts.yearLabel}</Text>
                )}
                <Text className='footprint-oracle-card__side-month-day'>{sideDateParts.monthDay}</Text>
              </View>
              <View className='footprint-oracle-card__side-time-row'>
                <Text className='footprint-oracle-card__side-weekday'>{sideDateParts.weekday}</Text>
                <Text className='footprint-oracle-card__side-time'>{sideDateParts.timeLabel}</Text>
              </View>
            </View>
          )}

          {railMode && rightRail && (
            <View className='footprint-oracle-card__rail'>
              {rightRail}
            </View>
          )}
        </View>

        {isSplit && metaAccessory && (
          <View className='footprint-oracle-card__facts-footer'>{metaAccessory}</View>
        )}

        {/* L4 Footer: structured actions or the legacy text hint. Sits below the
            facts footer so the next step reads after the table identity. */}
        {(footerContent != null || footerHint) && (
          <View className='footprint-oracle-card__footer'>
            {footerContent ?? <Text className='footprint-oracle-card__footer-hint'>{footerHint}</Text>}
          </View>
        )}
      </View>
    </View>
  )
}

type EventSummaryCardComponent = React.NamedExoticComponent<EventSummaryCardProps>

const MemoEventSummaryCard = React.memo(EventSummaryCard) as unknown as EventSummaryCardComponent

export default MemoEventSummaryCard
