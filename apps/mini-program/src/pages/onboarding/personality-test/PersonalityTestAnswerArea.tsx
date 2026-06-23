import { View, Text, Slider, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { AnswerOption } from './personalityTestLogic'
import Button from '../../../components/ui/Button'
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
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

/** Continuously interpolate a hex colour between two stops (t in [0,1]). */
function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '')
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      bl: parseInt(clean.slice(4, 6), 16),
    }
  }
  const c1 = parse(a)
  const c2 = parse(b)
  const clamped = Math.max(0, Math.min(1, t))
  const r = Math.round(c1.r + (c2.r - c1.r) * clamped)
  const g = Math.round(c1.g + (c2.g - c1.g) * clamped)
  const bl = Math.round(c1.bl + (c2.bl - c1.bl) * clamped)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

/**
 * Build a dynamic gradient + transform for the slider live badge so it
 * travels smoothly with the thumb and shifts temperature from cool purple
 * (left) through soft lavender (center) to warm pink (right).
 *
 * When `reducedMotion` is true, positional transform and scale pulse are
 * suppressed so the badge only updates its background colour. This keeps
 * the control functional for users who need reduced motion.
 */
const SLIDER_GRADIENT_STOPS = {
  leftFrom: '#8B5CF6',
  leftTo: '#6366F1',
  centerFrom: '#A78BFA',
  centerTo: '#C4B5FD',
  rightFrom: '#FF6B9D',
  rightTo: '#F472B6',
} as const

function buildSliderBadgeStyle(
  value: number,
  reducedMotion = false,
): { inner: React.CSSProperties; arrow: React.CSSProperties } {
  const t = value / 100
  const drift = reducedMotion ? 0 : ((value - 50) / 50) * 80 // -80rpx .. +80rpx
  const scale = reducedMotion ? 1 : 1 + Math.abs(value - 50) / 50 * 0.04

  const { leftFrom, leftTo, centerFrom, centerTo, rightFrom, rightTo } = SLIDER_GRADIENT_STOPS
  let from: string
  let to: string
  if (t <= 0.5) {
    const local = t / 0.5
    from = lerpHex(leftFrom, centerFrom, local)
    to = lerpHex(leftTo, centerTo, local)
  } else {
    const local = (t - 0.5) / 0.5
    from = lerpHex(centerFrom, rightFrom, local)
    to = lerpHex(centerTo, rightTo, local)
  }

  // Apply transform directly; avoid CSS custom properties because WeChat's
  // base library handles them unreliably. The transform is GPU-composited.
  return {
    inner: {
      transform: reducedMotion ? undefined : `translateX(${drift}rpx) scale(${scale})`,
      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    } as React.CSSProperties,
    arrow: {
      borderTopColor: from,
    },
  }
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
  const [showSliderHint, setShowSliderHint] = useState(true)
  const selectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fragmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSliderValueRef = useRef(sliderValue)
  const lastHapticValueRef = useRef<number | null>(null)
  const hintDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accessibility: suppress continuous spatial motion when reduced motion is requested.
  const reducedMotion = useMemo(() => {
    try {
      const info = Taro.getSystemInfoSync()
      return (info as any).reduceMotion === true
    } catch {
      return false
    }
  }, [])
  const { isDegradation } = useDeviceTier()

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

  const handleSliderChanging = useCallback((event: any) => {
    const val = Number(event.detail.value)
    lastSliderValueRef.current = val
    onSliderChange(val)

    // Dismiss the first-time hint as soon as the user interacts.
    if (showSliderHint) {
      setShowSliderHint(false)
      if (hintDismissTimerRef.current) {
        clearTimeout(hintDismissTimerRef.current)
        hintDismissTimerRef.current = null
      }
    }

    // Tactile feedback: light haptic on every 10-point threshold crossing.
    // Skip on low-end devices and when reduced motion is requested (haptics
    // are a form of motion feedback).
    if (!isDegradation && !reducedMotion) {
      const threshold = Math.round(val / 10)
      if (lastHapticValueRef.current !== threshold) {
        lastHapticValueRef.current = threshold
        haptics('light')
      }
    }
  }, [onSliderChange, showSliderHint, isDegradation, reducedMotion])

  const handleSliderCommit = useCallback((event: any) => {
    const val = Number(event.detail.value)
    if (val !== lastSliderValueRef.current) {
      lastSliderValueRef.current = val
      onSliderChange(val)
    }
  }, [onSliderChange])

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
    const badgeStyles = buildSliderBadgeStyle(sliderValue, reducedMotion)

    return (
      <View className='answer-area__slider-shell'>
        {/* First-time hint for slider usability */}
        {showSliderHint ? (
          <View className='answer-area__slider-hint' aria-hidden='true'>
            <Text className='answer-area__slider-hint-text'>拖动滑块，选择最符合你的程度</Text>
            <View className='answer-area__slider-hint-arrow' />
          </View>
        ) : null}

        {/* Live semantic label that reacts to drag — announced politely to screen readers */}
        <View
          className='answer-area__slider-live-badge'
          aria-live='polite'
          aria-atomic='true'
          aria-label={`当前选择：${liveLabel || '未选择'}，${sliderValue}%`}
        >
          <View
            className={`answer-area__slider-live-badge-inner answer-area__slider-live-badge-inner--${lean}`}
            style={badgeStyles.inner}
          >
            <Text className='answer-area__slider-live-badge-label' numberOfLines={1}>
              {liveLabel || '·'}
            </Text>
            <Text className='answer-area__slider-live-badge-value'>{sliderValue}%</Text>
            <View className='answer-area__slider-live-badge-arrow' style={badgeStyles.arrow} />
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
          onChanging={handleSliderChanging}
          onChange={handleSliderCommit}
          disabled={isSubmitting}
          aria-label='程度选择滑块，从左到右表示程度从低到高'
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
