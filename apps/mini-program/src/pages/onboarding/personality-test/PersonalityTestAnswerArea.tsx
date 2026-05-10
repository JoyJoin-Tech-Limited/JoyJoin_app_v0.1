import { View, Text, Slider, Image } from '@tarojs/components'
import { memo, useState, useCallback, useEffect, useRef } from 'react'
import Button from '../../../components/ui/Button'
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { resolvePersonalityEmoji } from './emojiAssets'
import './PersonalityTestAnswerArea.scss'

export type QuestionType = 'choice' | 'slider' | 'emoji_tap'

export interface AnswerOption {
  value: string
  text: string
  traitScores?: Record<string, number>
}

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
}

function splitEmojiLabel(text: string): { emoji: string; label: string } {
  const match = text.match(/^(\S+)\s+(.+)$/)
  if (!match) {
    return { emoji: '', label: text }
  }
  return { emoji: match[1], label: match[2] }
}

function getNearestSliderOption(
  options: AnswerOption[],
  sliderValue: number,
): AnswerOption | null {
  if (options.length === 0) return null
  return options.reduce<AnswerOption | null>((closest, option) => {
    const match = option.value.match(/(-?\d+)/)
    const optionValue = match ? Number(match[1]) : 50
    if (!closest) return option
    const closestMatch = closest.value.match(/(-?\d+)/)
    const closestValue = closestMatch ? Number(closestMatch[1]) : 50
    return Math.abs(optionValue - sliderValue) < Math.abs(closestValue - sliderValue)
      ? option
      : closest
  }, null)
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
}: AnswerAreaProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const selectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setSelectedValue(option.value)
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
    }
  }, [])

  if (questionType === 'slider' && sliderConfig) {
    return (
      <View className='answer-area__slider-shell'>
        <View className='answer-area__slider-labels'>
          <View className='answer-area__slider-pill'>
            {resolvePersonalityEmoji(sliderConfig.leftEmoji) ? (
              <Image
                className='answer-area__slider-pill-emoji'
                src={cdnAsset(resolvePersonalityEmoji(sliderConfig.leftEmoji)!)}
                mode='aspectFit'
              />
            ) : (
              <Text className='answer-area__slider-pill-emoji'>{sliderConfig.leftEmoji}</Text>
            )}
            <Text className='answer-area__slider-pill-text'>{sliderConfig.leftLabel}</Text>
          </View>
          <View className='answer-area__slider-pill answer-area__slider-pill--right'>
            {resolvePersonalityEmoji(sliderConfig.rightEmoji) ? (
              <Image
                className='answer-area__slider-pill-emoji'
                src={cdnAsset(resolvePersonalityEmoji(sliderConfig.rightEmoji)!)}
                mode='aspectFit'
              />
            ) : (
              <Text className='answer-area__slider-pill-emoji'>{sliderConfig.rightEmoji}</Text>
            )}
            <Text className='answer-area__slider-pill-text'>{sliderConfig.rightLabel}</Text>
          </View>
        </View>

        <Text className='answer-area__slider-value'>{sliderValue}</Text>
        <Slider
          className='answer-area__slider'
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          activeColor={COLOR_PRIMARY}
          backgroundColor={COLOR_PRIMARY_LIGHT}
          blockColor={COLOR_PRIMARY}
          blockSize={22}
          showValue={false}
          onChanging={(event) => onSliderChange(Number(event.detail.value))}
          onChange={(event) => onSliderChange(Number(event.detail.value))}
          disabled={isSubmitting}
        />

        <Button
          variant='brand'
          className='answer-area__slider-submit'
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
              onClick={() => {
                haptics('light')
                handleAnswer(option)
              }}
              disabled={isSubmitting}
              hoverClass='answer-area__emoji-option--active'
            >
              {resolvePersonalityEmoji(parts.emoji) ? (
                <Image
                  className='answer-area__emoji-option-emoji'
                  src={cdnAsset(resolvePersonalityEmoji(parts.emoji)!)}
                  mode='aspectFit'
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
      {options.map((option, index) => {
        const isSelected = selectedValue === option.value
        return (
          <Button
            key={option.value}
            className={`answer-area__option${isSelected ? ' answer-area__option--selected' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => {
              haptics('light')
              handleAnswer(option)
            }}
            disabled={isSubmitting}
            hoverClass='answer-area__option--active'
          >
            <Text className='answer-area__option-text'>{option.text}</Text>
          </Button>
        )
      })}
    </View>
  )
})

export { getNearestSliderOption }
