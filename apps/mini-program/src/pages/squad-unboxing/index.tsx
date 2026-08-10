import { View, Text, ScrollView, Image, Canvas } from '@tarojs/components'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { usePageTTI } from '../../hooks/usePageTTI'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Button from '../../components/ui/Button'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import TypewriterText from '../../components/ui/TypewriterText'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { haptics } from '../../lib/utils/haptics'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import { BlindBoxVisual } from './BlindBoxVisual'
import { BlindBoxLid } from './BlindBoxLid'
import DragRevealRibbon from './DragRevealRibbon'
import XiaoyueHostImage from './XiaoyueHostImage'
import SquadDeckStage from './SquadDeckStage'
import DeckCollapsePill from './DeckCollapsePill'
import SquadTableCard from './SquadTableCard'
import {
  drawSquadTableCardPoster,
  SQUAD_TABLE_CARD_CANVAS_ID,
  SQUAD_TABLE_CARD_POSTER_HEIGHT,
  SQUAD_TABLE_CARD_POSTER_WIDTH,
} from './squadTableCardPoster'
import {
  SQUAD_DECK_POCKETED_ANNOUNCEMENT,
  SQUAD_DECK_POCKETED_HINT_TEXT,
  buildDeckPillStripModel,
  buildEventBriefDate,
  buildFocusedMemberBubbleText,
  buildFocusedNarrativeModel,
  buildRevealChipLabel,
  buildSelfCardBubbleText,
  buildSquadSoulBubbleText,
  buildTableDiagnosis,
  getChemistryWord,
  getDeckPillChemistryClass,
  getEventTypeLabel,
  getEventTypePillTone,
  getMemberName,
  getSelfSquadRoleLabel,
  getVibeLabel,
  resolveCardFocusInteraction,
  SQUAD_BURST_COMPLETION_BUBBLE_TEXT,
  SQUAD_SELF_CARD_BUBBLE_TEXT,
  SQUAD_TEASE_BUBBLE_TEXT,
  SQUAD_TEASE_POCKETED_BUBBLE_TEXT,
} from './squadUnboxingViewModels'
import { scheduleFlipSettleNarration, FLIP_NARRATION_DELAY_MS, FLIP_IN_FLIGHT_GUARD_MS } from './squadFlipState'
import { getOracleCardCornerAsset } from '../../components/discover/oracleCardAssets'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { preloadImagesWithDiagnostics } from '../../lib/utils/imagePreload'

import { useSquadUnboxingController } from './useSquadUnboxingController'
import './index.scss'

function getPageTitle(eventType?: string | null): string {
  if (eventType === 'bar') return '你的酒局桌友来了'
  if (eventType === 'dining') return '你的饭局桌友来了'
  return '你的桌友来了'
}

/** Flip hold-to-onLoad (2026-07-24 P1): max wait for the front art before
 *  flipping anyway — a card never flips into a skeleton on slow networks. */
const ART_FLIP_HOLD_TIMEOUT_MS = 1200
/** Bounded re-arms for a held flip that keeps landing inside the in-flight
 *  guard window (review CONCERN-1). */
const HELD_FLIP_MAX_RETRIES = 3
/** 最佳拍档 heartbeat haptics: the light pulse follows the medium beat. */
const BEST_PARTNER_HEARTBEAT_GAP_MS = 90

