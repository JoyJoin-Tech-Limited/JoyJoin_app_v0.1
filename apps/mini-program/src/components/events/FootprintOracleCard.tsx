import React, { useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getPoolGroupDetails } from '@shared/api'
import type { JoinedEventSummary } from '@shared/api'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { haptics } from '../../lib/utils/haptics'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api/api'
import { queryClient } from '../../lib/api/queryClient'
import {
  getJoinedEventDisplayDateTime,
  isJoinedEventTerminal,
} from '../../lib/utils/eventDisplay'
import {
  resolveTableEntryState,
  type TableEntryState,
} from '../../lib/utils/eventCardNavigation'
import { hasOpenedTableRecently, syncTableRevealedAt } from '../../lib/utils/tableRevealState'
import EventSummaryCard from './EventSummaryCard'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './FootprintOracleCard.scss'

// groupSize is the viewer's assigned table size, never pool registrations or
// a configured formation target. It is meaningful only with an assigned group.
const ASSIGNED_TABLE_VISIBLE_STATUSES = new Set([
  'matched',
  'confirmed',
  'venue_unlocked',
  'completed',
  'attended',
])

/**
 * The seal→faces hand-off plays once, right after the ceremony. Beyond this
 * window the card is simply a table that was opened at some point.
 */
const REVEAL_RECEIPT_WINDOW_MS = 15_000

// Venue assignment resolves a whole pool's groups in one run, and a user can
// hold several matched pools — so one refresh can flip three cards at once.
// Three `success` haptics in a burst is not a celebration, it is a buzzing
// phone. One acknowledgement per tick, shared across every card instance
// (designer C1). Module scope is deliberate: the cooldown must be global, and a
// ref would be per card.
const VENUE_LANDS_HAPTIC_COOLDOWN_MS = 1_500
let lastVenueLandsHapticAt = 0

// Literal class names, not `--d${depth}`: the BEM coverage guard scans source
// text and cannot resolve interpolation, so an interpolated modifier reads as an
// undefined class. Depth 2 is the front disc (darkest, paints last).
const SEAL_DISCS = [
  'footprint-oracle-card__seal-disc--d0',
  'footprint-oracle-card__seal-disc--d1',
  'footprint-oracle-card__seal-disc--d2',
] as const

export interface FootprintOracleCardProps {
  event: JoinedEventSummary
  index?: number
  /** `tableEntryState` is the state the card rendered, so routing cannot drift from the affordance. */
  onClick?: (event: JoinedEventSummary, tableEntryState: TableEntryState) => void
  isDegradation?: boolean
  /** Presentation-only context for past-day records in the completed bucket. */
  isHistorical?: boolean
}

