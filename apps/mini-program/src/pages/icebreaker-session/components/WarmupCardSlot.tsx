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
import { WarmupEmberRim, useEmberSync } from './WarmupEmberRim'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import type { TopicsRecoveryState, WarmupCardState } from '../viewModels/warmupViewModels'
import {
  getDepthCornerText,
  getDepthSealColors,
  getMoodRevealCopy,
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
import { getWindowInfoCompat } from '../../../lib/utils/systemInfo'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

interface WarmupCardSlotProps {
  state: WarmupCardState
  topics: SocialTopic[]
  currentIndex: number
  selectedMood?: AtmosphereMood
  vibe?: VibeId
  isFlipped: boolean
  reduceMotion: boolean
  isDeepPromptExpanded: boolean
  /** Host sees the 重试 action on the error card; players see a waiting line. */
  isHost?: boolean
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
  /** Transient-failure recovery state — shown on the 'recovering' card. */
  topicsRecovery?: TopicsRecoveryState | null
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
          <JoyJoinIcon
            className='warmup-card-slot__mood-option-emoji'
            emoji={TOPIC_MOOD_EMOJI[option.mood]}
            tier='mood'
            size={56}
          />
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
  isHost = false,
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
  topicsRecovery = null,
}: WarmupCardSlotProps) {
  const aigcEnabled = useAIGCLabelsEnabled()
  // C8 — degradation tier renders every decorative beat on this card
  // statically (deal / sheen / crossfade / ember motion), exactly like RM.
  const { isDegradation } = useDeviceTier()
  const motionReduced = reduceMotion || isDegradation
  // AIGC label is fail-closed: render only when the server actually marked the
  // served content as AI-generated. A missing meta (curated fallback / route
  // heal / legacy payload) must never acquire the label.
  const showAigcLabel =
    aigcEnabled && state === 'topic_card' && warmupTopicsMeta?.aigc?.aiGenerated === true
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
  // AC-08/#11 — the warmup hero card consumes the L1 ice-card-primary
  // material in SCSS (white surface + accent-0.32 foil border + single
  // accent-0.12 shadow); the #FFFAF4 tint that clashed with the page floor
  // is retired. Inline styles survive only for the halo border melt (H2).
  const sealColors = useMemo(
    () => getDepthSealColors(currentTopic?.depthLevel),
    [currentTopic?.depthLevel],
  )
  const moodReveal = useMemo(() => getMoodRevealCopy(selectedMood), [selectedMood])
  const showPermissionLine = shouldShowPermissionLine(currentTopic, currentIndex)

  // Bottom-chrome presence (whisper / counter / deep expander) decides the
  // teaching hint's anchor — it must never cover the persistent bottom slot.
  const showDeepPrompt = vibe === 'deep_chat' && !!currentTopic?.promptTiers
  const showBottomCounter = !showPermissionLine && !showDeepPrompt
  const hasBottomChrome =
    (showPermissionLine && !!currentTopic?.permissionLine) || showBottomCounter || showDeepPrompt

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

  // AC-04 — 首燃教学提示 (first-ignition teaching): the ember rim counts in
  // the ≤2 card-top symbol quota, so its meaning must be taught, not guessed.
  // One transient hint the first time any ember lights (seeded re-entry
  // counts — late joiners need the lesson too), once per page lifetime.
  const [emberHintVisible, setEmberHintVisible] = useState(false)
  const emberHintShownRef = useRef(false)
  // The dismiss timer lives in a ref, NOT in the ignition effect's cleanup —
  // the poll refreshes the embers array identity every 3s, and an effect
  // cleanup would clear the pending dismiss before it ever fires (observed:
  // the hint stuck on screen past its window in the H5 capture).
  const emberHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (emberHintTimerRef.current) clearTimeout(emberHintTimerRef.current)
    },
    [],
  )
  useEffect(() => {
    if (emberHintShownRef.current) return
    if (!emberSync.embers.some((ember) => ember.lit)) return
    emberHintShownRef.current = true
    setEmberHintVisible(true)
    emberHintTimerRef.current = setTimeout(() => setEmberHintVisible(false), 2600)
  }, [emberSync.embers])

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
        const thresholdPx = (EMBER_RIM_MIN_SLOT_RPX * (getWindowInfoCompat().windowWidth ?? 375)) / 750
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

  // ── Staged generating copy (2026-07-28 502 incident): a static
  // 「正在出题…」 for 8s+ reads as a hang. Swap to a reassuring second line
  // after 4s; resets whenever the card leaves the generating state.
  const GENERATING_STAGE_DELAY_MS = 4000
  const [generatingStage, setGeneratingStage] = useState(0)
  useEffect(() => {
    if (state !== 'generating') {
      setGeneratingStage(0)
      return
    }
    const timer = setTimeout(() => setGeneratingStage(1), GENERATING_STAGE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

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
        {moodReveal ? (
          <>
            <Text className='warmup-card-slot__front-eyebrow'>今晚的氛围</Text>
            <Text className='warmup-card-slot__front-mood'>{moodReveal.label}</Text>
            <Text className='warmup-card-slot__front-sub'>{moodReveal.line}</Text>
          </>
        ) : (
          <>
            <Text className='warmup-card-slot__front-label'>话题卡</Text>
            <Text className='warmup-card-slot__front-sub'>话题马上揭晓</Text>
          </>
        )}
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
              {generatingStage === 0
                ? `${DEFAULT_MASCOT_DISPLAY_NAME}正在出题…`
                : '还在思考中，马上就好~'}
            </Text>
          </View>
        )
      case 'recovering':
        return (
          <View
            className='warmup-card-slot__content warmup-card-slot__content--centered'
            role='status'
            aria-live='polite'
          >
            <View
              className={`warmup-card-slot__shimmer ${
                motionReduced ? 'warmup-card-slot__shimmer--static' : ''
              }`}
            />
            <Text className='warmup-card-slot__generating-text'>
              {`网络打了个盹，${DEFAULT_MASCOT_DISPLAY_NAME}正在重新连接…（自动重试 ${topicsRecovery?.attempt ?? 1}/${topicsRecovery?.maxAttempts ?? 3}）`}
            </Text>
          </View>
        )
      case 'error':
        return (
          <View
            className='warmup-card-slot__content warmup-card-slot__content--centered warmup-card-slot__content--error'
            role='alert'
            aria-live='polite'
          >
            <Image
              className='warmup-card-slot__empty-mascot'
              src={getXiaoyueExpressionAsset(isHost ? 'actionFailure' : 'coachGuide')}
              mode='aspectFit'
            />
            <Text className='warmup-card-slot__error-text'>
              {isHost ? '出题失败了，再试一次吧' : '出题遇到小状况，主持人正在重试～'}
            </Text>
            {isHost && (
              <Button
                variant='primary'
                className='warmup-card-slot__retry-btn'
                onClick={handleRetry}
              >
                重试
              </Button>
            )}
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
            {/* AC-04 — card-top symbols ≤ 2: (1) this seal row (progress text
                + user-language depth seal), (2) the ember rim on the border.
                The bare mood icon is retired — the flip's front face now
                carries the atmosphere reveal. */}
            <View className='warmup-card-slot__top-row'>
              <View className='warmup-card-slot__seal-row'>
                <Text className='warmup-card-slot__progress'>
                  {`${currentIndex + 1}/${totalTopics}`}
                </Text>
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
            </View>

            {/* AC-03 — three-band distribution: meta row on top, question
                vertically centred in the flex:1 zone, persistent bottom slot
                (permission whisper → deep expander →「第 N/M 题」). No dead
                lower half on plain cards. */}
            <View className='warmup-card-slot__question-zone'>
              <Text
                className={`warmup-card-slot__question ${
                  isDeepPromptExpanded ? 'warmup-card-slot__question--expanded' : ''
                } ${questionSwitching ? 'warmup-card-slot__question--switching' : ''}`}
              >
                {stripEmojis(currentTopic.question)}
              </Text>
            </View>

            {/* 悦仔说 permission whisper (B4). The bottom slot is persistent:
                a whisper renders when one exists (C6 cadence); otherwise the
                topic counter fills the slot so the lower band never gapes. */}
            <View
              className={`warmup-card-slot__bottom-slot ${
                showPermissionLine && currentTopic.permissionLine
                  ? 'warmup-card-slot__bottom-slot--reserved'
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
              ) : showBottomCounter ? (
                <Text className='warmup-card-slot__bottom-counter'>
                  {`第 ${currentIndex + 1}/${totalTopics} 题`}
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
      {showAigcLabel && (
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
              haloActive
                ? {
                    // H2 — the halo melts the foil border into ONE purple hue;
                    // the L1 material (white + 0.32 border + 0.12 shadow)
                    // otherwise comes from ice-card-primary in SCSS.
                    borderColor: 'rgba(139, 92, 246, 0.7)',
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
          {emberHintVisible && (
            <View
              className={`warmup-card-slot__ember-hint ${
                hasBottomChrome ? 'warmup-card-slot__ember-hint--raised' : ''
              }`}
              aria-hidden='true'
            >
              <Text className='warmup-card-slot__ember-hint-text'>
                火苗亮起 = 一位伙伴准备好了
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View className='warmup-card-slot__flat-card'>{backFace}</View>
      )}
    </View>
  )
}
