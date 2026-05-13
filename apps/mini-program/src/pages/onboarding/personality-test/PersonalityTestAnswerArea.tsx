import { View, Text, Slider, Image } from '@tarojs/components'
import { memo, useState, useCallback, useEffect, useRef } from 'react'
import Button from '../../../components/ui/Button'
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { resolvePersonalityEmoji } from './emojiAssets'
import { resolveFragmentLabel, type AnswerOption } from './personalityTestLogic'
import './PersonalityTestAnswerArea.scss'

export { resolveFragmentLabel, getNearestSliderOption, type AnswerOption } from './personalityTestLogic'

export type QuestionType = 'choice' | 'slider' | 'emoji_tap'

export interface SliderConfig {
  leftLabel: string
  rightLabel: string
  leftEmoji: string
  rightEmoji: string
}

export interface AnswerAreaProps {
  questionType: QuestionType
  options: AnswerOption[]
  sliderConfig?: SliderConfig
  sliderValue: number
  isSubmitting: boolean
  onAnswer: (option: AnswerOption) => void
  onSliderChange: (value: number) => void
  onSliderSubmit: () => void
  /** Called when user touches an option (for reactive mascot preview) */
  onOptionTouchStart?: (option: AnswerOption) => void
  /** Called when user releases an option touch */
  onOptionTouchEnd?: () => void
}

function splitEmojiLabel(text: string): { emoji: string; label: string } {
  const match = text.match(/^(\S+)\s+(.+)$/)
  if (!match) {
    return { emoji: '', label: text }
  }
  return { emoji: match[1], label: match[2] }
}

/** Resolve a dynamic emoji for the slider based on current value (0-100).
 *  Center zone (36–64) reuses leftEmoji visually; there is no neutral emoji in SliderConfig.
 */
function resolveSliderDynamicEmoji(
  sliderConfig: SliderConfig,
  value: number,
): { emoji: string; lean: 'left' | 'center' | 'right' } {
  if (value <= 35) {
    return { emoji: sliderConfig.leftEmoji, lean: 'left' }
  }
  if (value >= 65) {
    return { emoji: sliderConfig.rightEmoji, lean: 'right' }
  }
  // No neutral emoji available — visually center the left-side icon
  return { emoji: sliderConfig.leftEmoji, lean: 'center' }
}

