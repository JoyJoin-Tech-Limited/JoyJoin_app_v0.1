import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { usePageTTI } from '../../hooks/usePageTTI'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import ChemistryBadge from '../../components/mascot/ChemistryBadge'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Card from '../../components/ui/Card'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import Button from '../../components/ui/Button'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../hooks/useAIGCLabelsEnabled'
import TypewriterText from '../../components/ui/TypewriterText'
import { haptics } from '../../lib/utils/haptics'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import { BlindBoxVisual } from './BlindBoxVisual'
import { BlindBoxLid } from './BlindBoxLid'
import DragRevealRibbon from './DragRevealRibbon'
import XiaoyueHostImage from './XiaoyueHostImage'
import SquadDeckStage from './SquadDeckStage'
import {
  buildEventBriefDate,
  buildFocusedMemberBubbleText,
  buildRevealChipLabel,
  buildSquadSoulBubbleText,
  getChemistryWord,
  getEventTypeLabel,
  getMemberName,
  getPairChemistryWord,
  getVibeLabel,
  resolveCardFocusInteraction,
  SQUAD_BURST_COMPLETION_BUBBLE_TEXT,
  SQUAD_SELF_CARD_BUBBLE_TEXT,
  SQUAD_TEASE_BUBBLE_TEXT,
  stripConnectionPointParens,
} from './squadUnboxingViewModels'
import { scheduleFlipSettleNarration } from './squadFlipState'
import { getOracleCardCornerAsset } from '../../components/discover/oracleCardAssets'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { preloadImagesWithDiagnostics } from '../../lib/utils/imagePreload'

import { useSquadUnboxingController } from './useSquadUnboxingController'
import './index.scss'

const SCROLL_DEPTH_BUCKETS = ['tonights_table', 'connection_story', 'actions'] as const

type ScrollDepthBucket = typeof SCROLL_DEPTH_BUCKETS[number]

function useScrollDepthTracking(groupId: string) {
  const reportedRef = useRef<Set<ScrollDepthBucket>>(new Set())

  // New group (or re-entry with a different id) re-arms the buckets so depth
  // is reported once per group, not once per page lifetime.
  useEffect(() => {
    reportedRef.current = new Set()
  }, [groupId])

  const reportDepth = useCallback((bucket: ScrollDepthBucket) => {
    if (reportedRef.current.has(bucket)) return
    reportedRef.current.add(bucket)
    squadUnboxingAnalytics.track('squad_unboxing_scroll_depth', {
      groupId,
      screen: 'squad-unboxing',
      bucket,
    })
  }, [groupId])

  return reportDepth
}

