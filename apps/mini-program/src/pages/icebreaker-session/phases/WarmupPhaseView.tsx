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
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { WarmupWelcomeBand } from '../components/WarmupWelcomeBand'
import { WarmupCardSlot } from '../components/WarmupCardSlot'
import { WarmupPresenceStrip } from '../components/WarmupPresenceStrip'
import { WarmupCelebrationOverlay } from '../components/WarmupCelebrationOverlay'
import { GyroParallaxSpike } from '../spike/GyroParallaxSpike'
import { HandshakeRitual } from '../components/HandshakeRitual'
import { GlancePeek } from '../components/GlancePeek'
import { isHandshakeRitualGateOpen } from '../viewModels/glanceStackModel'
import type { SessionParticipant } from '../phaseUtils'
import type { WarmupReadiness } from '../hooks/useWarmupReadiness'
import { useUgcReport } from '../hooks/useUgcReport'
import {
  buildWelcomeSegments,
  buildWarmupCaption,
  buildCelebrationLine,
  buildArchetypeMixText,
} from '../viewModels/warmupViewModels'
import type { TopicsRecoveryState } from '../viewModels/warmupViewModels'
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
  isGeneratingTopics: boolean
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
  /**
   * Readiness cluster owned by the page (useWarmupReadiness): card state,
   * optimistic self-ready, mirrored count, CTA state. The page renders the
   * CTA dock as a flex sibling of the ScrollView from the same source.
   */
  readiness: WarmupReadiness
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
  isGeneratingTopics,
  topicsError = false,
  topicsRecovery = null,
  onAigcFeedbackTap,
  warmupDataReady = true,
  advancePrompt,
  glanceStackEnabled = false,
  onRitualStart,
  readiness,
}: WarmupPhaseViewProps) {
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  // Readiness cluster (card state + optimistic self-ready) is owned by the
  // page-level hook so the CTA dock can render as a ScrollView sibling.
  const { cardState, selfReadyOptimistic, optimisticReadyCount } = readiness

  // E9 (contract AC-07): roster-strip long-press → report a participant's
  // nickname (kind displayName; the server snapshots it from participants).
  const { presentReport: presentUgcReport } = useUgcReport({ socialSessionId })
  const handleParticipantLongPress = useCallback(
    (participant: SessionParticipant) => {
      void presentUgcReport({
        phase: 'warmup',
        targetUserId: participant.userId,
        contentRef: { kind: 'displayName' },
      })
    },
    [presentUgcReport],
  )

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

  // ── Ready capsule (#27 / AC-06): big count + 「还差 N 人」+ names ──
  const missingCount = Math.max(participants.length - optimisticReadyCount, 0)
  const missingNamesText = useMemo(() => {
    if (missingCount === 0) return ''
    const names = participants
      .filter(
        (p) =>
          !readyUserIds.includes(p.userId) &&
          !(selfReadyOptimistic && p.userId === currentUserId),
      )
      .map((p) => p.displayName ?? '匿名')
    const shown = names.slice(0, 3).join('、')
    return names.length > 3 ? `${shown} 等` : shown
  }, [missingCount, participants, readyUserIds, selfReadyOptimistic, currentUserId])

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
        <View className='icebreaker__warmup-test-capsule' role='note'>
          <JoyJoinIcon emoji='⚠️' tier='status' size={24} />
          <Text className='icebreaker__warmup-test-capsule-text'>
            {runBots ? '测试局 · 虚拟伙伴参与完整流程' : '测试局 · 仅话题卡预览'}
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
          strip slims to the ready capsule (#27 / AC-06): big mirrored count,
          「还差 N 人」 and the unready names — social pressure at a 6-seat
          table is the feature. Other warmup states keep the full strip. */}
      {advancePrompt}

      {cardState === 'topic_card' ? (
        <View className='warmup-presence warmup-presence--capsule-row'>
          <View className='warmup-presence__capsule'>
            <Text className='warmup-presence__capsule-count'>
              {optimisticReadyCount}/{participants.length}
            </Text>
            <View className='warmup-presence__capsule-meta'>
              <Text className='warmup-presence__capsule-label'>
                {missingCount > 0 ? '已准备' : '全员就绪，可以开场啦'}
              </Text>
              {missingCount > 0 && (
                <Text className='warmup-presence__capsule-names'>
                  {`还差 ${missingCount} 人${missingNamesText ? `：${missingNamesText}` : ''}`}
                </Text>
              )}
            </View>
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
            onLongPressParticipant={handleParticipantLongPress}
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
          onLongPressParticipant={handleParticipantLongPress}
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
