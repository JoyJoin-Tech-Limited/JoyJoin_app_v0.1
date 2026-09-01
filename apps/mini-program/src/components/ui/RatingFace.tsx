import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import {
  RATING_FACES_ORDERED,
  getLocalIconAssetPath,
} from '@joyjoin/shared/iconSystem'
import { haptics } from '../../lib/utils/haptics'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { BRAND_COLORS } from '../../styles/colors'

import './RatingFace.scss'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'

function hexWithAlpha(hex: string, alphaHex: string): string {
  return hex.startsWith('#') ? hex + alphaHex : hex
}

interface FaceErrorState {
  [assetKey: string]: boolean
}

interface RatingFaceProps {
  /** Current selected value (1-5), 0 = none selected */
  value: number
  /** Called when user selects a rating */
  onSelect: (value: number) => void
  /** Whether interaction is disabled */
  disabled?: boolean
}

function getReducedMotion(): boolean {
  try {
    return getSystemReducedMotionCompat()
  } catch {
    return false
  }
}

const REDUCED_MOTION = getReducedMotion()

/** Selected-state glow ring using the brand primary colour at 25% opacity. */
const SELECTED_GLOW = hexWithAlpha(BRAND_COLORS.primary, '40')

const RATING_LABELS = ['非常不满意', '不满意', '一般', '满意', '非常满意']

/**
 * RatingFace — Premium 5-face rating selector for event feedback.
 *
 * Replaces emoji-based star ratings with expressive JoyJoin proprietary
 * face icons. Features:
 * - Tap scale animation (1.0 → 1.15)
 * - Haptic feedback on selection
 * - Selected-state glow ring (brand purple)
 * - Unselected-state subtle opacity dim
 * - Graceful fallback to emoji if assets fail
 */
export default function RatingFace({
  value,
  onSelect,
  disabled = false,
}: RatingFaceProps) {
  const [pressedIndex, setPressedIndex] = useState<number | null>(null)
  const [faceErrors, setFaceErrors] = useState<FaceErrorState>({})

  const markFaceError = useCallback((assetKey: string) => {
    setFaceErrors((prev) => ({ ...prev, [assetKey]: true }))
  }, [])

  const handleTap = useCallback(
    (idx: number) => {
      if (disabled) return
      const ratingValue = idx + 1
      onSelect(ratingValue)

      // Light haptic feedback — routed through the shared haptics util so the
      // mini-program surface stays consistent and respects reduced-motion state.
      haptics('light')
    },
    [disabled, onSelect],
  )

  return (
    <View className='rating-face__container'>
      <View className='rating-face__row'>
        {RATING_FACES_ORDERED.map((mapping, idx) => {
          const isSelected = value === idx + 1
          const isPressed = pressedIndex === idx

          // Resolve asset path. Rating faces are CDN-only in production; the
          // bundled local copies are no longer shipped to save package size.
          let src = ''
          try {
            const path1x = getLocalIconAssetPath(mapping.assetKey, mapping.tier, 1)
            src = cdnAsset(path1x)
          } catch {
            src = ''
          }

          const hasError = faceErrors[mapping.assetKey] || !src

          return (
            <View
              key={mapping.assetKey}
              className={`rating-face__item ${isSelected ? 'rating-face__item--selected' : ''}`}
              style={{
                // Unselected stays legible (0.72, was 0.5 — the wash-out made
                // the five purple faces indistinguishable on device).
                opacity: isSelected ? 1 : 0.72,
                transform: isPressed ? 'scale(1.15)' : isSelected ? 'scale(1.08)' : 'scale(1)',
                boxShadow: isSelected
                  ? `0 0 16rpx 4rpx ${SELECTED_GLOW}`
                  : 'none',
                transition: REDUCED_MOTION ? 'none' : 'transform 150ms ease-out, opacity 200ms ease-out',
              }}
              role='button'
              aria-label={`${RATING_LABELS[idx]}，${idx + 1}分`}
              aria-pressed={isSelected}
              aria-disabled={disabled}
              onClick={() => handleTap(idx)}
              onTouchStart={() => !disabled && setPressedIndex(idx)}
              onTouchEnd={() => setPressedIndex(null)}
            >
              {!hasError ? (
                <Image
                  src={src}
                  className='rating-face__face'
                  onError={() => markFaceError(mapping.assetKey)}
                />
              ) : (
                <Text className='rating-face__emoji'>
                  {mapping.fallbackEmoji}
                </Text>
              )}
            </View>
          )
        })}
      </View>
      {/* Selection caption — the labels existed only in aria-label before;
          sighted users had no word for each face's meaning (2026-07-28). */}
      <Text className='rating-face__caption' aria-live='polite'>
        {value > 0 ? RATING_LABELS[value - 1] : '轻点表情，告诉我们你的感受'}
      </Text>
    </View>
  )
}
