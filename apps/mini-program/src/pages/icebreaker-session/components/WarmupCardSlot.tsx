import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker'
import { stripEmojis } from '../../../lib/utils/emojiGuard'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import CardFlip from '../../../components/reveal/CardFlip'
import TypewriterText from '../../../components/ui/TypewriterText'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { useTierReveal } from '../../../hooks/useTierReveal'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { MOOD_OPTIONS, PhaseHeaderIcon } from '../phaseUtils'
import type { SessionParticipant } from '../phaseUtils'
import { getPhaseFoilStyle } from '../phases/phaseAccents'
import { WarmupEmberRim, useEmberSync } from './WarmupEmberRim'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import type { WarmupCardState } from '../viewModels/warmupViewModels'
import {
  getDepthCornerText,
  getDepthSealColors,
  isBraveTopic,
  shouldShowPermissionLine,
  buildMoodOptions,
  getTotalTopics,
} from '../viewModels/warmupViewModels'
import type { VibeId } from '../../../lib/vibeMapping'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../../lib/utils/haptics'
import './WarmupCardSlot.scss'

interface WarmupCardSlotProps {
  state: WarmupCardState
  topics: SocialTopic[]
  currentIndex: number
  selectedMood?: AtmosphereMood
  vibe?: VibeId
  isFlipped: boolean
  reduceMotion: boolean
  isDeepPromptExpanded: boolean
  onGenerateTopics: (mood: AtmosphereMood) => void
  onRetry: () => void
  onToggleDeepPrompt: () => void
  onFeedbackTap: () => void
  warmupTopicsMeta?: AIResponseMeta
  /** Campfire Vault Card PR2 — ember rim data (all optional; rim no-ops without them). */
  participants?: SessionParticipant[]
  readyUserIds?: string[]
  currentUserId?: string
  /** S1 — self ready tapped; ember ignites before the server echo. */
  selfReadyOptimistic?: boolean
  /**
   * C3 — true once the first ready-state payload has arrived (the page
   * passes `readyUserIds ?? []`, so this flag distinguishes "resolved with
   * nobody ready" from "query still in flight"). Defaults to true for
   * back-compat with callers that always have resolved data.
   */
  warmupDataReady?: boolean
}

const TOPIC_MOOD_EMOJI: Record<AtmosphereMood, string> = {
  funny: '😂',
  life: '☕',
  relaxed: '✨',
  emotional: '💫',
}

// ─── Campfire Vault Card PR1 motion constants (contract C1 / C2 / C4) ───────
/** Deal keyframe duration — 480ms two-beat spring (C1). */
const DEAL_DURATION_MS = 480
/** Single landing haptic at ~70% of the deal (C1). */
const DEAL_HAPTIC_MS = 340
/** Sheen starts 120ms after the 500ms CardFlip completes (C2). */
const SHEEN_DELAY_MS = 620
/** One-pass sheen sweep duration (C2). */
const SHEEN_DURATION_MS = 700
/** Quiet topic-change question crossfade (C4 — 300–420ms window). */
const QUESTION_SWITCH_MS = 360
/** E5 — slots shorter than this (rpx) collapse the rim to a count chip. */
const EMBER_RIM_MIN_SLOT_RPX = 640

/**
 * Campfire Vault Card events. Payloads carry topic id + depthLevel only —
 * no PII (contract A5).
 */
const trackVaultCardEvent = socialIcebreakerAnalytics.track

function MoodOptionGrid({
  options,
  onSelect,
}: {
  options: ReturnType<typeof buildMoodOptions>
  onSelect: (mood: AtmosphereMood) => void
}) {
  return (
    <View className='warmup-card-slot__mood-grid'>
      {options.map((option) => (
        <View
          key={option.mood}
          className={`warmup-card-slot__mood-option ${
            option.isActive ? 'warmup-card-slot__mood-option--active' : ''
          } ${option.isDisabled ? 'warmup-card-slot__mood-option--disabled' : ''}`}
          onClick={() => {
            if (!option.isDisabled) {
              haptics('light')
              onSelect(option.mood)
            }
          }}
          hoverClass='warmup-card-slot__mood-option--pressed'
          role='button'
          aria-label={option.label}
        >
          <Image className='warmup-card-slot__mood-option-emoji' src={option.asset} mode='aspectFit' />
          <Text className='warmup-card-slot__mood-option-label'>{option.label}</Text>
          {option.isActive && (
            <View className='warmup-card-slot__mood-option-check'>
              <JoyJoinIcon emoji='✓' tier='status' size={16} />
            </View>
          )}
        </View>
      ))}
    </View>
  )
}