export default React.memo(function FootprintOracleCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
  isHistorical = false,
}: FootprintOracleCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradation || deviceIsDegradation
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const { user: currentUser } = useAuth()
  const openBoxEntryEnabled = currentUser?.features?.eventCardOpenBoxEntryEnabled ?? true

  const status = event.displayStatus ?? event.status ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)
  const isHistoricalNonterminal = isHistorical && !isTerminal

  // Sealed vs settled is one answer, used by both the visuals and the tap
  // destination (2026-11-11). A formed table that has not been opened here
  // offers the box; once opened the card goes quiet.
  const tableEntryState = useMemo(
    () => resolveTableEntryState(event, { openBoxEntryEnabled, isHistorical }),
    [event, openBoxEntryEnabled, isHistorical],
  )
  const isSealedTable = tableEntryState === 'sealed'
  const showRevealReceipt = useMemo(
    () => tableEntryState === 'revealed' && hasOpenedTableRecently(event.groupId, REVEAL_RECEIPT_WINDOW_MS),
    [tableEntryState, event.groupId],
  )

  // Mirror the server fact into the local cache (2026-11-11). The list payload
  // is authoritative, but the receipt window and the matching-status gate still
  // read the cache — seeding it here is what makes them agree on a new device.
  useEffect(() => {
    if (!event.groupId || !event.revealedAt) return
    syncTableRevealedAt(event.groupId, event.revealedAt)
  }, [event.groupId, event.revealedAt])

  const handleClick = React.useCallback(() => {
    haptics('light')
    // Prime the ceremony's payload before the route changes so the landing
    // frame is composed instead of loading (designer: "the enabling mechanism
    // is the prefetch, not the animation"). Failures never block the tap;
    // TanStack v5 prefetchQuery resolves undefined instead of rejecting.
    if (tableEntryState === 'sealed' && event.groupId) {
      void queryClient.prefetchQuery({
        queryKey: ['mini-program', 'pool-group', event.groupId],
        queryFn: () => getPoolGroupDetails(apiRequest, event.groupId as string),
      })
    }
    onClick?.(event, tableEntryState)
  }, [event, onClick, tableEntryState])

  // 2026-10-16 feedback activation (PM plan §5.3): terminal + server-flagged
  // feedbackPending rows carry a persistent「去评价」entry — the recall channel
  // for users without push authorization. Brand-secondary pill, NOT a solid
  // primary CTA (the card itself stays the primary touch surface).
  const showFeedbackPill = isTerminal && event.feedbackPending === true

  // Impression mirrors corner_badge_impression discipline: once per mount.
  useEffect(() => {
    if (!showFeedbackPill) return
    trackFeedbackEvent('feedback_entry_shown', { eventId: event.id, state: 'open', surface: 'events_tab' })
  }, [showFeedbackPill, event.id])

  // Sealed/settled impressions are the denominator for "did the box get
  // opened after the card said it was waiting" — instrument only the formed
  // tables, because that is the cohort the entry can change.
  useEffect(() => {
    if (tableEntryState === 'none') return
    eventsAnalytics.track('events_card_impression', {
      eventId: event.id,
      state: tableEntryState,
      hasGroup: Boolean(event.groupId),
    })
  }, [tableEntryState, event.id, event.groupId])

  // stopPropagation: the pill must not trigger the card's own detail navigation.
  const handleFeedbackPillTap = React.useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      haptics('light')
      trackFeedbackEvent('feedback_reminder_tap', { eventId: event.id, from: 'events_tab' })
      Taro.navigateTo({
        url: `/pages/event-feedback/index?id=${encodeURIComponent(event.id)}&from=events_tab`,
      })
    },
    [event.id],
  )

  const animDelay = !effectiveDegradation && !reduceMotion ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  const displayDateTime = getJoinedEventDisplayDateTime(event)
  const groupSize = typeof event.groupSize === 'number' ? event.groupSize : undefined
  const price = typeof event.price === 'number' ? event.price : undefined
  const hasAssignedTable = Boolean(event.groupId)
    && groupSize != null
    && groupSize > 0
    && ASSIGNED_TABLE_VISIBLE_STATUSES.has(status)
  const groupSizeLabel = hasAssignedTable
    ? ((status === 'matched' || status === 'confirmed' || status === 'venue_unlocked') && !isHistoricalNonterminal
        ? `已排进 ${groupSize} 人桌`
        : `${groupSize} 人桌`)
    : undefined
  // The table identity carries the chemistry number too: the closing line only
  // says what is behind the card, so the actual score has to be readable here.
  // Sealed cards are the exception — the score is part of what the box holds,
  // and printing it above 「开箱看桌友」 hands the gift over before it is opened.
  // It returns with the faces once the table has been opened (2026-11-11).
  const tableScoreLabel = !isSealedTable && typeof event.matchScore === 'number' && event.matchScore > 0
    ? `合拍度 ${event.matchScore}`
    : undefined

  const railAriaParts = useMemo(() => {
    const parts: string[] = []
    // Never announce a countdown the card does not render: the sealed card
    // suppresses it, and "含活动倒计时" would contradict the single-pill rail.
    if (!isHistoricalNonterminal && !isTerminal && !isSealedTable && Boolean(event.dateTime || event.finalDateTime)) {
      parts.push('含活动倒计时')
    }
    if (groupSizeLabel) {
      parts.push(groupSizeLabel)
    }
    if (tableScoreLabel) {
      parts.push(tableScoreLabel)
    }
    if (price != null) {
      parts.push(price > 0 ? `费用 ¥${price}` : '免费')
    }
    return parts
  }, [event.dateTime, event.finalDateTime, groupSizeLabel, tableScoreLabel, isHistoricalNonterminal, isSealedTable, isTerminal, price])

  const railAriaLabel = railAriaParts.length > 0 ? railAriaParts.join('，') : undefined

  const hasPrice = price != null
  const tableFaces = Array.isArray(event.memberArchetypes)
    ? event.memberArchetypes.filter((archetype) => typeof archetype === 'string' && archetype.length > 0).slice(0, 6)
    : []
  const themePill = typeof event.theme === 'string' && event.theme.trim() ? event.theme.trim() : undefined
  // The rationale belongs to the table, and a sealed card is still holding its
  // table back — same reason the faces and 合拍度 are withheld until the box is
  // opened (2026-11-11).
  const themeSubtitle = !isSealedTable && typeof event.themeSubtitle === 'string' && event.themeSubtitle.trim()
    ? event.themeSubtitle.trim()
    : undefined
  const themeHighlights = !isSealedTable && Array.isArray(event.themeHighlights)
    ? event.themeHighlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined

  // ── Venue navigation (2026-11-11) ────────────────────────────
  // The payload has carried `venueAddress` all along and the card never showed
  // it, so a confirmed table told the user a venue NAME and nothing else. The
  // action is capability-matched: a map needs coordinates, and when a venue was
  // never geocoded the honest affordance is copying the address — a 「导航」 that
  // silently does nothing is worse than no affordance at all.
  const venueAddress = typeof event.venueAddress === 'string' && event.venueAddress.trim()
    ? event.venueAddress.trim()
    : undefined
  const venueLatitude = typeof event.venueLatitude === 'number' && Number.isFinite(event.venueLatitude)
    ? event.venueLatitude
    : undefined
  const venueLongitude = typeof event.venueLongitude === 'number' && Number.isFinite(event.venueLongitude)
    ? event.venueLongitude
    : undefined
  const venueName = typeof event.venueName === 'string' && event.venueName.trim() ? event.venueName.trim() : undefined
  const canOpenMap = venueLatitude != null && venueLongitude != null

  // ── The venue-lands beat (2026-11-11) ─────────────────────────
  // The venue can arrive while this card is already on screen (the events tab
  // refreshes my-registrations). Without this beat the card silently swapped a
  // pending field for a resolved one — a fact it told the user to wait for
  // changed, and nothing acknowledged it. Only a transition observed by this
  // mount fires: the ref starts at the first render's value, so a card that
  // opens already-resolved never celebrates on arrival.
  const isPlaceResolved = Boolean(venueName) && !isHistoricalNonterminal && status !== 'matched'
  const placeResolvedRef = React.useRef(isPlaceResolved)
  const [placeRevealed, setPlaceRevealed] = React.useState(false)

  useEffect(() => {
    const wasResolved = placeResolvedRef.current
    placeResolvedRef.current = isPlaceResolved
    if (wasResolved || !isPlaceResolved) return undefined
    // The haptic is an acknowledgement, not a motion effect: reduced motion is a
    // visual preference, so it must not cost these users the only signal they
    // would otherwise get. Only the class is suppressed.
    if (Date.now() - lastVenueLandsHapticAt > VENUE_LANDS_HAPTIC_COOLDOWN_MS) {
      lastVenueLandsHapticAt = Date.now()
      haptics('success')
    }
    if (reduceMotion) return undefined
    setPlaceRevealed(true)
    const timer = setTimeout(() => setPlaceRevealed(false), 1600)
    return () => clearTimeout(timer)
  }, [isPlaceResolved, reduceMotion])

  const handleVenueAction = React.useCallback(() => {
    haptics('light')
    const copyAddress = () => {
      const payload = [venueName, venueAddress].filter(Boolean).join(' ')
      if (!payload) return
      void Taro.setClipboardData({ data: payload })
        .then(() => Taro.showToast({ title: '地址已复制', icon: 'none', duration: 1600 }))
        .catch(() => undefined)
    }

    if (!canOpenMap) {
      copyAddress()
      return
    }

    void Taro.openLocation({
      latitude: venueLatitude as number,
      longitude: venueLongitude as number,
      name: venueName ?? '活动地点',
      address: venueAddress,
      scale: 18,
    }).catch(copyAddress)
  }, [canOpenMap, venueAddress, venueLatitude, venueLongitude, venueName])

  const venueActionLabel = canOpenMap ? '导航' : '复制地址'
  const venueActionAriaLabel = venueName
    ? (canOpenMap ? `打开地图导航到${venueName}` : `复制${venueName}的地址`)
    : undefined
  // Phase 3 (2026-11-10): a state-aware affordance line. The card has no button,
  // so the footer carries the next step instead of inventing a fake CTA. The
  // row above already shows the faces, so the hint promises the layer the faces
  // cannot: who they are and how well you fit (designer B2).
  // 2026-11-11: a sealed table carries the capsule instead — the hint must not
  // compete with it, and it was the wrong voice for an unopened box anyway.
  const ctaHint = isSealedTable
    ? undefined
    : status === 'completed' || status === 'attended'
      ? '翻翻这场回顾'
      : hasAssignedTable
        ? '看看这桌的合拍度'
        : undefined

  // The facts band's grammar is "left cluster ⇄ right number": faces illustrate
  // the table count, so without a count they are a dangling cluster, and a
  // price with no left fact reads as unloaded content. The band exists only
  // when the table count does (designer B1/B2, 2026-11-10).
  //
  // 2026-11-11: a sealed table shows an abstract stack instead of real faces.
  // Showing the six people here pre-spoils the ceremony that the same card
  // invites you into, and the count is already stated beside it. The discs are
  // deliberately identical — three different people would be a lie about the
  // table composition.
  const metaAccessory = groupSizeLabel ? (
    <View className='footprint-oracle-card__facts'>
      {isSealedTable ? (
        <View className='footprint-oracle-card__seal' aria-hidden='true'>
          {SEAL_DISCS.map((sealClass, sealIndex) => (
            <View
              key={`${event.id}-seal-${sealIndex}`}
              className={`footprint-oracle-card__seal-disc ${sealClass}`}
            />
          ))}
        </View>
      ) : tableFaces.length > 0 && (
        <View className='footprint-oracle-card__table-faces' aria-hidden='true'>
          {tableFaces.map((archetype, faceIndex) => {
            const token = getArchetypeTokens(archetype)
            return (
              <View
                key={`${event.id}-face-${faceIndex}`}
                className='footprint-oracle-card__table-face'
                style={{ borderColor: token.primary }}
              >
                <ArchetypeHead
                  archetype={archetype}
                  size={40}
                  variant='head'
                  fallback='initial'
                  fallbackText={archetype.charAt(0).toUpperCase()}
                />
              </View>
            )
          })}
        </View>
      )}
      {groupSizeLabel && (
        <Text className='footprint-oracle-card__fact'>
          {groupSizeLabel}
          {tableScoreLabel ? ` · ${tableScoreLabel}` : ''}
        </Text>
      )}
      {hasPrice && (
        <Text className='footprint-oracle-card__fact footprint-oracle-card__fact--price'>
          {price > 0 ? `¥${price}` : '免费'}
        </Text>
      )}
    </View>
  ) : undefined

  // The sealed card's one filled-purple object, and its only action. It carries
  // no handler of its own: the tap bubbles to the card, so there is exactly one
  // destination on this surface (designer + PM, 2026-11-11).
  const sealedCapsule = isSealedTable ? (
    <View
      className='footprint-oracle-card__capsule'
      hoverClass='footprint-oracle-card__capsule--pressed'
      hoverStayTime={80}
    >
      <Text className='footprint-oracle-card__capsule-label'>开箱看桌友</Text>
      <Text className='footprint-oracle-card__capsule-chevron' aria-hidden='true'>›</Text>
    </View>
  ) : undefined

  const footerContent = sealedCapsule ?? (showFeedbackPill ? (
    <View
      className='footprint-oracle-card__feedback-pill'
      hoverClass='footprint-oracle-card__feedback-pill--pressed'
      role='button'
      aria-label='去评价这场活动'
      onClick={handleFeedbackPillTap}
    >
      <Text className='footprint-oracle-card__feedback-pill-label'>去评价</Text>
    </View>
  ) : undefined)

  // Sealed: the arrival pill is the only status the rail should carry, and the
  // pulse belongs to an unopened box — it stops once the box has been opened.
  return (
    <EventSummaryCard
      id={`footprint-card-${event.id}`}
      title={event.title}
      eventType={event.eventType}
      dateTime={displayDateTime}
      city={event.city}
      district={event.district}
      venueName={event.venueName}
      venueAddress={venueAddress}
      placeRevealed={placeRevealed}
      venueActionLabel={venueActionLabel}
      venueActionAriaLabel={venueActionAriaLabel}
      onVenueAction={handleVenueAction}
      location={event.location}
      status={event.status}
      displayStatus={event.displayStatus}
      isHistorical={isHistorical}
      interactive
      onClick={handleClick}
      hoverClass='footprint-oracle-card--pressed'
      role='button'
      railAriaLabel={railAriaLabel}
      animationDelay={animDelay}
      isDegradation={effectiveDegradation}
      reduceMotion={reduceMotion}
      layout='split'
      themePill={themePill}
      themeSubtitle={themeSubtitle}
      themeHighlights={themeHighlights}
      footerHint={ctaHint}
      suppressCountdown={isSealedTable}
      suppressLivePulse={tableEntryState === 'revealed'}
      className={[
        isSealedTable ? 'footprint-oracle-card--sealed' : '',
        showRevealReceipt ? 'footprint-oracle-card--receipt' : '',
      ].filter(Boolean).join(' ') || undefined}
      // An action phrase, not a full replacement: a sealed card still owes the
      // reader the date, venue and price that every other card announces.
      ariaAction={isSealedTable && groupSize
        ? `开箱看看这桌的 ${groupSize} 位桌友`
        : undefined}
      titleAccessory={(
        <Text className='footprint-oracle-card__title-cue' aria-hidden='true'>›</Text>
      )}
      metaAccessory={metaAccessory}
      footerContent={footerContent}
    />
  )
})
