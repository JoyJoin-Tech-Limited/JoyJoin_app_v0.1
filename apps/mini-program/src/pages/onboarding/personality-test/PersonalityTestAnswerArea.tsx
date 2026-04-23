import { View, Text, Slider } from '@tarojs/components'
import Button from '../../../components/Button'
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../../../lib/uiConstants'
import { haptics } from '../../../lib/haptics'
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

export default function PersonalityTestAnswerArea({
  questionType,
  options,
  sliderConfig,
  sliderValue,
  isSubmitting,
  onAnswer,
  onSliderChange,
  onSliderSubmit,
}: AnswerAreaProps) {
  if (questionType === 'slider' && sliderConfig) {
    return (
      <View className='answer-area__slider-shell'>
        <View className='answer-area__slider-labels'>
          <View className='answer-area__slider-pill'>
            <Text className='answer-area__slider-pill-emoji'>{sliderConfig.leftEmoji}</Text>
            <Text className='answer-area__slider-pill-text'>{sliderConfig.leftLabel}</Text>
          </View>
          <View className='answer-area__slider-pill answer-area__slider-pill--right'>
            <Text className='answer-area__slider-pill-emoji'>{sliderConfig.rightEmoji}</Text>
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
        {options.map((option) => {
          const parts = splitEmojiLabel(option.text)
          return (
            <Button
              key={option.value}
              className='answer-area__emoji-option'
              onClick={() => {
                haptics('light')
                onAnswer(option)
              }}
              disabled={isSubmitting}
              hoverClass='answer-area__emoji-option--active'
            >
              <Text className='answer-area__emoji-option-emoji'>{parts.emoji}</Text>
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
      {options.map((option) => (
        <Button
          key={option.value}
          className='answer-area__option'
          onClick={() => {
            haptics('light')
            onAnswer(option)
          }}
          disabled={isSubmitting}
          hoverClass='answer-area__option--active'
        >
          <Text className='answer-area__option-text'>{option.text}</Text>
        </Button>
      ))}
    </View>
  )
}

export { getNearestSliderOption }