function getPageTitle(eventType?: string | null): string {
  if (eventType === 'bar') return '你的酒局桌友来了'
  if (eventType === 'dining') return '你的饭局桌友来了'
  return '你的桌友来了'
}

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
    isLoadingAnalysis,
    analysisError,
    chemistryTokens,
    sortedPairExplanations,
    pairKeyMemberMap,
    viewerPairs,
    viewerPairByMemberId,
    groupThemeHighlights,
    analysisThemeTags,
    flowState,
    isAnalysisExpanded,
    setIsAnalysisExpanded,
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
    handleOpenBox,
    handleConfirmAttendance,
    handleOpenGroupDetail,
    handleSharePosterTap,
    handleSkip,
    refetch,
    refetchAnalysis,
  } = useSquadUnboxingController({ groupId, routerParams: router.params })

  const { isDegradation } = useDeviceTier()
  // B5: TTI instrumentation — ready once the auth gate and group fetch settle.
  usePageTTI({ pageName: 'squad-unboxing', ready: !authLoading && !isLoading })
  const { user: currentUser } = useAuthGuard()
  const aigcEnabled = useAIGCLabelsEnabled()
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

  const reportScrollDepth = useScrollDepthTracking(groupId)

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

    // First flip of a card is by definition unseen — animate the narration
    // when it lands after flip-end (resolver semantics for later re-taps).
    const current = focusedCardIndexRef.current
    flipOne(member.userId, 'tap')
    seenMemberNarrationsRef.current.add(member.userId)
    animateFocusedNarrationRef.current = true
    setAnimateFocusedNarration(true)
    focusedCardIndexRef.current = index
    setFocusedCardIndex(index)
    if (!instant && haptic !== 'none') haptics('light')
    trackCardFocus(index, current)
    cancelNarrationTimer()
    if (instant) {
      setBubbleNarration({ kind: 'member', userId: member.userId })
    } else {
      narrationCancelRef.current = scheduleFlipSettleNarration(
        { setTimer: (cb, ms) => setTimeout(cb, ms), clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) },
        () => {
          narrationCancelRef.current = null
          setBubbleNarration({ kind: 'member', userId: member.userId })
        },
      )
    }
  }, [
    members,
    isFlipInFlight,
    shouldReduceMotion,
    isDegradation,
    isInteractiveSession,
    flippedIds,
    flipOne,
    trackCardFocus,
    cancelNarrationTimer,
    handleCardFocus,
  ])

  const handleCardLongPress = useCallback((index: number) => {
    // Long-press = the same one-step beat; the card's own trailing-tap guard
    // swallows the release tap so nothing double-fires (AC-12).
    handleCardTap(index, 'none')
  }, [handleCardTap])

  /**
   * Hint-chip reveal-all (AC-05): staggered flip burst with NO per-card focus
   * chrome and NO per-card narration swaps. Any active focus is cleared
   * BEFORE the burst; on completion the bubble shows one group-level line.
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
  ])

  const handleAnalysisRetry = useCallback(() => {
    squadUnboxingAnalytics.track('squad_unboxing_analysis_retry_tap', {
      groupId,
      screen: 'squad-unboxing',
    })
    void refetchAnalysis()
  }, [groupId, refetchAnalysis])

  const toggleAnalysis = useCallback(() => {
    setIsAnalysisExpanded((prev) => {
      const next = !prev
      squadUnboxingAnalytics.track(
        next ? 'squad_unboxing_connection_story_expand' : 'squad_unboxing_connection_story_collapse',
        { groupId, screen: 'squad-unboxing' },
      )
      return next
    })
    haptics('light')
  }, [groupId, setIsAnalysisExpanded])

  const focusedMember = members[focusedCardIndex] ?? null
  const focusedViewerPair = focusedMember
    ? (viewerPairByMemberId.get(focusedMember.userId) ?? null)
    : null
  // Bubble voice: burst-completion line > focused-member narration (only when
  // the narration matches the currently focused card — a pending flip keeps
  // the resting voice until flip-end) > resting voice. While face-down cards
  // remain in an interactive session the resting voice is the tease line (C1);
  // the soul line is earned once every card is face-up.
  const bubbleText = bubbleNarration?.kind === 'burst'
    ? SQUAD_BURST_COMPLETION_BUBBLE_TEXT
    : bubbleNarration?.kind === 'member' && focusedMember && bubbleNarration.userId === focusedMember.userId
      ? focusedMember.userId === currentUserId
        ? SQUAD_SELF_CARD_BUBBLE_TEXT
        : buildFocusedMemberBubbleText(
          getMemberName(focusedMember),
          normalizeMatchingCopy(focusedViewerPair?.explanation),
          focusedViewerPair?.connectionPoints ?? [],
          focusedViewerPair?.introAngle,
          focusedMember,
        )
      : isInteractiveSession && unflippedCount > 0
        ? SQUAD_TEASE_BUBBLE_TEXT
        : buildSquadSoulBubbleText(
          archetypeMixCopy,
          groupAnalysis?.groupThemeCompanion || matchExplanationCopy,
          groupAnalysis?.groupDynamics,
        )

  // Event-brief card: structured date block + shared OracleCard corner vignette.
  const briefDate = buildEventBriefDate(group?.finalDateTime ?? pool?.dateTime)
  const briefVignetteSrc = getOracleCardCornerAsset(pool?.eventType ?? undefined)

  // Warm the fan's archetype art during the reveal so cards never paint blank
  // frames on 4G (skeleton covers first paint; this shrinks the decode gap).
  useEffect(() => {
    if (flowState !== 'revealed' || members.length === 0) return
    const urls = members
      .slice(0, 8)
      .map((member) => (member.archetype ? ARCHETYPE_ASSET_MAP[member.archetype]?.webp : undefined))
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

  const handleScroll = useCallback((event: { detail?: { scrollTop?: number; scrollHeight?: number } }) => {
    const scrollTop = event.detail?.scrollTop ?? 0
    if (scrollTop > 120) reportScrollDepth('tonights_table')
    if (scrollTop > 320) reportScrollDepth('connection_story')
    if (scrollTop > 520) reportScrollDepth('actions')
  }, [reportScrollDepth])

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

  const legacyHeader = (
    <View className={['squad-unboxing__header', headerReady ? 'squad-unboxing__header--ready' : ''].filter(Boolean).join(' ')}>
      <Image
        className='squad-unboxing__header-mascot'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset('homeWelcome')}
        ariaLabel='欢迎'
      />
      <Text className='squad-unboxing__header-title'>
        {getPageTitle(pool.eventType)}
      </Text>
      <Text className='squad-unboxing__header-tagline'>
        {matchExplanationCopy || `${DEFAULT_MASCOT_DISPLAY_NAME}已经把拼图聚齐，准备让你看看今晚会和谁同桌。`}
      </Text>
      <View className='squad-unboxing__header-meta'>
        {group.groupNumber ? (
          <Text className='squad-unboxing__header-group-num'>第 {group.groupNumber} 组</Text>
        ) : null}
        {/* Chemistry signal renders once in revealed state — the chapter badge
            below ("今晚这桌") owns it; the header pill was removed as a dup. */}
      </View>
    </View>
  )

  const composedReadyHeader = (
    <View className={['squad-unboxing__hero-copy', headerReady ? 'squad-unboxing__hero-copy--ready' : ''].filter(Boolean).join(' ')}>
      {group.groupNumber ? (
        <Text className='squad-unboxing__hero-eyebrow'>第 {group.groupNumber} 组</Text>
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
        aria-label='轻点打开礼盒，查看今晚的同桌'
      >
        <Text className='squad-unboxing__hero-gesture-text'>轻点打开</Text>
      </View>
    </View>
  )

  // The mascot + tagline header is retired in the revealed state — the slim
  // fixed title bar (below) owns it there; Xiaoyue lives in the 团魂 bubble.
  const header = flowState === 'revealed'
    ? null
    : composedHeroEnabled && flowState === 'ready'
      ? composedReadyHeader
      : composedHeroEnabled && flowState === 'shaking'
        ? null
        : legacyHeader

  return (
    <View className={pageClassName}>
      <ScrollView
        className={['squad-unboxing__scroll', flowState === 'revealed' ? 'squad-unboxing__scroll--revealed' : ''].filter(Boolean).join(' ')}
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={handleScroll}
      >
        <View className='squad-unboxing__scroll-inner'>
          <View className={[
            'squad-unboxing__stage-spacer',
            flowState === 'revealed' ? 'squad-unboxing__stage-spacer--revealed' : '',
            isComposedHeroActive ? 'squad-unboxing__stage-spacer--composed' : '',
          ].filter(Boolean).join(' ')} />

          <View className={[
            'squad-unboxing__scroll-content',
            flowState === 'revealed' ? '' : 'squad-unboxing__scroll-content--ready',
            isComposedHeroActive ? 'squad-unboxing__scroll-content--composed' : '',
          ].filter(Boolean).join(' ')}>

        {flowState === 'ready' && !composedHeroEnabled ? (
          <View className='squad-unboxing__ribbon-wrap'>
            <DragRevealRibbon
              shouldReduceMotion={shouldReduceMotion}
              isDegradation={isDegradation}
              enabled={dragRevealEnabled}
              onReveal={() => handleOpenBox('ribbon')}
            />
          </View>
        ) : null}

        {header}


        {flowState === 'ready' && !composedHeroEnabled ? (
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--copy-only'>
            <Text className='squad-unboxing__blind-box-title'>拼图已经聚齐</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              上一页的每一块拼图，都会在这里变成一个真实的队友。轻点打开，看看是谁和你坐在同一桌。
            </Text>
            {group.theme || group.themeEmoji ? (
              <View className='squad-unboxing__blind-box-theme-pill'>
                {group.themeEmoji ? (
                  <JoyJoinIcon emoji={group.themeEmoji} size={28} className='squad-unboxing__blind-box-theme-icon' />
                ) : null}
                <Text className='squad-unboxing__blind-box-theme-text'>
                  {group.theme || '今晚成桌'}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {flowState === 'shaking' ? (
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--copy-only squad-unboxing__blind-box-card--shaking'>
            <Text className='squad-unboxing__blind-box-title'>盒子正在打开…</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              {`${DEFAULT_MASCOT_DISPLAY_NAME}正在把盒盖掀开，把今晚最值得期待的那一页翻给你看。`}
            </Text>
          </Card>
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
                  headerReady ? 'squad-unboxing__analysis-bubble-inner--ready' : '',
                ].filter(Boolean).join(' ')}
              >
                <Image
                  className={['squad-unboxing__analysis-bubble-mascot', headerReady ? 'squad-unboxing__analysis-bubble-mascot--ready' : ''].filter(Boolean).join(' ')}
                  mode='aspectFit'
                  src={getXiaoyueExpressionAsset('matchSuccess')}
                  aria-hidden='true'
                />
                <View className='squad-unboxing__analysis-bubble-bubble'>
                  <View aria-hidden='true'>
                    <TypewriterText
                      className='squad-unboxing__analysis-bubble-text'
                      text={bubbleText}
                      speed={45}
                      delay={180}
                      maxDuration={bubbleNarration?.kind === 'member' ? undefined : 3000}
                      enabled={!shouldReduceMotion && !isDegradation && (bubbleNarration?.kind !== 'member' || animateFocusedNarration)}
                      showCursor={false}
                      onComplete={() => {
                        squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                          groupId,
                          screen: 'squad-unboxing',
                        })
                      }}
                    />
                  </View>
                  <Text className='squad-unboxing__sr-only'>{bubbleText}</Text>
                  <AIGCLabel
                    meta={groupAnalysis?.meta?.aigc}
                    className='squad-unboxing__analysis-bubble-aigc'
                    reduceMotion={shouldReduceMotion}
                  />
                </View>
              </View>
            </View>

            <View className={[
              'squad-unboxing__chapter',
              'squad-unboxing__chapter--meta',
              headerReady ? 'squad-unboxing__chapter--ready' : '',
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
                  <View className='squad-unboxing__brief-type-pill'>
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

            {groupAnalysis && false ? <View className='squad-unboxing__chapter squad-unboxing__chapter--analysis'>
              <View
                className='squad-unboxing__expand-header'
                onClick={toggleAnalysis}
                hoverClass='squad-unboxing__expand-header--pressed'
                role='button'
                aria-expanded={isAnalysisExpanded}
                aria-label={isAnalysisExpanded ? '收起连接解读' : '展开连接解读'}
              >
                <View className='squad-unboxing__expand-title-group'>
                  <Text className='squad-unboxing__chapter-title'>连接解读</Text>
                  <Text className='squad-unboxing__expand-subtitle'>悦仔怎么看这桌的化学反应</Text>
                </View>
                <View
                  className={[
                    'squad-unboxing__expand-chevron',
                    isAnalysisExpanded ? 'squad-unboxing__expand-chevron--open' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden='true'
                />
              </View>

              {isAnalysisExpanded ? (
                <View className={[
                  'squad-unboxing__expand-body',
                  isAnalysisExpanded ? 'squad-unboxing__expand-body--open' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                >
                  <View className='squad-unboxing__analysis-section squad-unboxing__analysis-section--chemistry'>
                    <Text className='squad-unboxing__analysis-section-title'>这桌的火花</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton squad-unboxing__skeleton--banner' />
                    ) : (
                      <>
                        <View className={`squad-unboxing__chemistry-chip ${chemistryTokens.chipClassName}`}>
                          <ChemistryBadge
                            chemistry={chemistryTokens.iconRef}
                            size={28}
                            className='squad-unboxing__chemistry-emoji'
                          />
                          <Text className='squad-unboxing__chemistry-title'>{chemistryTokens.title}</Text>
                        </View>
                        <Text className='squad-unboxing__analysis-text'>{chemistryTokens.description}</Text>
                      </>
                    )}
                  </View>

                  <View className='squad-unboxing__analysis-section'>
                    <Text className='squad-unboxing__analysis-section-title'>整体氛围</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line' />
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line squad-unboxing__skeleton--line-short' />
                      </View>
                    ) : analysisError ? (
                      <View className='squad-unboxing__analysis-retry'>
                        <Text className='squad-unboxing__analysis-retry-text'>
                          连接解读加载失败了，重试一下让悦仔再帮你分析
                        </Text>
                        <Button
                          variant='secondary'
                          className='squad-unboxing__analysis-retry-btn'
                          onClick={handleAnalysisRetry}
                        >
                          重试
                        </Button>
                      </View>
                    ) : groupAnalysis ? (
                      <>
                        {analysisThemeTags.length > 0 ? (
                          <View className='squad-unboxing__tag-row'>
                            {analysisThemeTags.map((tag) => (
                              <View key={tag} className='squad-unboxing__tag-chip'>
                                <Text className='squad-unboxing__tag-chip-text'>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {groupAnalysis!.groupThemeCompanion ? (
                          <Text className='squad-unboxing__analysis-text'>
                            {groupAnalysis!.groupThemeCompanion}
                          </Text>
                        ) : null}
                        <Text className='squad-unboxing__analysis-text'>{groupAnalysis!.groupDynamics}</Text>
                        <GroupAnalysisSourceHint analysis={groupAnalysis!} />
                        <AIGCLabel
                          meta={groupAnalysis!.meta?.aigc}
                          className='squad-unboxing__analysis-aigc-label'
                          reduceMotion={shouldReduceMotion}
                        />
                      </>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>{matchExplanationCopy}</Text>
                    )}
                  </View>

                  <View className='squad-unboxing__analysis-section'>
                    <Text className='squad-unboxing__analysis-section-title'>你最容易从哪里聊开？</Text>
                    <AIGCLabel
                      meta={groupAnalysis?.meta?.aigc}
                      className='squad-unboxing__analysis-aigc-label'
                      reduceMotion={shouldReduceMotion}
                    />
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        {[0, 1].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--pair' />
                        ))}
                      </View>
                    ) : viewerPairs.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {viewerPairs.slice(0, 2).map((pair, pairIndex) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const otherMember = pairMembers?.find((member) => member.userId !== currentUserId)
                          const pairLabel = otherMember
                            ? `你 × ${getMemberName(otherMember)}`
                            : pairMembers
                              ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                              : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className={[
                                'squad-unboxing__pair-card',
                                headerReady ? 'squad-unboxing__pair-card--ready' : '',
                              ].filter(Boolean).join(' ')}
                              style={{
                                transitionDelay: headerReady ? `${pairIndex * 80}ms` : '0ms',
                              }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{getPairChemistryWord(pair.chemistryScore)}</Text>
                              </View>
                              {(pair.connectionPointsWithRarity?.length ?? pair.connectionPoints.length) > 0 ? (
                                <View className='squad-unboxing__pair-pill-row'>
                                  {(pair.connectionPointsWithRarity ?? pair.connectionPoints.slice(0, 3).map((text) => ({ text, rarity: 'common' as const }))).slice(0, 3).map((point) => (
                                    <ConnectionPointPill key={point.text} text={stripConnectionPointParens(point.text)} rarity={point.rarity} />
                                  ))}
                                </View>
                              ) : null}
                              <Text className='squad-unboxing__pair-copy'>{normalizeMatchingCopy(pair.explanation)}</Text>
                              {pair.introAngle ? (
                                <Text className='squad-unboxing__pair-intro'>开场：{pair.introAngle}</Text>
                              ) : null}
                            </View>
                          )
                        })}
                      </View>
                    ) : sortedPairExplanations.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {sortedPairExplanations.slice(0, 2).map((pair, pairIndex) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const pairLabel = pairMembers
                            ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                            : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className={[
                                'squad-unboxing__pair-card',
                                headerReady ? 'squad-unboxing__pair-card--ready' : '',
                              ].filter(Boolean).join(' ')}
                              style={{
                                transitionDelay: headerReady ? `${pairIndex * 80}ms` : '0ms',
                              }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{getPairChemistryWord(pair.chemistryScore)}</Text>
                              </View>
                              <Text className='squad-unboxing__pair-copy'>{normalizeMatchingCopy(pair.explanation)}</Text>
                              {pair.introAngle ? (
                                <Text className='squad-unboxing__pair-intro'>开场：{pair.introAngle}</Text>
                              ) : null}
                            </View>
                          )
                        })}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        {matchExplanationCopy || '这桌有不少潜在共同点，见面后会更快找到节奏。'}
                      </Text>
                    )}
                  </View>

                  <View className='squad-unboxing__analysis-section squad-unboxing__analysis-section--last'>
                    <Text className='squad-unboxing__analysis-section-title'>今晚聊什么？</Text>
                    <AIGCLabel
                      meta={groupAnalysis?.meta?.aigc}
                      className='squad-unboxing__analysis-aigc-label'
                      reduceMotion={shouldReduceMotion}
                    />
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__topic-row'>
                        {[0, 1, 2].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--topic' />
                        ))}
                      </View>
                    ) : groupAnalysis?.iceBreakers && groupAnalysis!.iceBreakers.length > 0 ? (
                      <View className='squad-unboxing__topic-row'>
                        {groupAnalysis!.iceBreakers.map((topic, index) => (
                          <View
                            key={`${topic}-${index}`}
                            className={[
                              'squad-unboxing__topic-chip',
                              headerReady ? 'squad-unboxing__topic-chip--ready' : '',
                            ].filter(Boolean).join(' ')}
                            style={{
                              transitionDelay: headerReady ? `${index * 60}ms` : '0ms',
                            }}
                          >
                            <Text className='squad-unboxing__topic-chip-text'>{topic}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        先从彼此最近最上头的一件事聊起，通常都能很快破冰。
                      </Text>
                    )}
                  </View>

                  {aigcEnabled && groupAnalysis?.meta?.aigc?.aiGenerated ? (
                    <View className='squad-unboxing__analysis-report-wrap'>
                      <AIContentReportButton
                        options={{
                          reason: '举报 AI 生成的连接解读内容',
                          relatedEventId: groupId,
                        }}
                        label='举报此内容'
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View> : null}
            <View className='squad-unboxing__spacer' />
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
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={flowState === 'shaking' ? 'true' : undefined}
        aria-live={flowState === 'revealed' ? 'polite' : undefined}
        aria-atomic={flowState === 'revealed' ? 'true' : undefined}
      >
        {announcement ? (
          <View className='squad-unboxing__stage-announcement' role='status' aria-live='polite' aria-atomic='true'>
            {announcement}
          </View>
        ) : null}
        {isComposedHeroActive ? (
          <XiaoyueHostImage groupId={groupId} shouldReduceMotion={shouldReduceMotion} />
        ) : null}
        {isStageTap ? (
          <View
            className='squad-unboxing__stage-tap-layer'
            onClick={() => handleOpenBox('box')}
            hoverClass='squad-unboxing__stage-tap-layer--pressed'
            role='button'
            aria-label='轻点打开礼盒，查看今晚的同桌'
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
            aria-label={flowState === 'ready' && !isStageTap ? '轻点打开礼盒，查看今晚的同桌' : undefined}
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

      {flowState === 'revealed' && actionDockState === 'ready' ? (
        <View
          className={[
            'squad-unboxing__bottom-dock',
            headerReady ? 'squad-unboxing__bottom-dock--ready' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* Hint chip (AC-04): progress slot — live unflipped count with an
              explicit tap verb; doubles as the reveal-all trigger (AC-05).
              Absent when N=0 and on all-up re-entry. Separate visual slot
              from the bubble (chip = progress, bubble = voice). */}
          {isInteractiveSession && unflippedCount > 0 ? (
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
              className='squad-unboxing__confirm-btn'
              onClick={handleConfirmAttendance}
              disabled={isSubmitting || confirmAttendanceMutation.isPending || showSuccessOverlay}
              loading={isSubmitting || confirmAttendanceMutation.isPending}
            >
              {showSuccessOverlay ? '座位已锁定' : isSubmitting ? '确认中…' : '确认出席'}
            </Button>

            <View className='squad-unboxing__action-row'>
              <Button
                variant='secondary'
                className='squad-unboxing__share-btn'
                onClick={handleSharePosterTap}
                disabled={showSuccessOverlay}
              >
                截图保存记忆
              </Button>

              <Button
                variant='secondary'
                className='squad-unboxing__detail-btn'
                onClick={handleOpenGroupDetail}
                disabled={showSuccessOverlay}
              >
                查看活动详情
              </Button>
            </View>

            <View
              className='squad-unboxing__skip-link'
              hoverClass='squad-unboxing__skip-link--pressed'
              onClick={handleSkip}
              role='button'
              aria-label='稍后再看'
            >
              <Text>稍后再看</Text>
            </View>
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
    </View>
  )
}
