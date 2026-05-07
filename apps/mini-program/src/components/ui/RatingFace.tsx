import { View, Image, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import {
  RATING_FACES_ORDERED,
  getIconAssetPath,
} from '@joyjoin/shared/iconSystem'
import './RatingFace.scss'

interface RatingFaceProps {
  /** Current selected value (1-5), 0 = none selected */
  value: number
  /** Called when user selects a rating */
  onSelect: (value: number) => void
  /** Whether interaction is disabled */
  disabled?: boolean
}

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

  const handleTap = useCallback(
    (idx: number) => {
      if (disabled) return
      const ratingValue = idx + 1
      onSelect(ratingValue)

      // Light haptic feedback
      try {
        Taro.vibrateShort({ type: 'light' })
      } catch {
        // Haptic not available — silently ignore
      }
    },
    [disabled, onSelect],
  )

  return (
    <View className='rating-face__container'>
      {RATING_FACES_ORDERED.map((mapping, idx) => {
        const isSelected = value === idx + 1
        const isPressed = pressedIndex === idx
        const sizeRpx = 64
        const sizeStr = `${sizeRpx}rpx`

        // Resolve asset path
        let src: string | null = null
        try {
          const path1x = getIconAssetPath(mapping.assetKey, mapping.tier, 1)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          src = require(path1x) as string
        } catch {
          src = null
        }

        return (
          <View
            key={mapping.assetKey}
            className={`rating-face__item ${isSelected ? 'rating-face__item--selected' : ''}`}
            style={{
              width: `${sizeRpx + 24}rpx`,
              height: `${sizeRpx + 24}rpx`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              opacity: isSelected ? 1 : 0.5,
              transform: isPressed ? 'scale(1.15)' : isSelected ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 150ms ease-out, opacity 200ms ease-out',
              boxShadow: isSelected
                ? '0 0 16rpx 4rpx rgba(139, 92, 246, 0.25)'
                : 'none',
            }}
            onClick={() => handleTap(idx)}
            onTouchStart={() => setPressedIndex(idx)}
            onTouchEnd={() => setPressedIndex(null)}
          >
            {src ? (
              <Image
                src={src}
                style={{
                  width: sizeStr,
                  height: sizeStr,
                }}
                lazyLoad
              />
            ) : (
              <Text style={{ fontSize: sizeStr, lineHeight: sizeStr }}>
                {mapping.fallbackEmoji}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}
