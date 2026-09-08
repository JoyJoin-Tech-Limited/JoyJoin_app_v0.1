import { View, Text, Slider, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import type { AnswerOption } from './personalityTestLogic'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { resolvePersonalityEmoji, resolvePersonalityIcon } from './emojiAssets'
import { resolveFragmentLabel, getNearestSliderOption } from './personalityTestLogic'
import { getSystemReducedMotionCompat } from '../../../lib/utils/systemInfo'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

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
  /** True once the user has dragged the slider at least once on this question.
   *  Until then the live badge renders neutral so the default 50% doesn't read
   *  as a confirmed choice. */
  sliderTouched?: boolean
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
  onClick,
}: EmojiTapOptionProps) {
  const [hasError, setHasError] = useState(false)
  const showImage = iconPath && !hasError

  return (
    <Button
      className={`answer-area__emoji-option${isSelected ? ' answer-area__emoji-option--selected' : ''}${isCommitted ? ' answer-area__emoji-option--committed' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={() => {
        haptics('light')
        onClick()
      }}
      disabled={isSubmitting}
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

/**
 * Deterministic pill width for the live badge. The badge is absolutely
 * positioned (shrink-to-fit), and H5 measures its webkit-line-clamp label at
 * min-content — so the width is computed from the glyph count instead:
 * CJK glyphs ≈ 34rpx at 32rpx font, latin/punctuation ~0.6×, plus 72rpx
 * horizontal padding. Capped to the SCSS min/max (180–480rpx).
 */
function estimateSliderBadgeWidthRpx(label: string): number {
  let units = 0
  for (const ch of label) {
    units += /[⺀-鿿豈-﫿，。！、；：？「」『』（）—…]/.test(ch) ? 1 : 0.6
  }
  return Math.min(480, Math.max(180, Math.ceil(units * 34) + 72))
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
 * Slider temperature model: the badge, thumb ring, thumb dot, and track fill
 * all shift from cool purple (left) through soft lavender (center) to brand
 * warm coral (right) as the value moves 0 → 100.
 *
 * When `reducedMotion` is requested, positional follow and scale pulses are
 * suppressed so only colour responds. The control stays fully functional.
 */
const SLIDER_GRADIENT_STOPS = {
  leftFrom: '#8B5CF6',
  leftTo: '#6366F1',
  centerFrom: '#A78BFA',
  // #C4B5FD was too pale for the white badge label (~2:1) — the deeper
  // lavender keeps white bold text legible at the centre of the range.
  centerTo: '#A78BFA',
  // Brand coral family (#FF9B85 anchor) — the previous pink stops
  // (#FF6B9D/#F472B6) sat off the JoyJoin palette.
  rightFrom: '#FF8A6B',
  rightTo: '#FF9B85',
} as const

// Fixed full-track gradient for the custom fill layer. background-size is set
// to the measured track width so any fill percentage shows the correct slice
// (cool indigo left → lavender center → warm coral right).
const SLIDER_TRACK_GRADIENT = `linear-gradient(90deg, ${SLIDER_GRADIENT_STOPS.leftTo} 0%, ${SLIDER_GRADIENT_STOPS.centerFrom} 45%, ${SLIDER_GRADIENT_STOPS.rightTo} 100%)`

// The native Slider stays as the gesture layer with an invisible 44px block
// (fat touch target); the visual thumb is ours. Its thumb centre travels
// inset by half the block size, so the custom thumb/fill use the same math.
const NATIVE_BLOCK_HALF_PX = 22
const FALLBACK_TRACK_WIDTH_PX = 343

// Untouched-slider neutrals — the default midpoint must not read as a choice.
const SLIDER_NEUTRAL_BADGE_BG = 'linear-gradient(135deg, #9CA3AF 0%, #B7BEC9 100%)'
const SLIDER_NEUTRAL_ARROW = '#9CA3AF'
const SLIDER_NEUTRAL_RING = '#D8DDE6'
const SLIDER_NEUTRAL_DOT = '#B7BEC9'
const SLIDER_NEUTRAL_FILL = '#D8DDE6'

function resolveSliderTemperature(value: number): { from: string; to: string } {
  const t = value / 100
  const { leftFrom, leftTo, centerFrom, centerTo, rightFrom, rightTo } = SLIDER_GRADIENT_STOPS
  if (t <= 0.5) {
    const local = t / 0.5
    return {
      from: lerpHex(leftFrom, centerFrom, local),
      to: lerpHex(leftTo, centerTo, local),
    }
  }
  const local = (t - 0.5) / 0.5
  return {
    from: lerpHex(centerFrom, rightFrom, local),
    to: lerpHex(centerTo, rightTo, local),
  }
}

// The first-time slider hint shows once per session, not per question — the
// answer subtree remounts as questions change, so dismissal is kept at module
// level to survive those remounts.
let sliderHintDismissedThisSession = false

export default memo(function PersonalityTestAnswerArea({
  questionType,
  options,
  sliderConfig,
  sliderValue,
  isSubmitting,
  onAnswer,
  onSliderChange,
  onSliderSubmit,
  sliderTouched = false,
  committedValue,
  hideSliderSubmit = false,
}: AnswerAreaProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [fragmentLabel, setFragmentLabel] = useState<string>('')
  const [fragmentVisible, setFragmentVisible] = useState(false)
  const [showSliderHint, setShowSliderHint] = useState(() => !sliderHintDismissedThisSession)
  // Slider drag lifecycle: while dragging, badge/thumb follow the finger with
  // no transition lag; on release the transition springs them to rest.
  const [isSliderDragging, setIsSliderDragging] = useState(false)
  // Measured px width of the slider stage so the badge/tooltip can track the
  // real thumb position precisely (percent-based positioning can't express
  // the native block inset). Falls back to a 375pt-design estimate.
  const [sliderTrackWidth, setSliderTrackWidth] = useState<number | null>(null)
  // WS-3 slider endpoint icons: per-icon error state — on CDN failure the
  // icon hides but its shell keeps the 48rpx layout slot (no shift).
  const [leftAnchorIconError, setLeftAnchorIconError] = useState(false)
  const [rightAnchorIconError, setRightAnchorIconError] = useState(false)
  const selectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fragmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSliderValueRef = useRef(sliderValue)
  const lastHapticValueRef = useRef<number | null>(null)
  const lastSliderOptionRef = useRef<string | null>(null)

  // Accessibility: suppress continuous spatial motion when reduced motion is requested.
  const reducedMotion = useMemo(() => {
    try {
      return getSystemReducedMotionCompat()
    } catch {
      return false
    }
  }, [])
  const { isDegradation } = useDeviceTier()

  // Reset selection when question changes
  useEffect(() => {
    setSelectedValue(null)
    setIsSliderDragging(false)
    lastSliderOptionRef.current = null
    lastSliderValueRef.current = 50
    lastHapticValueRef.current = null
    if (selectedTimeoutRef.current) {
      clearTimeout(selectedTimeoutRef.current)
      selectedTimeoutRef.current = null
    }
  }, [options, questionType])

  // Submit mid-drag must not leave the thumb latched at grab scale with
  // transitions off (WeChat may not fire onChange when disabled flips).
  useEffect(() => {
    if (isSubmitting) {
      setIsSliderDragging(false)
    }
  }, [isSubmitting])

  // Measure the slider stage width (px) so the tooltip badge can track the
  // real thumb centre. Guarded: the vitest Taro mock has no selector query.
  useEffect(() => {
    if (questionType !== 'slider') return
    if (typeof (Taro as any).createSelectorQuery !== 'function') return
    let cancelled = false
    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select('.answer-area__slider-stage')
        .boundingClientRect((rect: any) => {
          if (cancelled) return
          const w = Array.isArray(rect) ? rect[0]?.width : rect?.width
          if (typeof w === 'number' && w > 0) {
            setSliderTrackWidth(w)
          }
        })
        .exec()
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [questionType])

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
    setIsSliderDragging(true)
    onSliderChange(val)

    // Dismiss the first-time hint as soon as the user interacts (session-scoped).
    if (showSliderHint) {
      sliderHintDismissedThisSession = true
      setShowSliderHint(false)
    }

    // Tactile feedback: a firmer tick when the drag crosses into a different
    // semantic answer option, plus light ticks on every 10-point threshold.
    // Skip on low-end devices and when reduced motion is requested (haptics
    // are a form of motion feedback).
    if (!isDegradation && !reducedMotion) {
      const prevOption = lastSliderOptionRef.current
      const nextOption = getNearestSliderOption(options, val)
      const optionChanged = nextOption != null && prevOption !== null && nextOption.value !== prevOption
      if (nextOption) {
        lastSliderOptionRef.current = nextOption.value
      }
      if (optionChanged) {
        haptics('medium')
      } else {
        const threshold = Math.round(val / 10)
        if (lastHapticValueRef.current !== threshold) {
          lastHapticValueRef.current = threshold
          haptics('light')
        }
      }
    }
  }, [onSliderChange, showSliderHint, isDegradation, reducedMotion, options])

  const handleSliderCommit = useCallback((event: any) => {
    const val = Number(event.detail.value)
    setIsSliderDragging(false)
    // A tap on the track can fire onChange without onChanging; clear the hint
    // so it never outlives a real user choice.
    if (showSliderHint) {
      sliderHintDismissedThisSession = true
      setShowSliderHint(false)
    }
    // Always forward the commit — even when the value didn't move. A track
    // tap at the current position is still a deliberate interaction, and the
    // parent gates 下一题 on hasSliderInteracted.
    lastSliderValueRef.current = val
    onSliderChange(val)
  }, [onSliderChange, showSliderHint])

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
    const neutral = !sliderTouched
    const temperature = resolveSliderTemperature(sliderValue)

    // Thumb-centre geometry mirrors the native slider: the (invisible) 44px
    // block travels inset by half its size from each end of the track.
    const trackWidthPx = sliderTrackWidth ?? FALLBACK_TRACK_WIDTH_PX
    const thumbX = NATIVE_BLOCK_HALF_PX + (trackWidthPx - NATIVE_BLOCK_HALF_PX * 2) * (sliderValue / 100)
    // Keep the tooltip badge on screen at the extremes: clamp its centre to
    // the pill's own half-width (rpx → px via the 686rpx content-width scale).
    const badgeLabel = sliderTouched ? liveLabel || '·' : '拖一拖，选一个程度'
    const badgeWidthRpx = estimateSliderBadgeWidthRpx(badgeLabel)
    // rpx → px via the 686rpx content-width scale. Inline rpx is silently
    // dropped by the H5 style parser, so the pill width is always set in px.
    const badgeWidthPx = Math.round(badgeWidthRpx * (trackWidthPx / 686))
    const badgeClamp = Math.min(140, Math.max(64, Math.round(badgeWidthPx / 2)))
    const badgeX = reducedMotion
      ? trackWidthPx / 2
      : Math.min(trackWidthPx - badgeClamp, Math.max(badgeClamp, thumbX))
    // When the badge is edge-clamped it detaches from the thumb — slide the
    // arrow so it keeps pointing at the real thumb position.
    const arrowDelta = Math.max(-60, Math.min(60, thumbX - badgeX))
    const badgeScale = reducedMotion
      ? 1
      : 1 + (Math.abs(sliderValue - 50) / 50) * 0.04 + (isSliderDragging ? 0.03 : 0)
    const thumbScale = reducedMotion || isDegradation ? 1 : isSliderDragging ? 1.15 : 1

    return (
      <View className='answer-area__slider-shell'>
        {/* First-time hint for slider usability */}
        {showSliderHint ? (
          <View className='answer-area__slider-hint' aria-hidden='true'>
            <Text className='answer-area__slider-hint-text'>拖动滑块，选择最符合你的程度</Text>
            <View className='answer-area__slider-hint-arrow' />
          </View>
        ) : null}

        {/* Live semantic label that tracks the thumb — announced politely to
            screen readers. Until the first drag it stays neutral so the
            default 50% doesn't read as a confirmed choice. */}
        <View
          className='answer-area__slider-live-badge'
          aria-live='polite'
          aria-atomic='true'
          aria-label={sliderTouched ? `当前选择：${liveLabel || '未选择'}，${sliderValue}%` : '尚未选择，拖动滑块告诉我你的感觉'}
        >
          <View
            className={`answer-area__slider-live-badge-inner answer-area__slider-live-badge-inner--${lean}${isSliderDragging ? ' answer-area__slider-live-badge-inner--dragging' : ''}`}
            style={{
              left: `${badgeX}px`,
              width: `${badgeWidthPx}px`,
              transform: `translate(-50%, -50%) scale(${badgeScale})`,
              background: neutral
                ? SLIDER_NEUTRAL_BADGE_BG
                : `linear-gradient(135deg, ${temperature.from} 0%, ${temperature.to} 100%)`,
            }}
          >
            <Text className='answer-area__slider-live-badge-label' numberOfLines={2}>
              {badgeLabel}
            </Text>
            {sliderTouched ? (
              <Text className='answer-area__slider-live-badge-value'>{sliderValue}%</Text>
            ) : null}
            <View
              className='answer-area__slider-live-badge-arrow'
              style={{
                borderTopColor: neutral ? SLIDER_NEUTRAL_ARROW : temperature.from,
                transform: `translateX(calc(-50% + ${arrowDelta}px))`,
              }}
            />
          </View>
        </View>

        {/* Anchor columns: endpoint icon + label, lean-reactive (WS-3,
            2026-09-02). Keys are hardcoded — one slider question exists, so
            no shared-type change. Scale is gated off under reduced-motion /
            degradation tier (colour + opacity still respond). */}
        <View className='answer-area__slider-labels'>
          {([
            {
              side: 'left' as const,
              label: sliderConfig.leftLabel,
              iconUrl: resolvePersonalityIcon('soloRest'),
              hasError: leftAnchorIconError,
              onIconError: () => setLeftAnchorIconError(true),
            },
            {
              side: 'right' as const,
              label: sliderConfig.rightLabel,
              iconUrl: resolvePersonalityIcon('partyReady'),
              hasError: rightAnchorIconError,
              onIconError: () => setRightAnchorIconError(true),
            },
          ]).map((anchor) => (
            <View
              key={anchor.side}
              className={[
                'answer-area__slider-anchor',
                `answer-area__slider-anchor--${anchor.side}`,
                lean === anchor.side ? 'answer-area__slider-anchor--leaning' : '',
                lean !== 'center' && lean !== anchor.side ? 'answer-area__slider-anchor--dimmed' : '',
              ].filter(Boolean).join(' ')}
            >
              <View className='answer-area__slider-anchor-icon-shell' aria-hidden='true'>
                {anchor.iconUrl && !anchor.hasError ? (
                  <Image
                    className={`answer-area__slider-anchor-icon${lean === anchor.side && !reducedMotion && !isDegradation ? ' answer-area__slider-anchor-icon--leaning-scale' : ''}`}
                    src={anchor.iconUrl}
                    mode='aspectFit'
                    onError={anchor.onIconError}
                  />
                ) : null}
              </View>
              <Text className='answer-area__slider-anchor-label'>{anchor.label}</Text>
            </View>
          ))}
        </View>

        {/* Custom track + thumb visuals layered under the native Slider. The
            native element keeps its (transparent) 44px block as a generous
            gesture target; all painting is ours so the fill can carry the
            temperature gradient and the thumb can scale on grab/release. */}
        <View className={`answer-area__slider-stage${isSubmitting ? ' answer-area__slider-stage--disabled' : ''}`}>
          <View className='answer-area__slider-rail' aria-hidden='true' />
          <View
            className='answer-area__slider-fill'
            aria-hidden='true'
            style={{
              width: `${thumbX}px`,
              background: neutral ? SLIDER_NEUTRAL_FILL : SLIDER_TRACK_GRADIENT,
              backgroundSize: `${trackWidthPx}px 100%`,
            }}
          />
          <View
            className={`answer-area__slider-thumb${isSliderDragging ? ' answer-area__slider-thumb--dragging' : ''}`}
            style={{
              left: `${thumbX}px`,
              transform: `translate(-50%, -50%) scale(${thumbScale})`,
            }}
            aria-hidden='true'
          >
            <View
              className='answer-area__slider-thumb-ring'
              style={{
                background: neutral
                  ? SLIDER_NEUTRAL_RING
                  : `linear-gradient(135deg, ${temperature.from} 0%, ${temperature.to} 100%)`,
              }}
            >
              <View className='answer-area__slider-thumb-core'>
                <View
                  className='answer-area__slider-thumb-dot'
                  style={{ backgroundColor: neutral ? SLIDER_NEUTRAL_DOT : temperature.from }}
                />
              </View>
            </View>
          </View>
          <Slider
            className='answer-area__slider'
            min={0}
            max={100}
            step={1}
            value={sliderValue}
            activeColor='rgba(0, 0, 0, 0)'
            backgroundColor='rgba(0, 0, 0, 0)'
            blockColor='rgba(0, 0, 0, 0)'
            blockSize={44}
            showValue={false}
            onChanging={handleSliderChanging}
            onChange={handleSliderCommit}
            disabled={isSubmitting}
            aria-label={`程度选择滑块，最左边是${sliderConfig.leftLabel}，最右边是${sliderConfig.rightLabel}，从左到右表示程度从低到高`}
          />
        </View>

        {!hideSliderSubmit && (
          <Button
            variant='brand'
            className='answer-area__slider-submit'
            onClick={() => {
              haptics('light')
              onSliderSubmit()
            }}
            // Untouched slider must not submit the default 50% silently —
            // same gate the parent applies to 下一题 via hasSliderInteracted.
            disabled={isSubmitting || !sliderTouched}
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
