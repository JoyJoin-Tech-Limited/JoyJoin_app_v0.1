import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ArchetypeGlyph from '../../../components/mascot/ArchetypeGlyph'
import Button from '../../../components/ui/Button'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import CardFlip from '../../../components/reveal/CardFlip'
import { useTierReveal } from '../../../hooks/useTierReveal'
import type { AtmosphereMood, SocialTopic, SocialTopicPromptTiers } from '@shared/socialIcebreaker'
import {
  PhaseHeaderIcon,
  getMoodLabel,
  MOOD_OPTIONS,
  type SessionParticipant,
} from '../phaseUtils'
import type { VibeId } from '../../../lib/vibeMapping'
import './WarmupPhaseView.scss'

interface WarmupPhaseViewProps {
  topics: SocialTopic[]
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  selectedMood?: AtmosphereMood
  isHost: boolean
  vibe?: VibeId
  /** Server-computed archetype mix text; falls back to client-side computation if absent. */
  archetypeMixText?: string
  /** True when the session is in custom tier mode; changes the final warmup CTA label. */
  isCustomMode?: boolean
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleReady: () => void
  onNextTopic: () => void
  onAdvance: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
  isAdvancing: boolean
  topicsError?: boolean
}

/**
 * Build archetype mix text client-side from participant roster.
 * Mirrors server-side buildArchetypeContext logic.
 */