export default memo(function PersonalityTestAnswerArea({
  questionType,
  options,
  sliderConfig,
  sliderValue,
  isSubmitting,
  onAnswer,
  onSliderChange,
  onSliderSubmit,
  onOptionTouchStart,
  onOptionTouchEnd,
}: AnswerAreaProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [fragmentLabel, setFragmentLabel] = useState<string>('')
  const [fragmentVisible, setFragmentVisible] = useState(false)
  const selectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fragmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSliderValueRef = useRef(sliderValue)

  // Guard: render fallback when no options are available
  if (options.length === 0) {
    return (
      <View className='answer-area__options'>
        <Text className='answer-area__empty-options'>题目加载中，请稍候…</Text>
      </View>
    )
  }

  // Reset selection when question changes
  useEffect(() => {
    setSelectedValue(null)
    if (selectedTimeoutRef.current) {
      clearTimeout(selectedTimeoutRef.current)
      selectedTimeoutRef.current = null
    }
  }, [options, questionType])

  const handleAnswer = useCallback((option: AnswerOption) => {
    if (selectedTimeoutRef.current) {
      clearTimeout(selectedTimeoutRef.current)
    }
    if (fragmentTimeoutRef.current) {
      clearTimeout(fragmentTimeoutRef.current)
    }
    setSelectedValue(option.value)

    // Trigger trait fragment reveal (pooled single node, 400ms)
    const label = resolveFragmentLabel(option)
    setFragmentLabel(label)
    setFragmentVisible(true)
    fragmentTimeoutRef.current = setTimeout(() => {
      setFragmentVisible(false)
      fragmentTimeoutRef.current = null
    }, 400)

    onAnswer(option)
    // Clear selection flash after 300ms
    selectedTimeoutRef.current = setTimeout(() => {
      setSelectedValue(null)
      selectedTimeoutRef.current = null
    }, 300)
  }, [onAnswer])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (selectedTimeoutRef.current) {
        clearTimeout(selectedTimeoutRef.current)
      }
      if (fragmentTimeoutRef.current) {
        clearTimeout(fragmentTimeoutRef.current)
      }
    }
  }, [])

  if (questionType === 'slider' && sliderConfig) {
    const dynamicEmoji = resolveSliderDynamicEmoji(sliderConfig, sliderValue)
    const leftEmojiResolved = resolvePersonalityEmoji(sliderConfig.leftEmoji)
    const rightEmojiResolved = resolvePersonalityEmoji(sliderConfig.rightEmoji)
    const dynamicEmojiResolved = resolvePersonalityEmoji(dynamicEmoji.emoji)

    return (
      <View className='answer-area__slider-shell'>
        {/* Dynamic emotion that reacts to drag */}
        <View className='answer-area__slider-dynamic-emoji'>
          <View
            className={`answer-area__slider-dynamic-emoji-inner answer-area__slider-dynamic-emoji-inner--${dynamicEmoji.lean}`}
          >
            {dynamicEmojiResolved ? (
              <Image
                key={dynamicEmoji.emoji}
                className='answer-area__slider-dynamic-emoji-img'
                src={cdnAsset(dynamicEmojiResolved)}
                mode='aspectFit'
              />
            ) : (
              <Text key={dynamicEmoji.emoji} className='answer-area__slider-dynamic-emoji-text'>
                {dynamicEmoji.emoji}
              </Text>
            )}
          </View>
        </View>

        <View className='answer-area__slider-labels'>
          <View className='answer-area__slider-pill'>
            {leftEmojiResolved ? (
              <Image
                className='answer-area__slider-pill-emoji'
                src={cdnAsset(leftEmojiResolved)}
                mode='aspectFit'
                style={{ width: '36rpx', height: '36rpx' }}
              />
            ) : (
              <Text className='answer-area__slider-pill-emoji'>{sliderConfig.leftEmoji}</Text>
            )}
            <Text className='answer-area__slider-pill-text'>{sliderConfig.leftLabel}</Text>
          </View>
          <View className='answer-area__slider-pill answer-area__slider-pill--right'>
            {rightEmojiResolved ? (
              <Image
                className='answer-area__slider-pill-emoji'
                src={cdnAsset(rightEmojiResolved)}
                mode='aspectFit'
                style={{ width: '36rpx', height: '36rpx' }}
              />
            ) : (
              <Text className='answer-area__slider-pill-emoji'>{sliderConfig.rightEmoji}</Text>
            )}
            <Text className='answer-area__slider-pill-text'>{sliderConfig.rightLabel}</Text>
          </View>
        </View>

        <Slider
          className='answer-area__slider'
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          activeColor={COLOR_PRIMARY}
          backgroundColor={COLOR_PRIMARY_LIGHT}
          blockColor={COLOR_PRIMARY}
          blockSize={28}
          showValue={false}
          onChanging={(event) => {
            const val = Number(event.detail.value)
            lastSliderValueRef.current = val
            onSliderChange(val)
          }}
          onChange={(event) => {
            const val = Number(event.detail.value)
            if (val !== lastSliderValueRef.current) {
              onSliderChange(val)
            }
          }}
          disabled={isSubmitting}
        />

        <Button
          variant='brand'
          className='answer-area__slider-submit'
          onTouchStart={() => { onOptionTouchStart?.({ value: 'slider', text: '确认这个感觉' }) }}
          onTouchEnd={() => { onOptionTouchEnd?.() }}
          onClick={() => {
            haptics('light')
            onSliderSubmit()
          }}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : '确认这个感觉'}
        </Button>
      </View>
    )
  }

  if (questionType === 'emoji_tap') {
    return (
      <View className='answer-area__emoji-grid'>
        {options.map((option, index) => {
          const parts = splitEmojiLabel(option.text)
          const isSelected = selectedValue === option.value
          return (
            <Button
              key={option.value}
              className={`answer-area__emoji-option${isSelected ? ' answer-area__emoji-option--selected' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
              onTouchStart={() => { onOptionTouchStart?.(option) }}
              onTouchEnd={() => { onOptionTouchEnd?.() }}
              onClick={() => {
                haptics('light')
                handleAnswer(option)
              }}
              disabled={isSubmitting || selectedValue !== null}
              hoverClass='answer-area__emoji-option--active'
            >
              {resolvePersonalityEmoji(parts.emoji) ? (
                <Image
                  className='answer-area__emoji-option-emoji'
                  src={cdnAsset(resolvePersonalityEmoji(parts.emoji)!)}
                  mode='aspectFit'
                  style={{ width: '64rpx', height: '64rpx' }}
                />
              ) : (
                <Text className='answer-area__emoji-option-emoji'>{parts.emoji}</Text>
              )}
              <Text className='answer-area__emoji-option-text'>{parts.label}</Text>
            </Button>
          )
        })}
      </View>
    )
  }

  // Default: choice
  return (
    <View className='answer-area__options'>
      {/* Trait fragment reveal — pooled single node, 400ms */}
      <View
        className={`answer-area__fragment${fragmentVisible ? ' answer-area__fragment--visible' : ''}`}
        aria-hidden={!fragmentVisible}
      >
        <Text className='answer-area__fragment-text'>{fragmentLabel}</Text>
      </View>
      {options.map((option, index) => {
        const isSelected = selectedValue === option.value
        return (
          <Button
            key={option.value}
            className={`answer-area__option${isSelected ? ' answer-area__option--selected' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
            onTouchStart={() => { onOptionTouchStart?.(option) }}
            onTouchEnd={() => { onOptionTouchEnd?.() }}
            onClick={() => {
              haptics('light')
              handleAnswer(option)
            }}
            disabled={isSubmitting || selectedValue !== null}
            hoverClass='answer-area__option--active'
          >
            <Text className='answer-area__option-text'>{option.text}</Text>
          </Button>
        )
      })}
    </View>
  )
})
