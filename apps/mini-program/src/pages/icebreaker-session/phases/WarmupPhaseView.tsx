import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import type { AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import type { VibeId } from '../../../lib/vibeMapping'
import { WarmupWelcomeBand } from '../components/WarmupWelcomeBand'
import { WarmupCardSlot } from '../components/WarmupCardSlot'
import { WarmupPresenceStrip } from '../components/WarmupPresenceStrip'
import { WarmupActionBar } from '../components/WarmupActionBar'
import { WarmupCelebrationOverlay } from '../components/WarmupCelebrationOverlay'
import { GyroParallaxSpike } from '../spike/GyroParallaxSpike'
import { HandshakeRitual } from '../components/HandshakeRitual'
import { GlancePeek } from '../components/GlancePeek'
import { isHandshakeRitualGateOpen } from '../viewModels/glanceStackModel'
import type { SessionParticipant } from '../phaseUtils'
import {
  buildWelcomeSegments,
  buildWarmupCaption,
  buildCelebrationLine,
  buildCTAState,
  getWarmupCardState,
  buildArchetypeMixText,
} from '../viewModels/warmupViewModels'
import type { TopicsRecoveryState, WarmupCardState } from '../viewModels/warmupViewModels'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

interface WarmupPhaseViewProps {
  topics: SocialTopic[]
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  selectedMood?: AtmosphereMood
  isHost: boolean
  vibe?: VibeId
  archetypeMixText?: string
  isCustomMode?: boolean
  currentTier?: TierMachineId
  isTestMode?: boolean
  runBots?: boolean
  warmupTopicsMeta?: AIResponseMeta
  socialSessionId?: string
  icebreakerSessionId?: string
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleReady: () => void
  onNextTopic: () => void
  onAdvance: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
  isAdvancing: boolean
  topicsError?: boolean
  /** Transient-failure auto-retry state (backoff ladder) — renders recovery copy. */
  topicsRecovery?: TopicsRecoveryState | null
  onAigcFeedbackTap?: (location: 'card') => void
  /**
   * C3 — true once the first ready-state payload has arrived; threaded to
   * the ember rim so seeding never races an unresolved query. Defaults true.
   */
  warmupDataReady?: boolean
  /** Shared advance status/prompt, placed directly below the topic card. */
  advancePrompt?: ReactNode
  /** S3 glance-stack pilot (flag-gated): ritual gate + L3 demotions. */
  glanceStackEnabled?: boolean
  /** S8: fired once when the host's ritual tap ends the opening — the page
   *  fires the first Nudge (S1 grammar) alongside. */
  onRitualStart?: () => void
}

export function WarmupPhaseView({
  topics,
  currentIndex,
  readyUserIds,
  participants,
  currentUserId,
  selectedMood,
  isHost,
  vibe,
  archetypeMixText: propArchetypeMixText,
  isCustomMode = false,
  currentTier = 'glow',
  isTestMode = false,
  runBots = false,
  warmupTopicsMeta,
  socialSessionId,
  icebreakerSessionId,
  onGenerateTopics,
  onToggleReady,
  onNextTopic,
  onAdvance,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
  isAdvancing,
  topicsError = false,
  topicsRecovery = null,
  onAigcFeedbackTap,
  warmupDataReady = true,
  advancePrompt,
  glanceStackEnabled = false,
  onRitualStart,
}: WarmupPhaseViewProps) {
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const isLastTopic = currentIndex >= Math.max(topics.length - 1, 0)

  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  const fallbackMixText = useMemo(() => buildArchetypeMixText(participants), [participants])
  const archetypeMixText = propArchetypeMixText ?? fallbackMixText
  const welcomeSegments = useMemo(
    () => buildWelcomeSegments(participants, undefined),
    [participants],
  )
  const caption = useMemo(
    () => buildWarmupCaption(vibe, currentTier, isCustomMode),
    [vibe, currentTier, isCustomMode],
  )
  const cardState = useMemo<WarmupCardState>(
    () =>
      getWarmupCardState({
        topics,
        currentIndex,
        isHost,
        isGeneratingTopics,
        topicsError,
        topicsRecovery,
      }),
    [topics, currentIndex, isHost, isGeneratingTopics, topicsError, topicsRecovery],
  )

  // ── Analytics: mount view ──────────────────────────────────────
  const hasTrackedViewRef = useRef(false)
  useEffect(() => {
    if (hasTrackedViewRef.current) return
    hasTrackedViewRef.current = true
    socialIcebreakerAnalytics.track(
      'warmup_entry_view',
      socialSessionId,
      icebreakerSessionId,
      'warmup',
      {
        playerCount: participants.length,
        isHost,
        vibe: vibe ?? '',
        tier: currentTier,
      },
    )
  }, [socialSessionId, icebreakerSessionId, participants.length, isHost, vibe, currentTier])

  // ── TTC timing for ready tap ───────────────────────────────────
  const componentMountAtRef = useRef(Date.now())
  const firstTopicRenderedAtRef = useRef<number | null>(null)
  useEffect(() => {
    if (cardState === 'topic_card' && firstTopicRenderedAtRef.current === null) {
      firstTopicRenderedAtRef.current = Date.now()
    }
  }, [cardState])

  // Campfire Vault Card PR2 (S1) — the optimistic self ember hands off to
  // server truth: cleared when the echo confirms, rolled back (quiet S4 fade
  // inside the rim) when the update settles without confirmation.
  const [selfReadyOptimistic, setSelfReadyOptimistic] = useState(false)
  useEffect(() => {
    if (!selfReadyOptimistic) return
    // Clear when the server confirms (isReady), and also when no ready
    // request is actually in flight — covers the skipped-tap path where
    // pendingAction never changed and the optimistic flag would otherwise
    // stick forever (deps wouldn't re-fire without selfReadyOptimistic).
    if (isReady || !isUpdatingReady) {
      setSelfReadyOptimistic(false)
    }
  }, [isReady, isUpdatingReady, selfReadyOptimistic])

  // P0-4 (2026-07-26): optimistic ready morph — the CTA flips to the calm
  // "已准备" state at tap time instead of showing a spinner while the
  // request is in flight. Rollback is the effect above + the warm toast
  // from the page handler.
  const effectiveIsReady = isReady || selfReadyOptimistic
  const effectiveEveryoneReady =
    everyoneReady ||
    (selfReadyOptimistic && !isReady && readyUserIds.length + 1 >= participants.length)
  const ctaState = useMemo(
    () => buildCTAState(effectiveIsReady, isHost, effectiveEveryoneReady, isLastTopic),
    [effectiveIsReady, isHost, effectiveEveryoneReady, isLastTopic],
  )

  // S1 companion — the count mirrors the optimistic self ember so the ready
  // tally responds to the tap immediately instead of waiting for the server
  // echo (previously the button spun for seconds with a frozen count).
  const optimisticReadyCount =
    selfReadyOptimistic && !readyUserIds.includes(currentUserId)
      ? readyUserIds.length + 1
      : readyUserIds.length

  const handleToggleReady = useCallback(() => {
    const ttcMs = Date.now() - (firstTopicRenderedAtRef.current ?? componentMountAtRef.current)
    socialIcebreakerAnalytics.track(
      'warmup_ready_tap',
      socialSessionId,
      icebreakerSessionId,
      'warmup',
      {
        ttcMs,
        isHost,
        fromReady: isReady,
        playerCount: participants.length,
        readyCount: readyUserIds.length,
      },
    )
    // S1 — self ember ignites optimistically on tap (no server wait); the
    // haptics('medium') for this tap already lives in WarmupActionBar.
    setSelfReadyOptimistic(!isReady)
    onToggleReady()
  }, [
    onToggleReady,
    isReady,
    isHost,
    participants.length,
    readyUserIds.length,
    socialSessionId,
    icebreakerSessionId,
  ])

  // ── Topic card flip animation ────────────────────────────────
  const [topicFlipped, setTopicFlipped] = useState(false)
  const [topicEntering, setTopicEntering] = useState(false)
  const prevIndexRef = useRef(currentIndex)
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (cardState !== 'topic_card') {
      setTopicFlipped(false)
      setTopicEntering(false)
      return
    }

    const indexChanged = currentIndex !== prevIndexRef.current
    prevIndexRef.current = currentIndex

    // C5 — quiet topic change: when the card is already showing the topic
    // face, a bare index change must NOT re-flip to the front (the 500ms
    // flip would hide the 360ms question crossfade on the back face).
    // Re-flips are preserved for state transitions INTO topic_card
    // (mood-regenerate / error recovery reset topicFlipped above).
    if (indexChanged && topicFlipped) {
      return
    }

    if (indexChanged || !topicFlipped) {
      setTopicFlipped(false)
      setTopicEntering(true)
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current)
      flipTimerRef.current = setTimeout(() => {
        setTopicEntering(false)
        setTopicFlipped(true)
        haptics('light')
      }, 200)
    }

    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current)
        flipTimerRef.current = undefined
      }
    }
  }, [cardState, currentIndex, topicFlipped])

  // ── Deep prompt auto-expand (once per session) ─────────────────
  const [deepPromptExpanded, setDeepPromptExpanded] = useState(false)
  const deepPromptTeachingFiredRef = useRef(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (
      !topicFlipped ||
      deepPromptTeachingFiredRef.current ||
      deepPromptExpanded ||
      vibe !== 'deep_chat'
    ) {
      return
    }
    deepPromptTeachingFiredRef.current = true
    expandTimerRef.current = setTimeout(() => {
      setDeepPromptExpanded(true)
      socialIcebreakerAnalytics.track(
        'warmup_deep_prompt_expand',
        socialSessionId,
        icebreakerSessionId,
        'warmup',
        { trigger: 'teaching', auto: true, vibe: 'deep_chat' },
      )
    }, 400)

    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current)
        expandTimerRef.current = undefined
      }
    }
  }, [topicFlipped, deepPromptExpanded, vibe, socialSessionId, icebreakerSessionId])

  const handleToggleDeepPrompt = useCallback(() => {
    setDeepPromptExpanded((prev) => {
      const next = !prev
      if (next) {
        socialIcebreakerAnalytics.track(
          'warmup_deep_prompt_expand',
          socialSessionId,
          icebreakerSessionId,
          'warmup',
          { trigger: 'tap', auto: false, vibe: vibe ?? '' },
        )
      }
      return next
    })
  }, [socialSessionId, icebreakerSessionId, vibe])

  // ── Everyone-ready celebration overlay ─────────────────────────
  const [showCelebration, setShowCelebration] = useState(false)
  const prevEveryoneReadyRef = useRef(false)
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (everyoneReady && !prevEveryoneReadyRef.current && participants.length >= 2) {
      setShowCelebration(true)
      haptics('success')
      socialIcebreakerAnalytics.track(
        'warmup_celebration_shown',
        socialSessionId,
        icebreakerSessionId,
        'warmup',
        { playerCount: participants.length, mix: archetypeMixText },
      )
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = setTimeout(() => setShowCelebration(false), 2500)
    }
    prevEveryoneReadyRef.current = everyoneReady
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = undefined
      }
    }
  }, [everyoneReady, participants.length, archetypeMixText, socialSessionId, icebreakerSessionId])

  // ── Swipe-back safety: reset transient flags on re-show ───────
  const resetDeepPromptTeaching = useCallback((_: boolean) => {
    deepPromptTeachingFiredRef.current = false
  }, [])
  useResetOnShow(setShowCelebration, setDeepPromptExpanded, resetDeepPromptTeaching)

  // ── Handlers ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (selectedMood) {
      onGenerateTopics(selectedMood)
    }
  }, [selectedMood, onGenerateTopics])

  const handleAigcFeedback = useCallback(() => {
    onAigcFeedbackTap?.('card')
  }, [onAigcFeedbackTap])

  const showActionBar = cardState === 'topic_card'
  const celebrationLine = buildCelebrationLine(archetypeMixText)
  const hostUserId = participants.find((p) => p.isHost)?.userId ?? currentUserId

  // ── S8 Handshake Bridge (glance pilot) ─────────────────────────
  // The session's first content gates on the spoken ritual: the host's
  // single touch ends it locally; other devices release on the
  // poll-observed start signal (topics / generating / selectedMood). A
  // rejoining device (topics already dealt) never sees the ritual.
  const [ritualDoneLocal, setRitualDoneLocal] = useState(false)
  const ritualGateOpen =
    glanceStackEnabled &&
    !ritualDoneLocal &&
    isHandshakeRitualGateOpen({
      topicCount: topics.length,
      warmupTopicsStatus: isGeneratingTopics ? 'generating' : undefined,
      topicsError,
      selectedMood,
    })
  const handleRitualStart = useCallback(() => {
    setRitualDoneLocal(true)
    onRitualStart?.()
  }, [onRitualStart])

  return (
    <View className='icebreaker__warmup'>
      {isTestMode && (
        <View className='icebreaker__warmup-test-strip'>
          <Text className='icebreaker__warmup-test-strip-text'>
            {runBots ? '调试局 · 虚拟伙伴参与完整流程' : '调试局 · 仅话题卡预览'}
          </Text>
        </View>
      )}

      {ritualGateOpen ? (
        <HandshakeRitual
          isHost={isHost}
          vibe={vibe}
          tier={currentTier}
          onStart={handleRitualStart}
        />
      ) : (
        <>
      <WarmupWelcomeBand welcomeSegments={welcomeSegments} caption={caption} />

      {/* S10 gyro-parallax spike (2026-08-11): no-op fragment unless
          GYRO_PARALLAX_SPIKE_ENABLED is flipped for device measurement. */}
      <GyroParallaxSpike reduceMotion={reduceMotion}>
        <View
          className={`warmup-card-slot-outer ${
            topicEntering ? 'warmup-card-slot-outer--entering' : ''
          }`}
        >
          <WarmupCardSlot
            state={cardState}
            topics={topics}
            currentIndex={currentIndex}
            selectedMood={selectedMood}
            vibe={vibe}
            isFlipped={topicFlipped}
            reduceMotion={reduceMotion}
            isDeepPromptExpanded={deepPromptExpanded}
            isHost={isHost}
            onGenerateTopics={onGenerateTopics}
            onRetry={handleRetry}
            onToggleDeepPrompt={handleToggleDeepPrompt}
            onFeedbackTap={handleAigcFeedback}
            warmupTopicsMeta={warmupTopicsMeta}
            participants={participants}
            readyUserIds={readyUserIds}
            currentUserId={currentUserId}
            selfReadyOptimistic={selfReadyOptimistic}
            warmupDataReady={warmupDataReady}
            topicsRecovery={topicsRecovery}
          />
        </View>
      </GyroParallaxSpike>

      {/* P1 — in topic_card the ember rim carries per-member presence, so the
          strip slims to a compact count-only row (no duplicate avatar row).
          Other warmup states keep the full strip. Reuses WarmupPresenceStrip
          classes (its SCSS is bundled via the import below). */}
      {advancePrompt}

      {cardState === 'topic_card' ? (
        <View className='warmup-presence'>
          <View style={{ flex: 1 }} />
          <View className='warmup-presence__count'>
            <Text className='warmup-presence__count-text'>
              {optimisticReadyCount}/{participants.length} 已准备
            </Text>
          </View>
        </View>
      ) : glanceStackEnabled ? (
        // S3 demotion (spec §4.1 warmup row): the avatar strip is L3 context
        // — the compact count is the glanceable trigger, the strip lives
        // behind hold-to-peek.
        <GlancePeek summary={`${optimisticReadyCount}/${participants.length}`}>
          <WarmupPresenceStrip
            participants={participants}
            readyUserIds={readyUserIds}
            hostUserId={hostUserId}
            currentUserId={currentUserId}
            readyCount={readyUserIds.length}
            totalCount={participants.length}
          />
        </GlancePeek>
      ) : (
        <WarmupPresenceStrip
          participants={participants}
          readyUserIds={readyUserIds}
          hostUserId={hostUserId}
          currentUserId={currentUserId}
          readyCount={readyUserIds.length}
          totalCount={participants.length}
        />
      )}

      {showActionBar && (
        <WarmupActionBar
          ctaState={ctaState}
          isReady={effectiveIsReady}
          isHost={isHost}
          everyoneReady={effectiveEveryoneReady}
          isUpdatingReady={isUpdatingReady && !selfReadyOptimistic}
          isAdvancingTopic={isAdvancingTopic}
          isAdvancing={isAdvancing}
          onToggleReady={handleToggleReady}
          onNextTopic={onNextTopic}
          onAdvance={onAdvance}
        />
      )}
        </>
      )}

      <WarmupCelebrationOverlay
        visible={showCelebration}
        line={celebrationLine}
        reducedMotion={reduceMotion}
        onDismiss={() => setShowCelebration(false)}
      />
    </View>
  )
}

export default WarmupPhaseView