export default function SquadUnboxingPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { isExiting, navigateBack } = useJoyJoinNavigation()

  const {
    authLoading,
    isLoading,
    fetchError,
    poolGroup,
    group,
    pool,
    members,
    currentUserId,
    groupAnalysis,
    viewerPairByMemberId,
    groupThemeHighlights,
    flowState,
    boxExiting,
    dealSettled,
    actionDockState,
    rootClassName,
    shouldReduceMotion,
    confirmAttendanceMutation,
    isSubmitting,
    showSuccessOverlay,
    archetypeMixCopy,
    flippedIds,
    flipDelayById,
    unflippedCount,
    isInteractiveSession,
    bestPartnerUserId,
    flipOne,
    flipAll,
    isFlipInFlight,
    notifyDealSettled,
    deckPhase,
    foldDelayById,
    unfoldDelayById,
    reopenDeck,
    notifyFoldSettled,
    notifyUnfoldSettled,
    showPocketHint,
    dismissPocketHint,
    handleOpenBox,
    handleConfirmAttendance,
    refetch,
  } = useSquadUnboxingController({ groupId, routerParams: router.params })

  const { isDegradation } = useDeviceTier()
  // B5: TTI instrumentation — ready once the auth gate and group fetch settle.
  usePageTTI({ pageName: 'squad-unboxing', ready: !authLoading && !isLoading })
  const { user: currentUser } = useAuthGuard()
  const dragRevealEnabled = currentUser?.features?.squadUnboxingDragRevealEnabled ?? true
  const composedHeroEnabled = currentUser?.features?.socialSquadComposedHeroEnabled ?? false
  const storyName = router.params['__story']
  const isStoryFocused = storyName === 'focused'
  const isComposedHeroActive = composedHeroEnabled && (flowState === 'ready' || flowState === 'shaking')
  // In composed mode the Xiaoyue host floats above the box, so the whole stage
  // (host + box) becomes one tap target via a dedicated layer; the stage body
  // drops its own handlers to avoid double-firing.
  const isStageTap = composedHeroEnabled && flowState === 'ready'

  const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
  const [animateFocusedNarration, setAnimateFocusedNarration] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [headerReady, setHeaderReady] = useState(false)
  const [briefVignetteFailed, setBriefVignetteFailed] = useState(false)
  // Bump on swipe-back re-entry to reset transient deal/focus state in
  // the deck stage. First mount is excluded so the initial deal can animate.
  const [resetSignal, setResetSignal] = useState(0)
  const hasShownRef = useRef(false)
  // Mirror of focusedCardIndex so handleCardTap can compute the next focus
  // synchronously without running side effects inside a state updater.
  const focusedCardIndexRef = useRef(-1)
  const animateFocusedNarrationRef = useRef(false)
  const seenMemberNarrationsRef = useRef<Set<string>>(new Set())
  // Dock-bubble narration (AC-02): null = resting voice; 'member' = per-card
  // narration for the focused card; 'burst' = the group-completion line after
  // a reveal-all burst. The narration swap for a one-step flip lands AFTER
  // the flip ends (ref-tracked timer, ≤500ms bound — never tap-instant).
  const [bubbleNarration, setBubbleNarration] = useState<{ kind: 'member'; userId: string } | { kind: 'burst' } | null>(null)
  const narrationCancelRef = useRef<(() => void) | null>(null)
  const tonightsTableViewTrackedRef = useRef(false)
  const matchExplanationCopy = normalizeMatchingCopy(group?.matchExplanation)

  const cancelNarrationTimer = useCallback(() => {
    if (narrationCancelRef.current) {
      narrationCancelRef.current()
      narrationCancelRef.current = null
    }
  }, [])

  // No setState-after-unmount: an interrupted flip never narrates a stale
  // card (REL-04).
  useEffect(() => () => cancelNarrationTimer(), [cancelNarrationTimer])

  useEffect(() => {
    focusedCardIndexRef.current = focusedCardIndex
  }, [focusedCardIndex])

  useEffect(() => {
    animateFocusedNarrationRef.current = animateFocusedNarration
  }, [animateFocusedNarration])

  useEffect(() => {
    seenMemberNarrationsRef.current = new Set()
    animateFocusedNarrationRef.current = false
    setAnimateFocusedNarration(false)
    tonightsTableViewTrackedRef.current = false
  }, [groupId])

  useEffect(() => {
    if (isStoryFocused && members.length > 0 && focusedCardIndex === -1) {
      const index = Math.min(2, members.length - 1)
      setFocusedCardIndex(index)
      focusedCardIndexRef.current = index
      // Focused-after-flip story state: the dock narrates the focused member.
      const member = members[index]
      if (member) setBubbleNarration({ kind: 'member', userId: member.userId })
    }
  }, [isStoryFocused, members.length, focusedCardIndex, members])

  useDidShow(() => {
    if (isStoryFocused) return
    setFocusedCardIndex(-1)
    focusedCardIndexRef.current = -1
    // Warm re-entry returns the bubble to the resting 团魂 voice and drops any
    // in-flight narration timer (mid-game flips themselves survive — they are
    // controller-owned session state).
    cancelNarrationTimer()
    setBubbleNarration(null)
    if (hasShownRef.current) {
      // Re-entry (swipe-back / foreground): the reveal already played — keep
      // the chapters, 团魂 bubble, and action dock VISIBLE (headerReady stays
      // true; the [authLoading, isLoading] arm effect won't re-fire on a warm
      // re-entry, so without this the dock would stick at translateY(100%)
      // and the bubble/pair cards at opacity:0). Only transient deck state
      // resets so the fan settles without replaying the flight.
      setResetSignal((signal) => signal + 1)
      setHeaderReady(true)
    } else {
      setHeaderReady(false)
    }
    hasShownRef.current = true
  })

  // Native WeChat share (top-right menu / 转发). The callback fires only when
  // the user actually opens the share sheet, so the track call inside it
  // measures real share intent — the toast-only 截图 CTA stays on
  // `squad_unboxing_share_poster_tap`. Path lands recipients on the app entry
  // (groupId is opaque; no PII in the payload).
  useShareAppMessage(() => {
    squadUnboxingAnalytics.track('squad_unboxing_card_shared', {
      groupId,
      screen: 'squad-unboxing',
    })
    return {
      title: '我在 JoyJoin 开出了这周的同频桌友',
      path: '/pages/index/index?source=squad-unboxing-share',
    }
  })

  useEffect(() => {
    if (flowState !== 'revealed' || members.length === 0) return
    const message = `礼盒打开，发现 ${members.length} 张队友卡片`
    setAnnouncement(message)
    const timer = setTimeout(() => setAnnouncement(''), 1200)
    return () => clearTimeout(timer)
  }, [flowState, members.length])

  useEffect(() => {
    if (authLoading || isLoading) return
    const timer = setTimeout(() => setHeaderReady(true), 120)
    return () => clearTimeout(timer)
  }, [authLoading, isLoading])

  const trackCardFocus = useCallback((index: number, previousIndex: number, interaction?: string) => {
    const member = members[index]
    squadUnboxingAnalytics.track('squad_unboxing_card_focus', {
      source: 'deck_tap',
      ...(interaction ? { interaction } : {}),
      cardIndex: index,
      focusedUserId: member?.userId,
      previousIndex,
      groupId,
      screen: 'squad-unboxing',
    })
  }, [members, groupId])

  /**
   * Face-up focus authority (`resolveCardFocusInteraction`):
   * - different card → focus; narration swaps instantly and the typewriter
   *   animates only the first time a member is seen.
   * - same card while narrating → fast-forward the animation (content kept).
   * - same card when done → dismiss (unfocus → resting voice).
   */
  const handleCardFocus = useCallback((index: number, haptic: 'light' | 'none' = 'light') => {
    const member = members[index]
    if (!member) return
    const current = focusedCardIndexRef.current
    const memberKey = member.userId ?? `index:${index}`
    const resolution = resolveCardFocusInteraction(
      current,
      index,
      seenMemberNarrationsRef.current.has(memberKey),
      animateFocusedNarrationRef.current,
    )
    const next = resolution.nextIndex
    if (resolution.action === 'focus') seenMemberNarrationsRef.current.add(memberKey)
    focusedCardIndexRef.current = next
    animateFocusedNarrationRef.current = resolution.animateNarration
    setFocusedCardIndex(next)
    setAnimateFocusedNarration(resolution.animateNarration)

    if (resolution.action === 'dismiss') {
      cancelNarrationTimer()
      setBubbleNarration(null)
      squadUnboxingAnalytics.track('squad_unboxing_card_detail_dismiss', {
        source: 'deck_tap',
        cardIndex: index,
        focusedUserId: member.userId,
        previousIndex: current,
        groupId,
        screen: 'squad-unboxing',
      })
    } else if (resolution.action === 'focus') {
      // Focus haptic is tactile feedback for an explicit tap; suppressed under
      // reduce-motion / degradation per the fallback contract.
      if (!shouldReduceMotion && !isDegradation && haptic !== 'none') haptics('light')
      cancelNarrationTimer()
      setBubbleNarration({ kind: 'member', userId: member.userId })
      trackCardFocus(next, current)
    } else {
      // 'complete' — fast-forward an in-flight narration; content unchanged.
      trackCardFocus(index, current, 'narration_fast_forward')
    }
  }, [members, groupId, shouldReduceMotion, isDegradation, trackCardFocus, cancelNarrationTimer])

  /**
   * One-step reveal-with-narration (AC-02): tap a face-DOWN card → flip +
   * focus + narration landing after flip-end (≤500ms bound, never
   * tap-instant); `card_flip` fires once via the controller, `card_focus`
   * once here. Tap a face-UP card → delegate to the resolver (focus /
   * fast-forward / dismiss). Taps while any flip is in flight are ignored.
   *
   * `haptic: 'none'` is used by the long-press path — the card already fired
   * the medium long-press haptic (AC-12).
   */
  // 最佳拍档 heartbeat timer (2026-07-24 P1): ref-tracked so unmount never
  // fires a stale vibrate.
  const bestPartnerHapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Flip hold-to-onLoad (2026-07-24 P1): ids whose front art has decoded, and
  // the one pending flip waiting on an image (replaced by any newer tap).
  const artReadyIdsRef = useRef<Set<string>>(new Set())
  const pendingFlipRef = useRef<{ userId: string; timer: ReturnType<typeof setTimeout> } | null>(null)

  const clearPendingFlip = useCallback(() => {
    if (pendingFlipRef.current) {
      clearTimeout(pendingFlipRef.current.timer)
      pendingFlipRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearPendingFlip()
    if (bestPartnerHapticTimerRef.current) clearTimeout(bestPartnerHapticTimerRef.current)
  }, [clearPendingFlip])

  /**
   * The flip + focus + narration beat for a face-down card (AC-02). Extracted
   * from handleCardTap so the hold-to-onLoad gate can defer it: the gesture
   * acknowledges instantly (haptic), the flip lands when the front art has
   * decoded (or the 1200ms ceiling trips) — never into a skeleton.
   */
  const revealCardAtIndex = useCallback((index: number, haptic: 'light' | 'none' = 'light') => {
    const member = members[index]
    if (!member) return
    const instant = shouldReduceMotion || isDegradation
    const isBestPartner = member.userId === bestPartnerUserId

    // First flip of a card is by definition unseen — animate the narration
    // when it lands after flip-end (resolver semantics for later re-taps).
    const current = focusedCardIndexRef.current
    flipOne(member.userId, 'tap')
    seenMemberNarrationsRef.current.add(member.userId)
    animateFocusedNarrationRef.current = true
    setAnimateFocusedNarration(true)
    focusedCardIndexRef.current = index
    setFocusedCardIndex(index)
    if (!instant && haptic !== 'none') {
      if (isBestPartner) {
        // 最佳拍档 jackpot heartbeat (2026-07-24 P1): medium → 90ms → light
        // replaces the plain tap haptic so the flip reads as the peak.
        haptics('medium')
        if (bestPartnerHapticTimerRef.current) clearTimeout(bestPartnerHapticTimerRef.current)
        bestPartnerHapticTimerRef.current = setTimeout(() => {
          bestPartnerHapticTimerRef.current = null
          haptics('light')
        }, BEST_PARTNER_HEARTBEAT_GAP_MS)
      } else {
        haptics('light')
      }
    }
    trackCardFocus(index, current)
    cancelNarrationTimer()
    if (instant) {
      setBubbleNarration({ kind: 'member', userId: member.userId })
    } else {
      // The slow (0.6×) jackpot flip gets a proportionally later narration.
      const narrationDelay = isBestPartner
        ? Math.round(FLIP_NARRATION_DELAY_MS * 1.75)
        : FLIP_NARRATION_DELAY_MS
      narrationCancelRef.current = scheduleFlipSettleNarration(
        { setTimer: (cb, ms) => setTimeout(cb, ms), clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) },
        () => {
          narrationCancelRef.current = null
          setBubbleNarration({ kind: 'member', userId: member.userId })
        },
        narrationDelay,
      )
    }
  }, [
    members,
    shouldReduceMotion,
    isDegradation,
    bestPartnerUserId,
    flipOne,
    trackCardFocus,
    cancelNarrationTimer,
  ])

  /**
   * Hold release with the in-flight guard (2026-07-24 review CONCERN-1):
   * both release paths (onLoad + 1200ms ceiling) re-check the flip guard
   * instead of bypassing it — a held flip landing mid-burst re-arms after
   * the guard window (bounded retries) rather than stacking two flips. The
   * closure captures userId (never index) so a roster refetch during the
   * hold can never flip the wrong card.
   */
  const scheduleHeldFlip = useCallback((userId: string, retriesLeft: number) => {
    pendingFlipRef.current = {
      userId,
      timer: setTimeout(() => {
        pendingFlipRef.current = null
        if (isFlipInFlight()) {
          if (retriesLeft > 0) scheduleHeldFlip(userId, retriesLeft - 1)
          return
        }
        const index = members.findIndex((member) => member.userId === userId)
        if (index >= 0) revealCardAtIndex(index, 'none')
      }, retriesLeft === HELD_FLIP_MAX_RETRIES
        ? ART_FLIP_HOLD_TIMEOUT_MS
        : FLIP_IN_FLIGHT_GUARD_MS),
    }
  }, [isFlipInFlight, members, revealCardAtIndex])

  /** Front art decoded — release a flip that was held for this card. */
  const handleCardArtLoad = useCallback((userId: string) => {
    artReadyIdsRef.current.add(userId)
    const pending = pendingFlipRef.current
    if (!pending || pending.userId !== userId) return
    clearTimeout(pending.timer)
    pendingFlipRef.current = null
    if (isFlipInFlight()) {
      scheduleHeldFlip(userId, HELD_FLIP_MAX_RETRIES - 1)
      return
    }
    const index = members.findIndex((member) => member.userId === userId)
    if (index >= 0) revealCardAtIndex(index, 'none')
  }, [members, revealCardAtIndex, isFlipInFlight, scheduleHeldFlip])

  const handleCardTap = useCallback((index: number, haptic: 'light' | 'none' = 'light') => {
    const member = members[index]
    if (!member) return
    if (isFlipInFlight()) return

    const instant = shouldReduceMotion || isDegradation
    const isFaceUp = !isInteractiveSession || flippedIds.has(member.userId)

    if (isFaceUp) {
      handleCardFocus(index, haptic)
      return
    }

    // Hold-to-onLoad gate (2026-07-24 P1): if the front art has not decoded
    // yet, acknowledge the tap with a haptic and hold the flip until onLoad
    // (or the 1200ms ceiling) — a card never flips into a skeleton.
    if (!instant && !artReadyIdsRef.current.has(member.userId)) {
      const archetypeId = member.archetype ? resolveArchetype(member.archetype)?.id ?? member.archetype : null
      const artExpected = Boolean(member.avatarUrl) || Boolean(archetypeId && ARCHETYPE_ASSET_MAP[archetypeId]?.webp)
      if (artExpected) {
        if (pendingFlipRef.current?.userId === member.userId) return
        clearPendingFlip()
        if (haptic !== 'none') haptics('light')
        scheduleHeldFlip(member.userId, HELD_FLIP_MAX_RETRIES)
        return
      }
    }

    revealCardAtIndex(index, haptic)
  }, [
    members,
    isFlipInFlight,
    shouldReduceMotion,
    isDegradation,
    isInteractiveSession,
    flippedIds,
    handleCardFocus,
    clearPendingFlip,
    revealCardAtIndex,
    scheduleHeldFlip,
  ])

  const handleCardLongPress = useCallback((index: number) => {
    // Long-press = the same one-step beat; the card's own trailing-tap guard
    // swallows the release tap so nothing double-fires (AC-12).
    handleCardTap(index, 'none')
  }, [handleCardTap])

  /**
   * Reveal-all keeps the original staggered burst without per-card focus or
   * narration. The group-level line lands only after the final flip settles.
   */
  const handleRevealAll = useCallback(() => {
    if (isFlipInFlight()) return
    if (unflippedCount <= 0) return

    const instant = shouldReduceMotion || isDegradation
    if (!instant) haptics('light')
    squadUnboxingAnalytics.track('squad_unboxing_reveal_all_tap', {
      remainingCount: unflippedCount,
      groupId,
      screen: 'squad-unboxing',
    })

    focusedCardIndexRef.current = -1
    setFocusedCardIndex(-1)
    cancelNarrationTimer()
    clearPendingFlip()
    setBubbleNarration(null)

    const { totalMs } = flipAll()
    if (instant) {
      setBubbleNarration({ kind: 'burst' })
    } else {
      narrationCancelRef.current = scheduleFlipSettleNarration(
        { setTimer: (cb, ms) => setTimeout(cb, ms), clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) },
        () => {
          narrationCancelRef.current = null
          setBubbleNarration({ kind: 'burst' })
        },
        totalMs,
      )
    }
  }, [
    isFlipInFlight,
    unflippedCount,
    shouldReduceMotion,
    isDegradation,
    groupId,
    flipAll,
    cancelNarrationTimer,
    clearPendingFlip,
  ])

  const focusedMember = members[focusedCardIndex] ?? null
  const focusedViewerPair = focusedMember
    ? (viewerPairByMemberId.get(focusedMember.userId) ?? null)
    : null

  // 结构化同频分析卡 (2026-07-24 P1): when the dock narrates a focused
  // tablemate (never the 我 card) and the pair data is rich enough, the
  // bubble upgrades from flat prose to verdict → evidence chips → opener.
  const focusedNarrativeModel = bubbleNarration?.kind === 'member'
    && focusedMember
    && bubbleNarration.userId === focusedMember.userId
    && focusedMember.userId !== currentUserId
    ? buildFocusedNarrativeModel(focusedViewerPair, {
      isBestPartner: focusedMember.userId === bestPartnerUserId,
    })
    : null

  // 桌型诊断 (2026-07-24 P0): deterministic role mix — no LLM.
  const tableDiagnosis = useMemo(() => buildTableDiagnosis(members), [members])

  // Narrative cascade (2026-07-24 audit fix): evidence chips + opener only
  // enter AFTER the verdict typewriter completes — fixed CSS delays raced
  // the typing. Non-animated paths (RM/degradation/revisit) show instantly.
  const [verdictComplete, setVerdictComplete] = useState(false)
  const narrationUserId = bubbleNarration?.kind === 'member' ? bubbleNarration.userId : null
  useEffect(() => {
    setVerdictComplete(false)
  }, [narrationUserId])
  const narrativeAnimating = !shouldReduceMotion && !isDegradation && animateFocusedNarration
  const showNarrativeDetails = !narrativeAnimating || verdictComplete

  // Lit CTA (2026-07-24 P0): every card face-up → the confirm button earns
  // its glow. Tap stays enabled either way (conversion is never gated).
  const allCardsUp = !isInteractiveSession || unflippedCount === 0

  // Peak-end settle breath (2026-07-24): the moment the LAST card lands, the
  // whole stage exhales once (1.0→1.015→1.0) with a success haptic — the
  // session's final 400ms decides what the user remembers. Motion tiers
  // only; never on re-entry (isInteractiveSession false).
  const [settleBreath, setSettleBreath] = useState(false)
  const prevUnflippedRef = useRef(unflippedCount)
  const breathTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => {
    breathTimersRef.current.forEach(clearTimeout)
    breathTimersRef.current = []
  }, [])
  useEffect(() => {
    const prev = prevUnflippedRef.current
    prevUnflippedRef.current = unflippedCount
    if (!isInteractiveSession) return undefined
    if (prev <= 0 || unflippedCount !== 0) return undefined
    if (shouldReduceMotion || isDegradation) return undefined
    // Let the final flip land before the breath (flip 340ms + settle beat).
    breathTimersRef.current.push(setTimeout(() => {
      haptics('success')
      setSettleBreath(true)
      breathTimersRef.current.push(setTimeout(() => setSettleBreath(false), 480))
    }, 420))
    return undefined
  }, [unflippedCount, isInteractiveSession, shouldReduceMotion, isDegradation])

  // 这桌的桌卡 (2026-07-24 P2): the collectible + poster-save flow.
  const [tableCardSaving, setTableCardSaving] = useState(false)
  // Canvas retention (2026-07-24 perf audit fix): the hidden poster canvas
  // holds a ~13MB backing store; after a successful save it unmounts. A
  // repeat save remounts and waits a beat before drawing.
  const [posterSaved, setPosterSaved] = useState(false)

  // Pill view models (AC-03): strip + chemistry-tinted ring. Memoized on the
  // flip set so a freshly revealed card swaps its back-chip for a mini.
  const pillStripModel = useMemo(
    () =>
      buildDeckPillStripModel(members, {
        flippedIds,
        allRevealed: !isInteractiveSession,
        bestPartnerUserId,
        currentUserId,
      }),
    [members, flippedIds, isInteractiveSession, bestPartnerUserId, currentUserId],
  )
  const pillChemistryClass = getDeckPillChemistryClass(groupAnalysis?.overallChemistry)

  // Screen-reader announcement when the deck finishes pocketing (AC-09).
  const prevDeckPhaseRef = useRef(deckPhase)
  useEffect(() => {
    const prev = prevDeckPhaseRef.current
    prevDeckPhaseRef.current = deckPhase
    if (prev !== 'pocketed' && deckPhase === 'pocketed') {
      setAnnouncement(SQUAD_DECK_POCKETED_ANNOUNCEMENT)
      const timer = setTimeout(() => setAnnouncement(''), 1200)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [deckPhase, groupId])

  // 今晚这桌 chapter is always expanded (2026-07-17): fire the impression
  // analytics once per group on first reveal, mirroring the old first-expand
  // semantics from the removed collapse toggle. Post-review: gated on
  // dealSettled — the chapter only becomes VISIBLE after the deal, so the
  // impression must wait for the same beat.
  useEffect(() => {
    if (flowState !== 'revealed' || !dealSettled) return
    if (tonightsTableViewTrackedRef.current) return
    tonightsTableViewTrackedRef.current = true
    squadUnboxingAnalytics.track('squad_unboxing_tonights_table_view', {
      groupId,
      screen: 'squad-unboxing',
    })
  }, [flowState, dealSettled, groupId])

  // Bubble voice: burst-completion line > focused-member narration (only when
  // the narration matches the currently focused card — a pending flip keeps
  // the resting voice until flip-end) > resting voice. While face-down cards
  // remain in an interactive session the resting voice is the tease line (C1),
  // swapped for the pocket-aware variant once the deck is pocketed so the copy
  // never invites tapping cards that are hidden inside the pill (CONCERN-1);
  // the soul line is earned once every card is face-up.
  const bubbleText = bubbleNarration?.kind === 'burst'
    ? SQUAD_BURST_COMPLETION_BUBBLE_TEXT
    : bubbleNarration?.kind === 'member' && focusedMember && bubbleNarration.userId === focusedMember.userId
      ? focusedMember.userId === currentUserId
        ? buildSelfCardBubbleText(getSelfSquadRoleLabel(focusedMember.archetype))
        : buildFocusedMemberBubbleText(
          getMemberName(focusedMember),
          normalizeMatchingCopy(focusedViewerPair?.explanation),
          focusedViewerPair?.connectionPoints ?? [],
          focusedViewerPair?.introAngle,
          focusedMember,
        )
      : isInteractiveSession && unflippedCount > 0
        ? deckPhase === 'fan'
          ? SQUAD_TEASE_BUBBLE_TEXT
          : SQUAD_TEASE_POCKETED_BUBBLE_TEXT
        : buildSquadSoulBubbleText(
          archetypeMixCopy,
          groupAnalysis?.groupThemeCompanion || matchExplanationCopy,
          groupAnalysis?.groupDynamics,
        )

  // Event-brief card: structured date block + shared OracleCard corner vignette.
  const briefDate = buildEventBriefDate(group?.finalDateTime ?? pool?.dateTime)
  const briefVignetteSrc = getOracleCardCornerAsset(pool?.eventType ?? undefined)
  // 桌卡 derivatives (2026-07-24 P2): date line reuses the brief breakdown;
  // place line mirrors the 地点 row.
  const tableCardDateLine = briefDate
    ? `${briefDate.month}${briefDate.day}日·${briefDate.weekday}`
    : ''
  const tableCardPlaceLine = group?.venueName || [pool?.city, pool?.district].filter(Boolean).join(' · ') || ''
  const tableCardChemistryWord = getChemistryWord(groupAnalysis?.overallChemistry)

  const handleSaveTableCard = useCallback(async () => {
    if (tableCardSaving) return
    if (isDegradation) {
      Taro.showToast({ title: '当前设备不支持生成桌卡', icon: 'none', duration: 1800 })
      return
    }
    setTableCardSaving(true)
    haptics('medium')
    squadUnboxingAnalytics.track('squad_unboxing_table_card_tap', {
      groupId,
      screen: 'squad-unboxing',
    })
    try {
      if (posterSaved) {
        // Canvas was retired after the last save — remount and let it attach.
        setPosterSaved(false)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      const filePath = await drawSquadTableCardPoster({
        members,
        currentUserId,
        chemistryWord: tableCardChemistryWord,
        dateLine: tableCardDateLine,
        placeLine: tableCardPlaceLine,
        groupNumber: group?.groupNumber ?? null,
      })
      await Taro.saveImageToPhotosAlbum({ filePath })
      setPosterSaved(true)
      haptics('success')
      squadUnboxingAnalytics.track('squad_unboxing_table_card_saved', {
        groupId,
        screen: 'squad-unboxing',
      })
      Taro.showToast({ title: '桌卡已存进相册', icon: 'success', duration: 1800 })
    } catch (error) {
      squadUnboxingAnalytics.track('squad_unboxing_table_card_save_failed', {
        groupId,
        screen: 'squad-unboxing',
        message: error instanceof Error ? error.message : String(error),
      })
      Taro.showToast({ title: '保存没成功，打开相册权限后再试试', icon: 'none', duration: 2000 })
    } finally {
      setTableCardSaving(false)
    }
  }, [
    tableCardSaving,
    isDegradation,
    posterSaved,
    groupId,
    members,
    currentUserId,
    tableCardChemistryWord,
    tableCardDateLine,
    tableCardPlaceLine,
    group?.groupNumber,
  ])
  // Warm the fan's archetype art during the reveal so cards never paint blank
  // frames on 4G (skeleton covers first paint; this shrinks the decode gap).
  useEffect(() => {
    if (flowState !== 'revealed' || members.length === 0) return
    const urls = members
      .slice(0, 8)
      // Archetype may be an ID or a legacy nameCn — resolve before keying.
      .map((member) => {
        if (!member.archetype) return undefined
        const id = resolveArchetype(member.archetype)?.id ?? member.archetype
        return ARCHETYPE_ASSET_MAP[id]?.webp
      })
      .filter((url): url is string => Boolean(url))
    if (urls.length > 0) {
      void preloadImagesWithDiagnostics(urls, 'squad-unboxing:fan-archetypes')
    }
  }, [flowState, members])

  const prevVenueStatusRef = useRef<string | null>(null)

  const handleCopyVenue = useCallback(() => {
    const address = [group?.venueName, group?.venueAddress].filter(Boolean).join(' ')
    if (!address) return
    haptics('light')
    Taro.setClipboardData({
      data: address,
      success: () => {
        Taro.showToast({ title: '地址已复制', icon: 'success', duration: 1500 })
      },
    })
  }, [group?.venueName, group?.venueAddress])

  useEffect(() => {
    if (!groupId || !group) return
    const currentStatus = group.venueAssignmentStatus
    if (prevVenueStatusRef.current === 'unassigned' && currentStatus === 'assigned' && group.venueName) {
      Taro.showToast({ title: '场地已确定', icon: 'success', duration: 2000 })
    }
    prevVenueStatusRef.current = currentStatus ?? null
  }, [groupId, group])

  const pageClassName = [
    rootClassName,
    `squad-unboxing--${flowState}`,
    isExiting ? 'squad-unboxing--exiting' : '',
  ].filter(Boolean).join(' ')

  if (authLoading || isLoading) {
    return <LoadingScreen message='揭晓小队中…' />
  }

  if (fetchError || !poolGroup || !group || !pool) {
    return (
      <View className={pageClassName}>
        <View className='squad-unboxing__error' role='alert' aria-live='polite'>
          <Image
            className='squad-unboxing__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='widthFix'
            lazyLoad
            ariaLabel='加载失败'
          />
          <Text className='squad-unboxing__error-text'>
            {fetchError ? '加载小队信息没成功' : '没有找到小队信息'}
          </Text>
          <View className='squad-unboxing__error-actions'>
            {fetchError ? (
              <Button variant='primary' className='squad-unboxing__error-btn' onClick={() => refetch()} loading={isLoading}>
                重试
              </Button>
            ) : null}
            <Button variant='secondary' className='squad-unboxing__error-btn' onClick={() => navigateBack()}>
              返回
            </Button>
          </View>
        </View>
      </View>
    )
  }

  // Always expanded (2026-07-17) — the collapse toggle/link was removed; the
  // chapter renders directly in the scroll flow below the bubble.
  const tonightsPanel = (
    <View
      className={[
        'squad-unboxing__tonights-panel',
        // Post-review fix: --open follows dealSettled (people first,
        // logistics second) — the chapter never renders during the deal.
        dealSettled ? 'squad-unboxing__tonights-panel--open' : '',
      ].filter(Boolean).join(' ')}
      role='region'
      aria-label='今晚这桌详情'
    >
      <View className={[
        'squad-unboxing__chapter',
        'squad-unboxing__chapter--meta',
        // Chemistry-tint foil top border (2026-07-24 P2): the event card
        // inherits the table's chemistry colour so "人" flows into "事".
        `squad-unboxing__chapter--chem-${groupAnalysis?.overallChemistry ?? 'fallback'}`,
        allCardsUp ? 'squad-unboxing__chapter--late' : '',
        headerReady && dealSettled ? 'squad-unboxing__chapter--ready' : '',
      ]
        .filter(Boolean)
        .join(' ')}>
        {/* Event-brief header: date-led. Big day numeral + month/weekday·time
            on the left; event-type pill + the shared OracleCard corner
            vignette (dining/drinks) on the right. Collapses gracefully —
            with no dateTime the date block drops and the pill stays. */}
        <View className='squad-unboxing__brief-header'>
          <View className='squad-unboxing__brief-header-main'>
            <Text className='squad-unboxing__chapter-title'>今晚这桌</Text>
            {briefDate ? (
              <View className='squad-unboxing__brief-date'>
                <Text className='squad-unboxing__brief-date-day'>{briefDate.day}</Text>
                <View className='squad-unboxing__brief-date-side'>
                  <Text className='squad-unboxing__brief-date-month'>{briefDate.month}</Text>
                  <Text className='squad-unboxing__brief-date-weekday'>
                    {briefDate.weekday} · {briefDate.time}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <View className='squad-unboxing__brief-header-aside'>
            <View
              className={`squad-unboxing__brief-type-pill squad-unboxing__brief-type-pill--${getEventTypePillTone(pool.eventType)}`}
            >
              <Text className='squad-unboxing__brief-type-pill-text'>{getEventTypeLabel(pool.eventType)}</Text>
            </View>
            {briefVignetteSrc && !briefVignetteFailed ? (
              <Image
                className='squad-unboxing__brief-vignette'
                src={briefVignetteSrc}
                mode='aspectFit'
                lazyLoad
                aria-hidden='true'
                onError={() => setBriefVignetteFailed(true)}
              />
            ) : null}
          </View>
        </View>

        <View className='squad-unboxing__meta-row'>
          <View className='squad-unboxing__meta-label'>
            <JoyJoinIcon emoji='📍' size={24} className='squad-unboxing__meta-icon' />
            <Text>地点</Text>
          </View>
          <View className='squad-unboxing__meta-value-wrap'>
            <View className='squad-unboxing__meta-value-line'>
              <Text className='squad-unboxing__meta-value'>
                {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '地点待定'}
              </Text>
              {group.venueName ? (
                <View
                  className='squad-unboxing__copy-chip'
                  hoverClass='squad-unboxing__copy-chip--pressed'
                  role='button'
                  aria-label='复制地址'
                  onClick={handleCopyVenue}
                >
                  <Text className='squad-unboxing__copy-chip-text'>复制</Text>
                </View>
              ) : null}
            </View>
            <Text className={`squad-unboxing__meta-status ${group.venueName ? 'squad-unboxing__meta-status--assigned' : 'squad-unboxing__meta-status--pending'}`}>
              {group.venueName ? '场地已确定' : '场地待定，悦仔会在确认后提醒你'}
            </Text>
            {group.venueAddress ? (
              <Text className='squad-unboxing__meta-sub'>{group.venueAddress}</Text>
            ) : null}
          </View>
        </View>

        {group.theme || group.themeEmoji || group.vibe ? (
          <View className='squad-unboxing__meta-row squad-unboxing__meta-row--theme'>
            <View className='squad-unboxing__meta-label'>
              {group.themeEmoji ? (
                <JoyJoinIcon emoji={group.themeEmoji} size={24} className='squad-unboxing__meta-icon' />
              ) : (
                <JoyJoinIcon emoji='✨' size={24} className='squad-unboxing__meta-icon' />
              )}
              <Text>主题</Text>
            </View>
            <View className='squad-unboxing__meta-value-wrap'>
              <Text className='squad-unboxing__meta-value'>
                {group.theme || '今晚的主题'}
                {group.vibe ? ` · ${getVibeLabel(group.vibe)}` : ''}
              </Text>
              {group.subtitle ? (
                <Text className='squad-unboxing__meta-sub'>{group.subtitle}</Text>
              ) : null}
              {groupThemeHighlights.length > 0 ? (
                <View className='squad-unboxing__meta-highlights'>
                  {groupThemeHighlights.map((highlight) => (
                    <View key={highlight} className='squad-unboxing__meta-highlight'>
                      <Text className='squad-unboxing__meta-highlight-text'>{highlight}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );

  // Batch A (2026-07-24): mascot avatar + the puzzle copy card removed —
  // the gift box is the sole focal point; one tease line in present tense
  // (gift-box metaphor only — 拼图 language belongs to matching-status).
  // Eyebrow carries the spoiler-free count tease (「N 位同桌」).
  const memberCountTease = members.length > 0 ? `${members.length} 位同桌` : ''
  const openBoxAriaLabel = memberCountTease
    ? `轻点打开礼盒，查看今晚的 ${memberCountTease}`
    : '轻点打开礼盒，查看今晚的同桌'
  const readyEyebrow = [
    group.groupNumber ? `第 ${group.groupNumber} 组` : '',
    memberCountTease,
  ].filter(Boolean).join(' · ')

  const legacyHeader = (
    <View className={['squad-unboxing__header', headerReady ? 'squad-unboxing__header--ready' : ''].filter(Boolean).join(' ')}>
      {readyEyebrow ? (
        <Text className='squad-unboxing__header-eyebrow'>{readyEyebrow}</Text>
      ) : null}
      <Text className='squad-unboxing__header-title'>
        {getPageTitle(pool.eventType)}
      </Text>
      <Text className='squad-unboxing__header-tagline'>
        {`${DEFAULT_MASCOT_DISPLAY_NAME}把今晚的同桌装进盒子了，就等你亲手拆开。`}
      </Text>
    </View>
  )

  const composedReadyHeader = (
    <View className={['squad-unboxing__hero-copy', headerReady ? 'squad-unboxing__hero-copy--ready' : ''].filter(Boolean).join(' ')}>
      {readyEyebrow ? (
        <Text className='squad-unboxing__hero-eyebrow'>{readyEyebrow}</Text>
      ) : null}
      <Text className='squad-unboxing__hero-title'>盒子里的，是今晚的同桌</Text>
      <Text className='squad-unboxing__hero-supporting'>
        {`${DEFAULT_MASCOT_DISPLAY_NAME}把对的人悄悄装好了，等你亲手打开。`}
      </Text>
      <View
        className='squad-unboxing__hero-gesture'
        onClick={() => handleOpenBox('box')}
        hoverClass='squad-unboxing__hero-gesture--pressed'
        role='button'
        aria-label={openBoxAriaLabel}
      >
        <Text className='squad-unboxing__hero-gesture-text'>轻点打开</Text>
      </View>
    </View>
  )

  // The header is a READY-state element only (Batch A): during shaking the
  // stage owns the screen purely visually — no text competes with the lid
  // animation. In revealed state the slim title bar owns it instead.
  const header = flowState === 'ready'
    ? composedHeroEnabled
      ? composedReadyHeader
      : legacyHeader
    : null

  return (
    <View className={pageClassName}>
      <ScrollView
        className={['squad-unboxing__scroll', flowState === 'revealed' ? 'squad-unboxing__scroll--revealed' : ''].filter(Boolean).join(' ')}
        scrollY={flowState !== 'revealed'}
        enhanced
        showScrollbar={false}
      >
        <View className='squad-unboxing__scroll-inner'>
          {/* Phase-aware spacer: matches the fixed stage height while the fan
              is up; shrinks to the pill's footprint once pocketed so the
              content-focused phase gets the viewport back (AC-01). The
              transient fold/unfold windows keep the fan height so the
              cascade never fights a reflow. While the first-collapse hint
              bubble is up, --hint grows the spacer ~96rpx so the fixed
              bubble never overlaps the 团魂 first line (G1). */}
          <View className={[
            'squad-unboxing__stage-spacer',
            flowState === 'revealed' && deckPhase !== 'pocketed' ? 'squad-unboxing__stage-spacer--revealed' : '',
            flowState === 'revealed' && deckPhase === 'pocketed' ? 'squad-unboxing__stage-spacer--pocketed' : '',
            isComposedHeroActive ? 'squad-unboxing__stage-spacer--composed' : '',
            showPocketHint && deckPhase === 'pocketed' ? 'squad-unboxing__stage-spacer--hint' : '',
          ].filter(Boolean).join(' ')} />

          <View className={[
            'squad-unboxing__scroll-content',
            flowState === 'revealed' ? 'squad-unboxing__scroll-content--revealed' : 'squad-unboxing__scroll-content--ready',
            isComposedHeroActive ? 'squad-unboxing__scroll-content--composed' : '',
          ].filter(Boolean).join(' ')}>

        {header}

        {flowState === 'ready' && !composedHeroEnabled ? (
          <View className={['squad-unboxing__ribbon-wrap', headerReady ? 'squad-unboxing__ribbon-wrap--ready' : ''].filter(Boolean).join(' ')}>
            <DragRevealRibbon
              shouldReduceMotion={shouldReduceMotion}
              isDegradation={isDegradation}
              enabled={dragRevealEnabled}
              onReveal={() => handleOpenBox('ribbon')}
            />
          </View>
        ) : null}

        {flowState === 'revealed' ? (
          <>
            <View
              className='squad-unboxing__analysis-bubble'
              role='status'
              aria-live='polite'
              aria-atomic='true'
            >
              <View
                className={[
                  'squad-unboxing__analysis-bubble-inner',
                  // Post-review fix: the bubble holds its entrance until the
                  // deal settles — no empty white slab during the handoff.
                  headerReady && dealSettled ? 'squad-unboxing__analysis-bubble-inner--ready' : '',
                ].filter(Boolean).join(' ')}
              >
                <Image
                  className={['squad-unboxing__analysis-bubble-mascot', headerReady && dealSettled ? 'squad-unboxing__analysis-bubble-mascot--ready' : ''].filter(Boolean).join(' ')}
                  mode='aspectFit'
                  src={getXiaoyueExpressionAsset('matchSuccess')}
                  aria-hidden='true'
                />
                {/* key remounts the typewriters when the deal settles so the
                    first keystroke lands with the bubble's entrance, never
                    mid-type while hidden. */}
                <View className='squad-unboxing__analysis-bubble-bubble' key={dealSettled ? 'settled' : 'pending'}>
                  {focusedNarrativeModel ? (
                    <>
                      <View aria-hidden='true'>
                        <TypewriterText
                          className='squad-unboxing__narrative-verdict'
                          text={focusedNarrativeModel.verdict}
                          speed={45}
                          delay={180}
                          enabled={!shouldReduceMotion && !isDegradation && animateFocusedNarration}
                          showCursor={false}
                          numberOfLines={3}
                          onComplete={() => {
                            setVerdictComplete(true)
                            squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                              groupId,
                              screen: 'squad-unboxing',
                            })
                          }}
                        />
                        {showNarrativeDetails && focusedNarrativeModel.evidence.length > 0 ? (
                          <View className='squad-unboxing__narrative-evidence'>
                            {focusedNarrativeModel.evidence.map((point) => (
                              <ConnectionPointPill key={point} text={point} rarity='common' />
                            ))}
                          </View>
                        ) : null}
                        {showNarrativeDetails && focusedNarrativeModel.opener ? (
                          <Text className='squad-unboxing__narrative-opener'>
                            {`「${focusedNarrativeModel.opener}」`}
                          </Text>
                        ) : null}
                      </View>
                      <Text className='squad-unboxing__sr-only'>
                        {[
                          focusedNarrativeModel.verdict,
                          ...focusedNarrativeModel.evidence,
                          focusedNarrativeModel.opener,
                        ].filter(Boolean).join('。')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View aria-hidden='true'>
                        <TypewriterText
                          className='squad-unboxing__analysis-bubble-text'
                          text={bubbleText}
                          speed={45}
                          delay={180}
                          maxDuration={bubbleNarration?.kind === 'member' ? undefined : 3000}
                          enabled={!shouldReduceMotion && !isDegradation && (bubbleNarration?.kind !== 'member' || animateFocusedNarration)}
                          showCursor={false}
                          // BUG B (2026-07-28): clamp the narration so a long
                          // member intro can never spill over the 桌卡 strip
                          // in the locked revealed column.
                          numberOfLines={4}
                          onComplete={() => {
                            squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                              groupId,
                              screen: 'squad-unboxing',
                            })
                          }}
                        />
                      </View>
                      <Text className='squad-unboxing__sr-only'>{bubbleText}</Text>
                    </>
                  )}
                  <AIGCLabel
                    meta={groupAnalysis?.meta?.aigc}
                    className='squad-unboxing__analysis-bubble-aigc'
                    reduceMotion={shouldReduceMotion}
                  />
                  {/* 桌型诊断 (2026-07-24 P0/P2): group-level role mix, shown
                      only under the GROUP voice (tease/burst/soul) — hidden
                      while the bubble narrates a single member. Lives inside
                      the bubble footer to keep the vertical budget honest. */}
                  {tableDiagnosis.length > 0 && bubbleNarration?.kind !== 'member' ? (
                    <View
                      className='squad-unboxing__diagnosis'
                      aria-label={`这桌配置：${tableDiagnosis.map((segment) => `${segment.count}个${segment.label}`).join('，')}`}
                    >
                      <Text className='squad-unboxing__diagnosis-label'>这桌配置</Text>
                      <View className='squad-unboxing__diagnosis-chips'>
                        {tableDiagnosis.map((segment) => (
                          <View
                            key={segment.key}
                            className={`squad-unboxing__diagnosis-chip squad-unboxing__diagnosis-chip--${segment.key}`}
                          >
                            <Text className='squad-unboxing__diagnosis-chip-text'>
                              {`${segment.count}个${segment.label}`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            {/* 人→关系→场合 transition (2026-07-24 P2): once every card is
                face-up, one quiet line hands the story from the people to
                the occasion before the event card slides in. */}
            {allCardsUp ? (
              <View className='squad-unboxing__table-transition' aria-hidden='true'>
                <Text className='squad-unboxing__table-transition-text'>都认识了，就差一张桌子</Text>
              </View>
            ) : null}
            {/* 这桌的桌卡 (2026-07-24 P2): the collectible artifact + poster
                save. Persists on re-entry — the return hook. */}
            {allCardsUp && members.length > 0 ? (
              <SquadTableCard
                members={members}
                currentUserId={currentUserId}
                chemistryWord={tableCardChemistryWord}
                dateLine={tableCardDateLine}
                saving={tableCardSaving}
                onSave={handleSaveTableCard}
              />
            ) : null}
            {tonightsPanel}
          </>
        ) : null}
        </View>
      </View>
      </ScrollView>

      <View
        className={[
          'squad-unboxing__stage',
          `squad-unboxing__stage--${flowState}`,
          isComposedHeroActive ? 'squad-unboxing__stage--composed' : '',
          isDegradation ? 'squad-unboxing__stage--degradation' : '',
          settleBreath ? 'squad-unboxing__stage--breath' : '',
          // Pocketed phase hides the whole fixed stage (cards already sit at
          // the vanish point); visibility keeps React state + flip progress
          // alive so the re-fan restores exactly what the user had (AC-04).
          deckPhase === 'pocketed' ? 'squad-unboxing__stage--pocketed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={flowState === 'shaking' ? 'true' : undefined}
        aria-live={flowState === 'revealed' ? 'polite' : undefined}
        aria-atomic={flowState === 'revealed' ? 'true' : undefined}
      >
        {isComposedHeroActive ? (
          <XiaoyueHostImage groupId={groupId} shouldReduceMotion={shouldReduceMotion} />
        ) : null}
        {isStageTap ? (
          <View
            className='squad-unboxing__stage-tap-layer'
            onClick={() => handleOpenBox('box')}
            hoverClass='squad-unboxing__stage-tap-layer--pressed'
            role='button'
            aria-label={openBoxAriaLabel}
          />
        ) : null}
        {flowState !== 'revealed' ? (
          <View
            className={[
              'squad-unboxing__stage-body',
              flowState === 'ready' && !isStageTap ? 'squad-unboxing__stage-body--ready' : '',
              isStageTap ? 'squad-unboxing__stage-body--tap-target' : '',
            ].filter(Boolean).join(' ')}
            onClick={flowState === 'ready' && !isStageTap ? () => handleOpenBox('box') : undefined}
            hoverClass={flowState === 'ready' && !isStageTap ? 'squad-unboxing__stage-body--pressed' : ''}
            role={flowState === 'ready' && !isStageTap ? 'button' : undefined}
            aria-label={flowState === 'ready' && !isStageTap ? openBoxAriaLabel : undefined}
          >
            <BlindBoxVisual
              state={flowState === 'shaking' ? 'opening' : 'ready'}
            />
          </View>
        ) : null}
        {flowState === 'revealed' ? (
          <SquadDeckStage
            members={members}
            currentUserId={currentUserId}
            viewerPairByMemberId={viewerPairByMemberId}
            focusedIndex={focusedCardIndex}
            reduceMotion={shouldReduceMotion}
            isDegradation={isDegradation}
            resetSignal={resetSignal}
            flippedIds={flippedIds}
            flipDelayById={flipDelayById}
            bestPartnerUserId={bestPartnerUserId}
            allRevealed={!isInteractiveSession}
            interactive={isInteractiveSession}
            onDealSettled={notifyDealSettled}
            onCardTap={handleCardTap}
            onCardLongPress={handleCardLongPress}
            deckPhase={deckPhase}
            foldDelayById={foldDelayById}
            unfoldDelayById={unfoldDelayById}
            onFoldSettled={notifyFoldSettled}
            onUnfoldSettled={notifyUnfoldSettled}
            onArtLoad={handleCardArtLoad}
          />
        ) : null}
        {flowState !== 'revealed' ? (
          <View className='squad-unboxing__stage-lid'>
            <BlindBoxLid
              state={flowState === 'shaking' ? 'opening' : 'ready'}
            />
          </View>
        ) : null}
      </View>

      {/* Batch B handoff overlay: the opened box rises + fades for ~240ms
          above the revealed stage so the dealt fan reads as "cards coming
          OUT of the box". Never mounted on reduce-motion / degradation
          (the controller gates boxExiting), so no RM CSS is needed. */}
      {boxExiting ? (
        <View
          className={[
            'squad-unboxing__box-exit',
            // Composed hero uses the taller stage clamp — the overlay must
            // match or the box jumps at handoff (review CONCERN-1).
            isComposedHeroActive ? 'squad-unboxing__box-exit--composed' : '',
          ].filter(Boolean).join(' ')}
          aria-hidden='true'
        >
          <BlindBoxVisual state='open' />
          <View className='squad-unboxing__stage-lid'>
            <BlindBoxLid state='open' />
          </View>
        </View>
      ) : null}

      {/* Screen-reader announcements live at the PAGE ROOT (moved out of the
          stage 2026-07-15): the stage is visibility:hidden while pocketed,
          and assistive tech skips hidden subtrees — the 卡组已收起 beat must
          stay announceable (AC-09). */}
      {announcement ? (
        <View className='squad-unboxing__stage-announcement' role='status' aria-live='polite' aria-atomic='true'>
          {announcement}
        </View>
      ) : null}

      {/* Pocket-the-deck pill (AC-01/AC-03/AC-04): fixed at the page root —
          CSS sticky is WeChat-fragile inside <ScrollView>. Rendered while
          pocketed and through the unfold window (leaving fade). Pull-down or
          tap re-fans the deck. */}
      {flowState === 'revealed' && (deckPhase === 'pocketed' || deckPhase === 'unfolding') ? (
        <DeckCollapsePill
          model={pillStripModel}
          chemistryClassName={pillChemistryClass}
          leaving={deckPhase === 'unfolding'}
          reduceMotion={shouldReduceMotion}
          isDegradation={isDegradation}
          onReopen={reopenDeck}
        />
      ) : null}

      {/* One-time first-collapse Xiaoyue hint (AC-10): transient bubble
          anchored near the pill; auto-dismisses and never replays for this
          group (same storage flag as the `firstCollapse` property). */}
      {showPocketHint && deckPhase === 'pocketed' ? (
        <View className='squad-unboxing__pocket-hint' role='status'>
          <Image
            className='squad-unboxing__pocket-hint-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            aria-hidden='true'
          />
          <Text className='squad-unboxing__pocket-hint-text'>{SQUAD_DECK_POCKETED_HINT_TEXT}</Text>
        </View>
      ) : null}

      {flowState === 'revealed' && actionDockState === 'ready' ? (
        <View
          className={[
            'squad-unboxing__bottom-dock',
            headerReady ? 'squad-unboxing__bottom-dock--ready' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isInteractiveSession && unflippedCount > 0 && deckPhase === 'fan' && dealSettled ? (
            <View
              className='squad-unboxing__reveal-chip'
              hoverClass='squad-unboxing__reveal-chip--pressed'
              role='button'
              aria-label={buildRevealChipLabel(unflippedCount)}
              onClick={handleRevealAll}
            >
              <Text className='squad-unboxing__reveal-chip-text'>
                {buildRevealChipLabel(unflippedCount)}
              </Text>
            </View>
          ) : null}

          <View className='squad-unboxing__action-zone'>
            <Button
              className={[
                'squad-unboxing__confirm-btn',
                allCardsUp && !showSuccessOverlay ? 'squad-unboxing__confirm-btn--lit' : '',
              ].filter(Boolean).join(' ')}
              onClick={handleConfirmAttendance}
              disabled={isSubmitting || confirmAttendanceMutation.isPending || showSuccessOverlay}
              loading={isSubmitting || confirmAttendanceMutation.isPending}
            >
              {showSuccessOverlay ? '座位已锁定' : isSubmitting ? '确认中…' : allCardsUp ? '确认出席 · 锁定座位' : '确认出席'}
            </Button>
            {/* Return thread (2026-07-24 full-marks, user-sat angle 5): one
                quiet line seeding the post-event loop — the screen otherwise
                ends at the CTA with no pull back. */}
            {allCardsUp ? (
              <Text className='squad-unboxing__return-thread'>
                活动结束后，回来看看这桌的故事
              </Text>
            ) : null}

          </View>
        </View>
      ) : null}

      {showSuccessOverlay ? (
        <View className='squad-unboxing__success-overlay' role='status' aria-live='polite'>
          <View className='squad-unboxing__success-card'>
            <Image
              className='squad-unboxing__success-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('actionSuccess')}
              aria-hidden='true'
            />
            <Text className='squad-unboxing__success-title'>座位已锁定</Text>
            <Text className='squad-unboxing__success-subtitle'>解锁新羁绊 · 准备见面吧</Text>
          </View>
        </View>
      ) : null}

      {/* Hidden poster canvas (2026-07-24 P2): mounted only when the 桌卡 is
          available so low-end devices never hold the ~13MB bitmap (perf
          audit fix: degradation tier is excluded from the gate). */}
      {allCardsUp && members.length > 0 && !isDegradation && !posterSaved ? (
        <Canvas
          canvasId={SQUAD_TABLE_CARD_CANVAS_ID}
          style={{
            width: `${SQUAD_TABLE_CARD_POSTER_WIDTH}px`,
            height: `${SQUAD_TABLE_CARD_POSTER_HEIGHT}px`,
            position: 'fixed',
            left: '-9999px',
            top: 0,
          }}
          aria-hidden='true'
        />
      ) : null}
    </View>
  )
}
