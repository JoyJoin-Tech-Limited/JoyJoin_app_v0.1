import { View, Text, Slider, Image } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { memo, useState, useCallback, useEffect, useRef } from 'react'
import type { AnswerOption } from './personalityTestLogic'
import Button from '../../../components/ui/Button'
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { resolvePersonalityEmoji, resolvePersonalityIcon } from './emojiAssets'
import { resolveFragmentLabel, getNearestSliderOption } from './personalityTestLogic'
import './PersonalityTestAnswerArea.scss'

export { resolveFragmentLabel, getNearestSliderOption, type AnswerOption } from './personalityTestLogic'

export type QuestionType = 'choice' | 'slider' | 'emoji_tap'

export interface SliderConfig {
  leftLabel: string
  rightLabel: string
  leftEmoji?: string
  rightEmoji?: string
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
  /** Called when the touch point moves while still pressed (cancel preview on scroll/drag) */
  onOptionTouchMove?: (e: any) => void
  /** Committed (pre-filled) answer value for back-review mode */
  committedValue?: string | null
  /** Hide the slider's own submit button (used in back-review mode) */
  hideSliderSubmit?: boolean
}

function splitEmojiLabel(text: string): { emoji: string; label: string } {
  const match = text.match(/^(\S+)\s+(.+)$/)
  if (!match) {
    return { emoji: '', label: text }
  }
  return { emoji: match[1], label: match[2] }
}

interface EmojiTapOptionProps {
  option: AnswerOption
  parts: { emoji: string; label: string }
  iconPath: string | null
  index: number
  isSelected: boolean
  isCommitted: boolean
  isSubmitting: boolean
  selectedValue: string | null
  onTouchStart: () => void
  onTouchEnd: () => void
  onTouchMove?: (e: any) => void
  onClick: () => void
}

function EmojiTapOption({
  option,
  parts,
  iconPath,
  index,
  isSelected,
  isCommitted,
  isSubmitting,
  selectedValue,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onClick,
}: EmojiTapOptionProps) {
  const [hasError, setHasError] = useState(false)
  const showImage = iconPath && !hasError

  return (
    <Button
      className={`answer-area__emoji-option${isSelected ? ' answer-area__emoji-option--selected' : ''}${isCommitted ? ' answer-area__emoji-option--committed' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onClick={onClick}
      disabled={isSubmitting || selectedValue !== null}
      hoverClass='answer-area__emoji-option--active'
    >
      {showImage ? (
        <Image
          className='answer-area__emoji-option-emoji answer-area__emoji-option-emoji--image'
          src={iconPath}
          mode='aspectFit'
          onError={() => setHasError(true)}
        />
      ) : (
        <JoyJoinIcon emoji={parts.emoji || '🎯'} size={32} className='answer-area__emoji-option-emoji' />
      )}
      <Text className='answer-area__emoji-option-text'>{parts.label || option.text}</Text>
    </Button>
  )
}

/** Resolve the slider lean direction based on current value (0-100). */
function resolveSliderLean(
  _sliderConfig: SliderConfig,
  value: number,
): 'left' | 'center' | 'right' {
  if (value <= 35) return 'left'
  if (value >= 65) return 'right'
  return 'center'
}

/** Resolve the live semantic label for the slider based on current value. */
function getSliderLiveLabel(options: AnswerOption[], value: number): string {
  const option = getNearestSliderOption(options, value)
  return option?.text ?? ''
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
  onOptionTouchMove,
  committedValue,
  hideSliderSubmit = false,
}: AnswerAreaProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [fragmentLabel, setFragmentLabel] = useState<string>('')
  const [fragmentVisible, setFragmentVisible] = useState(false)
  const selectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fragmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSliderValueRef = useRef(sliderValue)

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

  // Guard: render fallback when no options are available
  if (options.length === 0) {
    return (
      <View className='answer-area__options'>
        <Text className='answer-area__empty-options'>题目加载中…</Text>
      </View>
    )
  }

  if (questionType === 'slider' && sliderConfig) {
    const lean = resolveSliderLean(sliderConfig, sliderValue)
    const liveLabel = getSliderLiveLabel(options, sliderValue)

    return (
      <View className='answer-area__slider-shell'>
        {/* Live semantic label that reacts to drag */}
        <View className='answer-area__slider-live-badge'>
          <View
            className={`answer-area__slider-live-badge-inner answer-area__slider-live-badge-inner--${lean}`}
          >
            <Text className='answer-area__slider-live-badge-label' numberOfLines={1}>
              {liveLabel || '·'}
            </Text>
            <Text className='answer-area__slider-live-badge-value'>{sliderValue}%</Text>
          </View>
        </View>

        {/* Anchor labels — text only, no emojis */}
        <View className='answer-area__slider-labels'>
          <Text className='answer-area__slider-anchor'>{sliderConfig.leftLabel}</Text>
          <Text className='answer-area__slider-anchor answer-area__slider-anchor--right'>{sliderConfig.rightLabel}</Text>
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
          blockSize={44}
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

        {!hideSliderSubmit && (
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
        )}
      </View>
    )
  }

  if (questionType === 'emoji_tap') {
    // UX guard: labels should be ≤8 CJK characters to avoid 孤字 wrapping in 2-col grid
    return (
      <View className='answer-area__emoji-grid'>
        {options.map((option, index) => {
          const parts = splitEmojiLabel(option.text)
          const isSelected = selectedValue === option.value
          const isCommitted = committedValue === option.value
          // Prefer explicit semantic icon key; fall back to legacy emoji parsing
          const iconPath = option.iconAssetKey
            ? resolvePersonalityIcon(option.iconAssetKey)
            : resolvePersonalityEmoji(parts.emoji)
          return (
            <EmojiTapOption
              key={option.value}
              option={option}
              parts={parts}
              iconPath={iconPath ?? null}
              index={index}
              isSelected={isSelected}
              isCommitted={isCommitted}
              isSubmitting={isSubmitting}
              selectedValue={selectedValue}
              onTouchStart={() => { onOptionTouchStart?.(option) }}
              onTouchEnd={() => { onOptionTouchEnd?.() }}
              onTouchMove={onOptionTouchMove ? (e) => onOptionTouchMove(e) : undefined}
              onClick={() => {
                haptics('light')
                handleAnswer(option)
              }}
            />
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
        const isCommitted = committedValue === option.value
        return (
          <Button
            key={option.value}
            className={`answer-area__option${isSelected ? ' answer-area__option--selected' : ''}${isCommitted ? ' answer-area__option--committed' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
            onTouchStart={() => { onOptionTouchStart?.(option) }}
            onTouchEnd={() => { onOptionTouchEnd?.() }}
            onTouchMove={onOptionTouchMove ? (e) => onOptionTouchMove(e) : undefined}
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
