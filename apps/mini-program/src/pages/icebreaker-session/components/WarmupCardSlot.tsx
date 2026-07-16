import { useMemo, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker'
import { stripEmojis } from '../../../lib/utils/emojiGuard'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import CardFlip from '../../../components/reveal/CardFlip'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { useTierReveal } from '../../../hooks/useTierReveal'
import { MOOD_OPTIONS, PhaseHeaderIcon } from '../phaseUtils'
import type { WarmupCardState } from '../viewModels/warmupViewModels'
import {
  getDepthCornerText,
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
}

const TOPIC_MOOD_EMOJI: Record<AtmosphereMood, string> = {
  funny: '😂',
  life: '☕',
  relaxed: '✨',
  emotional: '💫',
}

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
}: WarmupCardSlotProps) {
  const aigcEnabled = useAIGCLabelsEnabled()
  const topicAigcMeta = warmupTopicsMeta?.aigc ?? {
    aiGenerated: true,
    labelType: 'ai-generated' as const,
  }
  const currentTopic = topics[currentIndex]
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

  const frontFace = (
    <View className='warmup-card-slot__face warmup-card-slot__face--front'>
      <View className='warmup-card-slot__front'>
        <PhaseHeaderIcon phase='warmup' size={80} />
        <Text className='warmup-card-slot__front-label'>话题卡</Text>
        <Text className='warmup-card-slot__front-sub'>轻轻一点，开启今晚的聊天</Text>
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
            <View className='warmup-card-slot__shimmer' />
            <Text className='warmup-card-slot__generating-text'>
              {DEFAULT_MASCOT_DISPLAY_NAME}正在出题…
            </Text>
          </View>
        )
      case 'error':
        return (
          <View className='warmup-card-slot__content warmup-card-slot__content--centered'>
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
      case 'terminal':
        return (
          <View className='warmup-card-slot__content warmup-card-slot__content--centered'>
            <Text className='warmup-card-slot__terminal-text'>已结束</Text>
            <Text className='warmup-card-slot__terminal-sub'>主持人可以选择进入下一阶段</Text>
          </View>
        )
      case 'topic_card':
      default: {
        if (!currentTopic) {
          return null
        }
        const showDeepPrompt = vibe === 'deep_chat' && currentTopic.promptTiers
        return (
          <View className='warmup-card-slot__content'>
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
              {cornerText && (
                <Text className='warmup-card-slot__corner'>{cornerText}</Text>
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
                size={56}
              />
            </View>

            <Text
              className={`warmup-card-slot__question ${
                isDeepPromptExpanded ? 'warmup-card-slot__question--expanded' : ''
              }`}
            >
              {stripEmojis(currentTopic.question)}
            </Text>

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
                    {isDeepPromptExpanded ? '深聊锦囊 ▼' : '深聊锦囊 ›'}
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
    <View className='warmup-card-slot'>
      <CardFlip
        front={frontFace}
        back={backFace}
        flipped={state === 'topic_card' ? isFlipped : false}
        duration={500}
        reducedMotion={reduceMotion}
      />
    </View>
  )
}
