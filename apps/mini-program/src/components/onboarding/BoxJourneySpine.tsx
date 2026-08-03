import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import './BoxJourneySpine.scss'

/**
 * BoxJourneySpine — the 装盒进度 macro-journey spine for onboarding
 * steps 6–8 (essential-data → extended-data → profile-review).
 *
 * A small blind box that visibly fills (scaleY N/3) and seals (lid closes +
 * landed-gold glow dot) as the user progresses, paired with a status line.
 * It owns the MACRO journey (3 onboarding steps); FormStepper keeps the
 * MICRO steps inside essential-data. Tint follows the user's archetype so
 * the screen keeps "knowing who you are" after the reveal.
 *
 * Subpackage WXSS trap (AGENTS §15): pages that render this component MUST
 * also `@use` BoxJourneySpine.scss in their own page SCSS.
 */

export type BoxJourneyStep = 1 | 2 | 3

interface BoxJourneySpineProps {
  step: BoxJourneyStep
  /** Archetype accent (contrast-safe); falls back to brand primary. */
  accentColor?: string
  className?: string
}

const SPINE_COPY: Record<BoxJourneyStep, { status: string; fraction: string; hint: string }> = {
  1: { status: '装盒中 · ', fraction: '第 1 格', hint: '约 2 分钟' },
  2: { status: '装盒中 · ', fraction: '第 2 格', hint: '约 1 分钟' },
  3: { status: '装盒完成 · ', fraction: '准备开盒', hint: '' },
}

const DEFAULT_ACCENT = '#8B5CF6'

function readIsShortScreen(): boolean {
  try {
    const wi = Taro.getWindowInfo?.()
    if (wi && typeof wi.windowHeight === 'number') return wi.windowHeight < 640
  } catch {
    /* ignore */
  }
  try {
    const s = Taro.getSystemInfoSync()
    if (typeof s.windowHeight === 'number') return s.windowHeight < 640
  } catch {
    /* ignore */
  }
  return false
}

export default function BoxJourneySpine({ step, accentColor, className = '' }: BoxJourneySpineProps) {
  const [isShortScreen, setIsShortScreen] = useState(false)
  const [reduceMotion] = useState(() => getSystemReducedMotion())

  useEffect(() => {
    setIsShortScreen(readIsShortScreen())
  }, [])

  const copy = SPINE_COPY[step]
  const tint = accentColor || DEFAULT_ACCENT
  const rootClass = [
    'box-journey-spine',
    `box-journey-spine--step-${step}`,
    isShortScreen ? 'box-journey-spine--short' : '',
    reduceMotion ? 'box-journey-spine--rm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass}>
      <View className='box-journey-spine__box' aria-hidden='true'>
        {/* Fill: animates from scaleY(0) to the inline step value on mount
            (keyframes carry only `from`; the inline style owns the target). */}
        <View
          className='box-journey-spine__box-fill'
          style={{
            background: tint,
            transform: `scaleY(${(step / 3).toFixed(3)})`,
          }}
        />
        <View className='box-journey-spine__box-lid' />
        {step === 3 ? <View className='box-journey-spine__glow-dot' /> : null}
      </View>
      <Text className='box-journey-spine__text'>
        {copy.status}
        <Text className='box-journey-spine__fraction'>{copy.fraction}</Text>
        {!isShortScreen && copy.hint ? (
          <Text className='box-journey-spine__hint'> · {copy.hint}</Text>
        ) : null}
      </Text>
    </View>
  )
}
