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

// Family colours are 6-digit hex, so the 8-digit `${familyColor}14` shorthand
// works — but its failure mode is a SILENT transparent: one bad digit drops the
// whole declaration and the plate just looks quietly styled. Expanding to
// rgba() turns a malformed value into an obvious fallback instead (designer A1).
const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '')
  if (value.length !== 6) return `rgba(139, 92, 246, ${alpha})`
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return `rgba(139, 92, 246, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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

// Explicit "what you are waiting for" copy for states with no formed table yet.
// `matched` / `confirmed` / `venue_unlocked` are intentionally absent: they have
// a group, so the place field below owns that whole question — both faces of it.
const STATUS_WAITING_COPY: Record<string, string> = {
  pending: '系统正在安排本场同桌，请耐心等待',
  registered: '报名成功，等待排桌',
  upcoming: '报名成功，活动即将开始',
}

// Venue is only disclosed once the group has been assigned a venue.
// A seated table's venue is public the moment it is confirmed, and stays public
// once the event is over. 'attended' is the status `derivePoolDisplayStatus`
// returns for a completed pool, so omitting it hid the venue from every finished
// pool card that was not rendered through the 已结束 tab (2026-11-17).
const VENUE_VISIBLE_STATUSES = new Set(['confirmed', 'venue_unlocked', 'completed', 'attended'])

// The geography run above the place field already prints 「深圳 · 南山区」. When the
// stored address opens with those same tokens («深圳市南山区科苑路…») the card
// states the location twice and pushes the street — the only part a driver needs
// — to the end of the line. Only administrative prefixes are removed, and only
// when the following characters prove it is a prefix: 「深圳湾科技生态园…」 must
// survive intact even though it starts with the city name (2026-11-17).
const stripShownPlacePrefixes = (
  address: string | undefined,
  city: string | undefined,
  districtName: string | undefined,
): string | undefined => {
  const raw = address?.trim()
  if (!raw) return undefined
  const cityName = city?.trim()
  const district = districtName?.trim()
  let rest = raw
  const trimSeparators = () => {
    rest = rest.replace(/^[\s·・,，、:：\-/]+/, '')
  }

  const province = rest.match(/^[\u4e00-\u9fa5]{2,4}省/)
  if (province) {
    rest = rest.slice(province[0].length)
    trimSeparators()
  }

  if (cityName) {
    const cityWithSuffix = cityName.endsWith('市') ? cityName : `${cityName}市`
    if (rest.startsWith(cityWithSuffix)) {
      rest = rest.slice(cityWithSuffix.length)
      trimSeparators()
    } else if (district && rest.startsWith(`${cityName}${district}`)) {
      // Some venue rows store city + district without the 市 suffix at all.
      rest = rest.slice(cityName.length)
      trimSeparators()
    }
  }

  if (district && rest.startsWith(district) && rest.length > district.length) {
    // 「福田」 in the geography run vs 「福田区」 in the address: the administrative
    // suffix belongs to the district, not to the street, so it goes with it.
    const districtHasSuffix = /[区县市]$/.test(district)
    const afterDistrict = rest[district.length]
    if (districtHasSuffix || /[区县市]/.test(afterDistrict)) {
      const cut = districtHasSuffix ? district.length : district.length + 1
      if (rest.length > cut) {
        rest = rest.slice(cut)
        trimSeparators()
      }
    }
  }

  // A strip that ate the street is worse than the duplication it removed.
  return rest.length >= 3 ? rest : raw
}

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
  /**
   * Structured venue address from the venue assignment. Rendered under the
   * venue name inside the place field — the card used to receive this fact and
   * throw it away, which left a confirmed table with no way to actually go.
   */
  venueAddress?: string
  /**
   * Label for the place field's trailing affordance. The caller chooses it from
   * what the mechanism can actually do (`导航` only when coordinates exist,
   * otherwise `复制地址`) — a chevron must never promise a map it cannot open.
   */
  venueActionLabel?: string
  venueActionAriaLabel?: string
  /**
   * Whether the affordance leaves the screen (opens the map) or stays on it
   * (copies the address). The chevron is a promise about the destination:
   * rendering it beside 复制地址 read as 「there is more behind this」, which is
   * the one thing a clipboard cannot deliver (rendered review, 2026-11-17).
   */
  venueActionNavigates?: boolean
  onVenueAction?: () => void
  /**
   * Forces the pending face of the place field. Defaults to `status ===
   * 'matched'`, i.e. a formed table whose venue is still being arranged.
   */
  placePending?: boolean
  /**
   * One-shot beat when the venue lands while the card stays mounted (poll
   * refresh flips pending → resolved). The owner of the data knows the
   * transition; this card only renders it, so it never fires on first paint.
   */
  placeRevealed?: boolean
  /** Theme rationale: the tagline generated with the theme. */
  themeSubtitle?: string
  /** Theme rationale fallback: 3-4 group traits the theme was built around. */
  themeHighlights?: string[]
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
  /**
   * Action phrase appended to the computed label instead of replacing it.
   * Use this when a surface adds a step (e.g. 开箱看桌友) and the reader still
   * needs the date, venue and price — an `ariaLabel` override would drop them.
   */
  ariaAction?: string
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
  /**
   * Hides the countdown chip. A formed-but-unopened table shows the arrival
   * pill instead — 「排桌完成」 beside 「还有 4 天」 reads as a contradiction.
   */
  suppressCountdown?: boolean
  /** Keeps the status dot steady. Pulse means "something new here". */
  suppressLivePulse?: boolean
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
  venueAddress,
  venueActionLabel,
  venueActionAriaLabel,
  venueActionNavigates = false,
  onVenueAction,
  placePending: placePendingProp,
  placeRevealed = false,
  themeSubtitle,
  themeHighlights,
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
  ariaAction,
  animationDelay,
  rightRail,
  railMode = false,
  railAriaLabel,
  themePill,
  suppressCountdown = false,
  suppressLivePulse = false,
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
  const isLiveStatus = !isHistoricalNonterminal
    && !suppressLivePulse
    && (status === 'matched' || status === 'venue_unlocked')
  const showVenue = VENUE_VISIBLE_STATUSES.has(status)
  const isMatched = !isHistoricalNonterminal && status === 'matched'
  // A finished record has nothing left to withhold: the table already met, and
  // the disclosure rule exists to protect a seat that is still being filled —
  // not to hide the place a past table sat at. Scope is exactly that: a venue
  // that is already public (`showVenue`) plus the past-but-never-swept record
  // (`isHistoricalNonterminal`). A cancelled / declined / no-show card stays
  // venue-free, because that seat never became a table (device report
  // 2026-11-17: an 已结束 card showed 深圳 · 南山区 with no venue name or address).
  const showResolvedPlace = showVenue || isHistoricalNonterminal

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
    // The venue name moved into the place field (2026-11-11). Gluing it onto the
    // geography run here would print "where" twice, and the field is the copy
    // that can carry the address and an action.
    if (locationParts.length > 0) {
      parts.push(locationParts.join(' · '))
    } else if (location) {
      parts.push(location)
    }

    return parts.length > 0 ? parts.join('  ·  ') : null
  }, [eventType, city, district, location, titleParts.district])

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
        showResolvedPlace && venueName ? venueName : undefined,
        showResolvedPlace && venueAddress ? venueAddress : undefined,
        footerHint,
        railAriaLabel,
        ariaAction,
      ]
        .filter(Boolean)
        .join('，'),
    [title, statusLabel, dateTimeText, locationLine, venueName, venueAddress, showResolvedPlace, footerHint, railAriaLabel, ariaAction],
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

  // ── Place field (2026-11-11) ─────────────────────────────────
  // "Where" used to be three unrelated text runs: the geography line, the venue
  // name, and a grey 24rpx 场地安排中 that was typographically identical to the
  // line above it — so "not decided yet" read exactly like "decided". It is one
  // question, so it gets one field with two faces.
  const isPlacePending = placePendingProp ?? (!isHistoricalNonterminal && isMatched)
  const resolvedVenueName = showResolvedPlace ? venueName : undefined
  const resolvedVenueAddress = showResolvedPlace
    ? stripShownPlacePrefixes(venueAddress, city, district)
    : undefined
  const showPlaceField = Boolean(resolvedVenueName) || isPlacePending
  // Inside the 24h promise window the earlier sentence is already spent: the
  // venue either lands or the pool is cancelled with a full refund, so
  // re-stating "we will tell you the day before" would be yesterday's promise.
  // `> 0` matters: a matched card that has already started (the 3h post-start
  // window before completion) used to satisfy `<= 24` and promise a venue
  // "later" for a time that has passed.
  const isInsideVenuePromiseWindow = hoursUntilStart != null && hoursUntilStart > 0 && hoursUntilStart <= 24
  const hasPromiseWindowPassed = hoursUntilStart != null && hoursUntilStart <= 0
  const pendingPlaceLabel = isInsideVenuePromiseWindow ? '场地最后确认中' : '场地安排中'
  const pendingPlaceHint =
    isInsideVenuePromiseWindow || hasPromiseWindowPassed ? undefined : '最晚活动前一天告诉你具体地点'
  // An ended card keeps the venue + address *and* now keeps the affordance: the
  // address is the last useful thing a finished record can still do for you
  // (find the place again, forward it to whoever you met). The caller downgrades
  // it to 复制地址 on ended records — a chevron must never promise navigation to
  // an event that already happened (2026-11-17).
  const showPlaceAction = Boolean(resolvedVenueName) && Boolean(venueActionLabel) && Boolean(onVenueAction)

  // The theme is a conclusion; one clause of evidence sits under it so a formed
  // table can re-recognise itself. The table's own traits are the honest answer
  // to "why this theme" — a mechanism sentence ("generated from your data") is a
  // 🔴 hard-rule violation, and a score would collide with 合拍度.
  const themeRationale = useMemo(() => {
    const subtitle = themeSubtitle?.trim()
    if (subtitle) return subtitle
    const highlights = (themeHighlights ?? [])
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3)
    return highlights.length > 0 ? highlights.join(' · ') : undefined
  }, [themeSubtitle, themeHighlights])

  const handlePlaceAction = React.useCallback(
    (e: { stopPropagation: () => void }) => {
      // The card is the only destination. The place affordance must not ALSO
      // navigate to event detail — the feedback pill documents the same trap.
      e.stopPropagation()
      onVenueAction?.()
    },
    [onVenueAction],
  )

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
              {!railMode && !suppressCountdown && (
                isSplit ? (
                  // Gate on the clock's own enablement: an ended card renders no
                  // digits, and a bare chip would show as an empty pill beside
                  // the status (render-caught 2026-11-10).
                  clockEnabled ? (
                    <View
                      className={`footprint-oracle-card__countdown-chip${isStartingSoon ? ' footprint-oracle-card__countdown-chip--urgent' : ''}`}
                      style={isStartingSoon
                        ? { borderColor: withAlpha(familyColor, 0.28) }
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

            {/* Why this theme. A hanging clause under the value, not a third
                badge: the rationale answers a question about the TABLE, so it
                hangs off the theme it explains and never becomes its own row of
                chrome (designer + PM, 2026-11-11). Absent data → no row at all;
                a placeholder sentence would be worse than silence. */}
            {themePill && themeRationale && (
              <View className='footprint-oracle-card__theme-why'>
                <View className='footprint-oracle-card__theme-why-tick' aria-hidden='true' />
                <Text className='footprint-oracle-card__theme-why-text'>{themeRationale}</Text>
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
              {waitingCopy && (
                <Text className='footprint-oracle-card__waiting-hint'>{waitingCopy}</Text>
              )}
              {!isSplit && metaAccessory}
            </View>

            {/* The place field: one question ("where do I go?") with two faces.
                Pending answers "when will I know"; resolved carries the address
                and the action. Same footprint either way, so the card never
                re-composes when the venue lands (designer + PM, 2026-11-11). */}
            {showPlaceField && (
              <View
                className={[
                  'footprint-oracle-card__place',
                  isPlacePending ? 'footprint-oracle-card__place--pending' : '',
                  // Tells the stylesheet the field carries a verb, so a card whose
                  // field is otherwise demoted can keep the thin plate the verb
                  // needs to read as an affordance instead of stray link text.
                  showPlaceAction ? 'footprint-oracle-card__place--actionable' : '',
                  placeRevealed && !reduceMotion ? 'footprint-oracle-card__place--revealed' : '',
                ].filter(Boolean).join(' ')}
                // The family tint arrives inline: each status keeps its own hue,
                // and the class above only owns geometry + the neutral fallback.
                // Fill carries the state (0.12), not the hairline: at 0.08 the
                // wash sat ~7/255 from the surface and a 1rpx 32%-alpha border
                // was doing 100% of the signalling — on the exact primitive that
                // dithers at some Android DPRs (designer A1).
                style={isPlacePending ? {
                  backgroundColor: withAlpha(familyColor, 0.12),
                  borderColor: withAlpha(familyColor, 0.32),
                } : undefined}
                // The whole field is the target, never the 24rpx verb alone:
                // at the verb's own metrics the tap box was ~15pt, and a sub-44pt
                // target inside a card that is itself tappable is a miss waiting
                // to become an accidental navigation to the detail page.
                onClick={showPlaceAction ? handlePlaceAction : undefined}
                hoverClass={showPlaceAction ? 'footprint-oracle-card__place--pressed' : undefined}
                hoverStayTime={showPlaceAction ? 80 : undefined}
                role={showPlaceAction ? 'button' : undefined}
                aria-label={showPlaceAction ? (venueActionAriaLabel ?? venueActionLabel) : undefined}
              >
                <View
                  className='footprint-oracle-card__place-bar'
                  style={isPlacePending ? { backgroundColor: familyColor } : undefined}
                  aria-hidden='true'
                />
                <View className='footprint-oracle-card__place-body'>
                  {/* The verb rides the venue name, not the block. As a flex
                      sibling of the body it centred itself against a two-line
                      address and carved ~120rpx out of BOTH lines, so the street
                      read 「东门老街解放路 / 1 号 2 楼」 beside a verb floating
                      in the gutter (rendered review, 2026-11-17). Same line as
                      the name it belongs to; the address gets the plate. */}
                  <View className='footprint-oracle-card__place-head'>
                    <Text className='footprint-oracle-card__place-primary'>
                      {isPlacePending ? pendingPlaceLabel : resolvedVenueName}
                    </Text>
                    {showPlaceAction && (
                      <View className='footprint-oracle-card__place-action' aria-hidden='true'>
                        <Text className='footprint-oracle-card__place-action-label'>{venueActionLabel}</Text>
                        {/* Only a navigation earns the chevron. Beside 复制地址 it
                            promised a screen the tap never reaches. */}
                        {venueActionNavigates && (
                          <Text className='footprint-oracle-card__place-action-chevron' aria-hidden='true'>›</Text>
                        )}
                      </View>
                    )}
                  </View>
                  {(isPlacePending ? pendingPlaceHint : resolvedVenueAddress) && (
                    <Text className='footprint-oracle-card__place-secondary'>
                      {isPlacePending ? pendingPlaceHint : resolvedVenueAddress}
                    </Text>
                  )}
                </View>
              </View>
            )}

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