function buildArchetypeMixText(participants: SessionParticipant[]): string {
  const counts = new Map<string, number>()
  for (const p of participants) {
    if (p.archetype) {
      counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return ''

  const segments: string[] = []
  for (const [id, count] of counts) {
    const def = ARCHETYPE_BY_ID[id]
    const name = def?.nameCn ?? id
    segments.push(count > 1 ? `${name}×${count}` : name)
  }
  return segments.join('、')
}

/**
 * Tier prompt reveal component for 深聊 vibe.
 *
 * Uses useTierReveal for staggered block-level reveals rather than TypewriterText,
 * because this UX requires labeled tier blocks (开场/深入/反思) with reading-time
 * delays between whole sections — a pattern TypewriterText's single-string
 * character typing does not natively support.
 */
function TierPromptReveal({
  promptTiers,
  reduceMotion,
}: {
  promptTiers: SocialTopicPromptTiers
  reduceMotion: boolean
}) {
  const { revealedCount, tiers } = useTierReveal(promptTiers, reduceMotion)

  if (reduceMotion) {
    return (
      <View className='warmup-tier-prompts warmup-tier-prompts--static'>
        {tiers.map((tier) => (
          <View key={tier.key} className='warmup-tier-prompt warmup-tier-prompt--visible'>
            <Text className='warmup-tier-prompt__label'>{tier.label}</Text>
            <Text className='warmup-tier-prompt__text'>{tier.text}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className='warmup-tier-prompts'>
      {tiers.map((tier, index) => (
        <View
          key={tier.key}
          className={`warmup-tier-prompt ${index < revealedCount ? 'warmup-tier-prompt--visible' : ''}`}
        >
          <Text className='warmup-tier-prompt__label'>{tier.label}</Text>
          <Text className='warmup-tier-prompt__text'>{tier.text}</Text>
        </View>
      ))}
      <View className='warmup-tier-dots'>
        {tiers.map((_, index) => (
          <Text
            key={index}
            className={`warmup-tier-dot ${
              index === revealedCount - 1
                ? 'warmup-tier-dot--active'
                : index < revealedCount
                  ? 'warmup-tier-dot--filled'
                  : ''
            }`}
          >
            {index < revealedCount ? '●' : '○'}
          </Text>
        ))}
      </View>
    </View>
  )
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
  isCustomMode,
  onGenerateTopics,
  onToggleReady,
  onNextTopic,
  onAdvance,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
  isAdvancing,
  topicsError,
}: WarmupPhaseViewProps) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const moodLabel = getMoodLabel(selectedMood)

  // ── Reduced motion detection ─────────────────────────────────
  const reduceMotion = useMemo(() => {
    try {
      return !!(Taro.getSystemInfoSync() as any).reduceMotion
    } catch {
      return false
    }
  }, [])

  // ── Archetype mix badge ──────────────────────────────────────
  const fallbackMixText = useMemo(
    () => buildArchetypeMixText(participants),
    [participants],
  )
  const archetypeMixText = propArchetypeMixText ?? fallbackMixText

  // ── Topic card flip animation ────────────────────────────────
  const [topicFlipped, setTopicFlipped] = useState(false)
  const prevIndexRef = useRef(currentIndex)
  const indexChangeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autoFlipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex
      setTopicFlipped(false)
      if (indexChangeTimerRef.current) clearTimeout(indexChangeTimerRef.current)
      indexChangeTimerRef.current = setTimeout(() => setTopicFlipped(true), 180)
    }
    return () => {
      if (indexChangeTimerRef.current) {
        clearTimeout(indexChangeTimerRef.current)
        indexChangeTimerRef.current = undefined
      }
    }
  }, [currentIndex])

  // Auto-flip on first topic load
  useEffect(() => {
    if (currentTopic && !topicFlipped) {
      if (autoFlipTimerRef.current) clearTimeout(autoFlipTimerRef.current)
      autoFlipTimerRef.current = setTimeout(() => setTopicFlipped(true), 320)
    }
    return () => {
      if (autoFlipTimerRef.current) {
        clearTimeout(autoFlipTimerRef.current)
        autoFlipTimerRef.current = undefined
      }
    }
  }, [currentTopic]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Everyone-ready celebration (ParticleBurst) ───────────────
  const [showCelebration, setShowCelebration] = useState(false)
  const prevEveryoneReadyRef = useRef(false)
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (everyoneReady && !prevEveryoneReadyRef.current) {
      setShowCelebration(true)
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
  }, [everyoneReady])

  // ── Depth badge config ───────────────────────────────────────
  const depthBadge = useMemo(() => {
    if (!vibe || !currentTopic) return null
    if (vibe === 'deep_chat' && currentTopic.depthLevel) {
      return {
        type: 'deep' as const,
        text: `深度话题 · L${currentTopic.depthLevel}`,
      }
    }
    if (vibe === 'play_fun') {
      return {
        type: 'fast' as const,
        text: '快速暖场',
      }
    }
    return null
  }, [vibe, currentTopic])

  // ── Topic card render helpers ────────────────────────────────
  const TopicFront = useCallback(
    () => (
      <View className='warmup-card-front'>
        <View className='warmup-card-front__icon'>
          <PhaseHeaderIcon phase='warmup' size={80} />
        </View>
        <Text className='warmup-card-front__label'>话题卡</Text>
        <Text className='warmup-card-front__sub'>轻轻一点，开启今晚的聊天</Text>
      </View>
    ),
    [],
  )

  const TopicBack = useCallback(
    () =>
      currentTopic ? (
        <View className='warmup-card-back'>
          {depthBadge && (
            <View
              className={`warmup-depth-badge warmup-depth-badge--${depthBadge.type}`}
            >
              <Text className='warmup-depth-badge__text'>{depthBadge.text}</Text>
            </View>
          )}
          <View className='warmup-card-back__emoji'>
            <JoyJoinIcon emoji={currentTopic.emoji ?? ''} size={56} />
          </View>
          <Text className='warmup-card-back__question'>{currentTopic.question}</Text>

          {vibe === 'deep_chat' && currentTopic.promptTiers ? (
            <TierPromptReveal promptTiers={currentTopic.promptTiers} reduceMotion={reduceMotion} />
          ) : null}

          <View className='warmup-card-back__meta'>
            <Text className='warmup-card-back__index'>
              {currentIndex + 1} / {topics.length}
            </Text>
            {selectedMood ? (
              <Text className='warmup-card-back__mood'>今晚氛围 · {moodLabel}</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View className='warmup-card-back warmup-card-back--empty'>
          <View className='warmup-card-back__emoji'>
            <PhaseHeaderIcon phase='warmup' size={80} />
          </View>
          <Text className='warmup-card-back__question'>话题卡准备中…</Text>
        </View>
      ),
    [currentTopic, currentIndex, topics.length, selectedMood, moodLabel, depthBadge, vibe, reduceMotion],
  )

  return (
    <View className='icebreaker__warmup'>
      {/* ── Celebration overlay ────────────────────────────── */}
      {showCelebration && (
        <View className='icebreaker__warmup-celebration'>
          <ParticleBurst trigger={showCelebration} type='confetti' count={50} reducedMotion={reduceMotion} />
        </View>
      )}

      {/* ── Archetype mix badge ────────────────────────────── */}
      {archetypeMixText ? (
        <View className='icebreaker__archetype-mix'>
          <Text className='icebreaker__archetype-mix-label'>今晚气氛组</Text>
          <Text className='icebreaker__archetype-mix-text'>{archetypeMixText}</Text>
        </View>
      ) : null}

      {/* ── Topic card (with CardFlip entrance) ────────────── */}
      <View className='icebreaker__warmup-card-wrap'>
        <CardFlip
          front={<TopicFront />}
          back={<TopicBack />}
          flipped={topicFlipped}
          duration={500}
          reducedMotion={reduceMotion}
        />
      </View>

      {/* ── Ready status bar ───────────────────────────────── */}
      <View className='icebreaker__warmup-status'>
        <View className='icebreaker__warmup-ready-bar'>
          <Text className='icebreaker__warmup-ready-count'>
            {readyUserIds.length} / {participants.length} 人已准备
          </Text>
          {everyoneReady && (
            <View className='icebreaker__warmup-ready-all-wrap'>
              <JoyJoinIcon emoji='🎉' tier='reaction' size={24} />
              <Text className='icebreaker__warmup-ready-all'>全员到齐</Text>
            </View>
          )}
        </View>
        {isReady && !everyoneReady && (
          <Text className='icebreaker__warmup-ready-badge'>你已准备</Text>
        )}
      </View>

      {/* ── Participant roster ─────────────────────────────── */}
      {participants.length > 0 && (
        <View className='icebreaker__participants-scroll'>
          <View className='icebreaker__participants'>
            {participants.map((p) => {
              const pReady = readyUserIds.includes(p.userId)
              return (
                <View
                  key={p.userId}
                  className={
                    'icebreaker__participant' +
                    (pReady ? ' icebreaker__participant--ready' : '')
                  }
                >
                  <View className='icebreaker__participant-avatar'>
                    {p.archetype ? (
                      <ArchetypeGlyph archetype={p.archetype} size={28} />
                    ) : (
                      <Text className='icebreaker__participant-avatar-fallback'>?</Text>
                    )}
                    {p.isHost && (
                      <Image
                        src={localAsset('/assets/icons/status-icons/status-crown.png')}
                        className='icebreaker__participant-host'
                        lazyLoad
                      />
                    )}
                  </View>
                  <Text className='icebreaker__participant-name'>
                    {p.displayName ?? '匿名'}
                  </Text>
                  {pReady && (
                    <Text className='icebreaker__participant-check'>✓</Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* ── Action stack ───────────────────────────────────── */}
      <View className='icebreaker__action-stack'>
        {!currentTopic ? (
          isHost ? (
            <>
              {topicsError && (
                <View className='icebreaker__error-retry'>
                  <Text className='icebreaker__error-retry-text'>出题失败了，再试一次吧</Text>
                  <Button
                    variant='secondary'
                    className='icebreaker__error-retry-btn'
                    onClick={() => {
                      if (selectedMood) {
                        onGenerateTopics(selectedMood)
                      }
                    }}
                    disabled={!selectedMood || isGeneratingTopics}
                  >
                    重试
                  </Button>
                </View>
              )}
              <View className='icebreaker__mood-grid'>
                {MOOD_OPTIONS.map((option) => {
                  const isActive = selectedMood === option.mood
                  return (
                    <View
                      key={option.mood}
                      className={
                        'icebreaker__mood-option' +
                        (isActive ? ' icebreaker__mood-option--active' : '') +
                        (isGeneratingTopics ? ' icebreaker__mood-option--disabled' : '') +
                        (selectedMood && !isActive ? ' icebreaker__mood-option--dimmed' : '')
                      }
                      onClick={() => {
                        if (!isGeneratingTopics) {
                          onGenerateTopics(option.mood)
                        }
                      }}
                    >
                      <Image
                        src={option.asset}
                        className='icebreaker__mood-option-emoji'
                        lazyLoad
                      />
                      <Text className='icebreaker__mood-option-label'>{option.label}</Text>
                      {isActive && (
                        <View className='icebreaker__mood-option-check'>
                          <Text className='icebreaker__mood-option-check-icon'>✓</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
              <Text className='icebreaker__helper-text'>
                {isGeneratingTopics
                  ? `${DEFAULT_MASCOT_DISPLAY_NAME}正在根据你选的氛围出题…`
                  : topicsError
                    ? '选择氛围后点击重试，或者换一个氛围试试。'
                    : `先选一个氛围，${DEFAULT_MASCOT_DISPLAY_NAME}会生成这一轮的话题卡。`}
              </Text>
            </>
          ) : (
            <Text className='icebreaker__helper-text'>
              {selectedMood
                ? `主持人选择了${moodLabel}氛围，正在生成话题卡…`
                : '等待主持人选择今晚的话题氛围…'}
            </Text>
          )
        ) : (
          <>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              className='icebreaker__action-btn'
              onClick={onToggleReady}
              disabled={isUpdatingReady}
              loading={isUpdatingReady}
            >
              {isUpdatingReady ? '提交中…' : isReady ? '取消准备' : '我准备好了'}
            </Button>

            {isHost && everyoneReady && currentIndex < topics.length - 1 ? (
              <Button
                variant='secondary'
                className='icebreaker__action-btn'
                onClick={onNextTopic}
                disabled={isAdvancingTopic}
                loading={isAdvancingTopic}
              >
                {isAdvancingTopic ? '切换中…' : '切换下一题'}
              </Button>
            ) : null}

            {isHost && everyoneReady && currentIndex >= topics.length - 1 ? (
              <Button
                variant='primary'
                className='icebreaker__action-btn'
                onClick={onAdvance}
                disabled={isAdvancing}
                loading={isAdvancing}
              >
                {isAdvancing ? '切换中…' : isCustomMode ? '选择下一个游戏' : '进入下一阶段'}
              </Button>
            ) : null}

            {!isHost && !everyoneReady ? (
              <Text className='icebreaker__helper-text'>
                大家都准备好后，主持人才可以推进下一步。
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}