function DeepPromptReveal({
  promptTiers,
  reduceMotion,
}: {
  promptTiers: import('@shared/socialIcebreaker').SocialTopicPromptTiers
  reduceMotion: boolean
}) {
  const { revealedCount, tiers } = useTierReveal(promptTiers, reduceMotion)

  if (reduceMotion) {
    return (
      <View className='warmup-card-slot__prompts warmup-card-slot__prompts--static'>
        {tiers.map((tier) => (
          <View key={tier.key} className='warmup-card-slot__prompt warmup-card-slot__prompt--visible'>
            <Text className='warmup-card-slot__prompt-label'>{tier.label}</Text>
            <Text className='warmup-card-slot__prompt-text'>{stripEmojis(tier.text)}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className='warmup-card-slot__prompts'>
      {tiers.map((tier, index) => (
        <View
          key={tier.key}
          className={`warmup-card-slot__prompt ${
            index < revealedCount ? 'warmup-card-slot__prompt--visible' : ''
          }`}
        >
          <Text className='warmup-card-slot__prompt-label'>{tier.label}</Text>
          <Text className='warmup-card-slot__prompt-text'>{stripEmojis(tier.text)}</Text>
        </View>
      ))}
    </View>
  )
}

export function WarmupCardSlot({
  state,
  topics,
  currentIndex,
  selectedMood,
  vibe,
  isFlipped,
  reduceMotion,
  isDeepPromptExpanded,
  onGenerateTopics,
  onRetry,
  onToggleDeepPrompt,
  onFeedbackTap,
  warmupTopicsMeta,
  participants = [],
  readyUserIds = [],
  currentUserId = '',
  selfReadyOptimistic = false,
  warmupDataReady = true,
}: WarmupCardSlotProps) {
  const aigcEnabled = useAIGCLabelsEnabled()
  // C8 — degradation tier renders every decorative beat on this card
  // statically (deal / sheen / crossfade / ember motion), exactly like RM.
  const { isDegradation } = useDeviceTier()
  const motionReduced = reduceMotion || isDegradation
  const topicAigcMeta = warmupTopicsMeta?.aigc ?? {
    aiGenerated: true,
    labelType: 'ai-generated' as const,
  }
  const currentTopic = topics[Math.min(currentIndex, Math.max(topics.length - 1, 0))]
  const totalTopics = getTotalTopics(topics)
  const cornerText = getDepthCornerText(vibe, currentTopic?.depthLevel)
  const moodOptions = useMemo(
    () => buildMoodOptions(MOOD_OPTIONS, selectedMood, state === 'generating'),
    [selectedMood, state],
  )

  const handleToggleDeepPrompt = useCallback(() => {
    haptics('light')
    onToggleDeepPrompt()
  }, [onToggleDeepPrompt])

  const handleRetry = useCallback(() => {
    haptics('light')
    onRetry()
  }, [onRetry])

  const handleGenerate = useCallback(
    (mood: AtmosphereMood) => {
      haptics('light')
      onGenerateTopics(mood)
    },
    [onGenerateTopics],
  )

  // ── Campfire Vault Card PR1: foil frame + deal/sheen/quiet-switch ────────
  const isTopicCard = state === 'topic_card'
  const foil = useMemo(() => (isTopicCard ? getPhaseFoilStyle('warmup') : null), [isTopicCard])
  const sealColors = useMemo(
    () => getDepthSealColors(currentTopic?.depthLevel),
    [currentTopic?.depthLevel],
  )
  const showPermissionLine = shouldShowPermissionLine(currentTopic, currentIndex)

  // ── Campfire Vault Card PR2: ember rim + all-ready halo (E1–E5 / H1–H4) ──
  // Zero added network traffic (G3): the rim derives entirely from the
  // session query data already flowing to this page.
  const emberSync = useEmberSync({
    participants,
    readyUserIds,
    currentUserId,
    selfReadyOptimistic,
    isTopicCard,
    currentIndex,
    reduceMotion: motionReduced,
    dataReady: warmupDataReady,
  })
  const haloActive = emberSync.halo !== 'off'

  // P5 — while the halo glow (0.35 alpha) is up, the foil ambient shadow
  // (0.16 alpha) would stack too bright; halve the ambient alpha so the
  // card blooms once, not twice.
  const foilBoxShadow = useMemo(() => {
    if (!foil) return undefined
    if (!haloActive) return foil.boxShadow
    return foil.boxShadow.replace(/0\.16\)/, '0.08)')
  }, [foil, haloActive])

  // E5 — one-shot slot-height measurement per topic entry; below 640rpx the
  // rim degrades to a 「N/6 已准备」 chip. Generation-guarded so a stale
  // boundingClientRect callback never overwrites a newer decision.
  const [rimCollapsed, setRimCollapsed] = useState(false)
  const rimMeasureGenRef = useRef(0)
  useEffect(() => {
    if (!isTopicCard) return
    const gen = ++rimMeasureGenRef.current
    const timer = setTimeout(() => {
      try {
        const info = Taro.getSystemInfoSync()
        const thresholdPx = (EMBER_RIM_MIN_SLOT_RPX * (info.windowWidth ?? 375)) / 750
        Taro.createSelectorQuery()
          .select('.warmup-card-slot__foil-shell')
          .boundingClientRect()
          .exec((res) => {
            if (gen !== rimMeasureGenRef.current) return
            const height = res?.[0]?.height
            if (typeof height === 'number' && height > 0) {
              setRimCollapsed(height < thresholdPx)
            }
          })
      } catch {
        // Measurement unsupported (H5 / test runtime) — keep the rim.
      }
    }, 60)
    return () => clearTimeout(timer)
  }, [isTopicCard, currentIndex])

  type DealPhase = 'idle' | 'dealing' | 'settled'
  const [dealPhase, setDealPhase] = useState<DealPhase>('idle')
  const [sheenActive, setSheenActive] = useState(false)
  const [questionSwitching, setQuestionSwitching] = useState(false)

  // Refs persist across WeChat page re-show (the page stays mounted), so the
  // deal + sheen never replay on re-entry (C4 / C5).
  const hasEnteredTopicCardRef = useRef(false)
  const hasSheenPlayedRef = useRef(false)
  const prevTopicIndexRef = useRef(currentIndex)
  const dealHapticTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dealSettleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sheenStartTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sheenEndTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const questionSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      for (const ref of [
        dealHapticTimerRef,
        dealSettleTimerRef,
        sheenStartTimerRef,
        sheenEndTimerRef,
        questionSwitchTimerRef,
      ]) {
        if (ref.current) clearTimeout(ref.current)
      }
    },
    [],
  )

  // Deal on first topic_card entry only; quiet crossfade on later topic
  // changes (C1 / C4). Leaving topic_card (regenerate / error) re-arms the
  // deal so a freshly generated topic set deals again.
  useEffect(() => {
    if (state !== 'topic_card') {
      hasEnteredTopicCardRef.current = false
      hasSheenPlayedRef.current = false
      setDealPhase('idle')
      setSheenActive(false)
      setQuestionSwitching(false)
      return
    }

    if (!hasEnteredTopicCardRef.current) {
      hasEnteredTopicCardRef.current = true
      prevTopicIndexRef.current = currentIndex
      if (motionReduced) {
        setDealPhase('settled')
        return
      }
      setDealPhase('dealing')
      dealHapticTimerRef.current = setTimeout(() => haptics('light'), DEAL_HAPTIC_MS)
      dealSettleTimerRef.current = setTimeout(() => setDealPhase('settled'), DEAL_DURATION_MS)
      return
    }

    if (currentIndex !== prevTopicIndexRef.current) {
      prevTopicIndexRef.current = currentIndex
      if (!motionReduced) {
        setQuestionSwitching(true)
        if (questionSwitchTimerRef.current) clearTimeout(questionSwitchTimerRef.current)
        questionSwitchTimerRef.current = setTimeout(
          () => setQuestionSwitching(false),
          QUESTION_SWITCH_MS,
        )
      }
    }
  }, [state, currentIndex, motionReduced])

  // Single sheen pass, 120ms after the flip completes (C2). Gated to the
  // first flip — quiet topic changes and re-entry never re-sheen (C4 / C5).
  useEffect(() => {
    if (!isFlipped || motionReduced) return
    if (!hasEnteredTopicCardRef.current || hasSheenPlayedRef.current) return
    hasSheenPlayedRef.current = true
    sheenStartTimerRef.current = setTimeout(() => {
      setSheenActive(true)
      sheenEndTimerRef.current = setTimeout(() => setSheenActive(false), SHEEN_DURATION_MS)
    }, SHEEN_DELAY_MS)
  }, [isFlipped, motionReduced])

  // Analytics (contract A5): brave-card view + permission-line view, once per
  // topic id, fired when the card face is actually visible (post-flip).
  const trackedBraveTopicIdsRef = useRef<Set<string>>(new Set())
  const trackedPermissionTopicIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (state !== 'topic_card' || !isFlipped || !currentTopic) return
    const { id, depthLevel } = currentTopic
    // Contract A1 — brave = server-flagged reflective safety ONLY; depth
    // level alone must not fire (analytics C4).
    if (isBraveTopic(currentTopic) && !trackedBraveTopicIdsRef.current.has(id)) {
      trackedBraveTopicIdsRef.current.add(id)
      trackVaultCardEvent('topic_card_brave_view', undefined, undefined, 'warmup', {
        topicId: id,
        depthLevel: depthLevel ?? null,
      })
    }
    if (showPermissionLine && !trackedPermissionTopicIdsRef.current.has(id)) {
      trackedPermissionTopicIdsRef.current.add(id)
      trackVaultCardEvent('permission_line_view', undefined, undefined, 'warmup', {
        topicId: id,
        depthLevel: depthLevel ?? null,
      })
    }
  }, [state, isFlipped, currentTopic, showPermissionLine])

  const frontFace = (
    <View className='warmup-card-slot__face warmup-card-slot__face--front'>
      <View className='warmup-card-slot__front'>
        <PhaseHeaderIcon phase='warmup' size={80} />
        <Text className='warmup-card-slot__front-label'>话题卡</Text>
        <Text className='warmup-card-slot__front-sub'>话题马上揭晓</Text>
      </View>
    </View>
  )

  const renderContent = () => {
    switch (state) {
      case 'host_no_topics':
        return (
          <View className='warmup-card-slot__content'>
            <Text className='warmup-card-slot__empty-title'>选一个今晚的氛围</Text>
            <MoodOptionGrid options={moodOptions} onSelect={handleGenerate} />
          </View>
        )
      case 'player_no_topics':
        return (
          <View className='warmup-card-slot__content warmup-card-slot__content--centered'>
            <Image
              className='warmup-card-slot__empty-mascot'
              src={getXiaoyueExpressionAsset('coachGuide')}
              mode='aspectFit'
            />
            <Text className='warmup-card-slot__empty-title'>等主持人选个今晚的氛围～</Text>
          </View>
        )
      case 'generating':
        return (
          <View className='warmup-card-slot__content warmup-card-slot__content--centered'>
            {/* L7 — card-shaped skeleton matches the foil shell silhouette it
                morphs into (was a 96rpx dot → shape-mismatch flash). */}
            <View
              className={`warmup-card-slot__shimmer ${
                motionReduced ? 'warmup-card-slot__shimmer--static' : ''
              }`}
            />
            <Text className='warmup-card-slot__generating-text'>
              {DEFAULT_MASCOT_DISPLAY_NAME}正在出题…
            </Text>
          </View>
        )
      case 'error':
        return (
          <View
            className='warmup-card-slot__content warmup-card-slot__content--centered'
            role='alert'
            aria-live='polite'
          >
            <Text className='warmup-card-slot__error-text'>出题失败了，再试一次吧</Text>
            <Button
              variant='secondary'
              className='warmup-card-slot__retry-btn'
              onClick={handleRetry}
            >
              重试
            </Button>
          </View>
        )
      case 'topic_card':
      default: {
        if (!currentTopic) {
          return null
        }
        const showDeepPrompt = vibe === 'deep_chat' && currentTopic.promptTiers
        return (
          <View
            className={`warmup-card-slot__content ${
              dealPhase === 'dealing' ? 'warmup-card-slot__content--deal-in' : ''
            }`}
          >
            <View className='warmup-card-slot__top-row'>
              <View className='warmup-card-slot__dots'>
                {Array.from({ length: totalTopics }).map((_, i) => (
                  <View
                    key={i}
                    className={`warmup-card-slot__dot ${
                      i === currentIndex ? 'warmup-card-slot__dot--active' : ''
                    }`}
                  />
                ))}
              </View>
              {cornerText && sealColors && (
                <Text
                  className='warmup-card-slot__corner warmup-card-slot__corner--seal'
                  style={{
                    color: sealColors.deep,
                    borderColor: sealColors.borderColor,
                    background: sealColors.backgroundColor,
                  }}
                >
                  {cornerText}
                </Text>
              )}
            </View>

            <View
              className={`warmup-card-slot__mood-wrap ${
                isDeepPromptExpanded ? 'warmup-card-slot__mood-wrap--hidden' : ''
              }`}
            >
              <JoyJoinIcon
                emoji={TOPIC_MOOD_EMOJI[currentTopic.mood] ?? currentTopic.emoji ?? ''}
                tier='mood'
                size={48}
              />
            </View>

            <Text
              className={`warmup-card-slot__question ${
                isDeepPromptExpanded ? 'warmup-card-slot__question--expanded' : ''
              } ${questionSwitching ? 'warmup-card-slot__question--switching' : ''}`}
            >
              {stripEmojis(currentTopic.question)}
            </Text>

            {/* 悦仔说 permission whisper (B4). Two lines are reserved ONLY
                when a whisper actually renders on this card — cards without
                one carry zero dead space (P4); while typing the reserved box
                keeps height stable (G2). Cadence: first card or depthLevel
                ≥ 2 (C6). */}
            <View
              className={`warmup-card-slot__permission ${
                showPermissionLine && currentTopic.permissionLine
                  ? 'warmup-card-slot__permission--reserved'
                  : ''
              }`}
            >
              {showPermissionLine && currentTopic.permissionLine ? (
                <Text className='warmup-card-slot__permission-inner'>
                  <Text className='warmup-card-slot__permission-prefix'>悦仔说 ·</Text>
                  <TypewriterText
                    text={stripEmojis(currentTopic.permissionLine)}
                    className='warmup-card-slot__permission-text'
                    speed={40}
                    maxDuration={2000}
                    enabled={!reduceMotion}
                    numberOfLines={2}
                  />
                </Text>
              ) : null}
            </View>

            {showDeepPrompt && (
              <View className='warmup-card-slot__expander'>
                <View
                  className='warmup-card-slot__expander-hit'
                  onClick={handleToggleDeepPrompt}
                  hoverClass='warmup-card-slot__expander-hit--pressed'
                  role='button'
                  aria-expanded={isDeepPromptExpanded}
                  aria-label={isDeepPromptExpanded ? '收起深聊锦囊' : '展开深聊锦囊'}
                >
                  <Text className='warmup-card-slot__expander-text'>
                    {isDeepPromptExpanded ? '深聊锦囊 ⌄' : '深聊锦囊 ›'}
                  </Text>
                </View>
                {isDeepPromptExpanded && currentTopic.promptTiers && (
                  <DeepPromptReveal
                    promptTiers={currentTopic.promptTiers}
                    reduceMotion={reduceMotion}
                  />
                )}
              </View>
            )}
          </View>
        )
      }
    }
  }

  const backFace = (
    <View className='warmup-card-slot__face warmup-card-slot__face--back'>
      {renderContent()}
      {aigcEnabled && state === 'topic_card' && (
        <View className='warmup-card-slot__aigc'>
          <Text className='warmup-card-slot__aigc-text'>内容由 AI 生成</Text>
          <Text className='warmup-card-slot__aigc-sep'>·</Text>
          <View className='warmup-card-slot__aigc-report' onClick={onFeedbackTap}>
            <AIContentReportButton options={{ reason: 'AI 生成话题卡' }} label='反馈' />
          </View>
        </View>
      )}
    </View>
  )

  return (
    <View className={`warmup-card-slot ${isTopicCard ? 'warmup-card-slot--foil' : ''}`}>
      {isTopicCard ? (
        <View className='warmup-card-slot__foil-zone'>
          <View
            className={`warmup-card-slot__foil-shell ${
              dealPhase === 'dealing' ? 'warmup-card-slot__foil-shell--dealing' : ''
            }`}
            style={
              foil
                ? {
                    // H2 — the halo melts the foil border into ONE purple hue;
                    // the outer glow rides the opacity-only overlay below.
                    borderColor: haloActive ? 'rgba(139, 92, 246, 0.7)' : foil.borderColor,
                    boxShadow: foilBoxShadow,
                    background: foil.background,
                  }
                : undefined
            }
          >
            <CardFlip
              front={frontFace}
              back={backFace}
              flipped={isFlipped}
              duration={500}
              reducedMotion={reduceMotion}
            />
            {sheenActive && (
              <View className='warmup-card-slot__sheen warmup-card-slot__sheen--active' />
            )}
          </View>
          {haloActive && (
            <View
              className={`warmup-card-slot__halo-glow ${
                emberSync.halo === 'playing' ? 'warmup-card-slot__halo-glow--breathing' : ''
              }`}
            />
          )}
          {!rimCollapsed && (
            <WarmupEmberRim
              embers={emberSync.embers}
              halo={emberSync.halo}
              entering={emberSync.entering}
              degraded={isDegradation}
            />
          )}
        </View>
      ) : (
        <View className='warmup-card-slot__flat-card'>{backFace}</View>
      )}
      {isTopicCard && rimCollapsed && (
        <View className='warmup-card-slot__ember-chip'>
          <Text className='warmup-card-slot__ember-chip-text'>
            {emberSync.readyCount}/{emberSync.totalCount} 已准备
          </Text>
        </View>
      )}
    </View>
  )
}
