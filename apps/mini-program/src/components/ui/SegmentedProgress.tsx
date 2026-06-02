import { View } from '@tarojs/components'
import './SegmentedProgress.scss'

export type SegmentedProgressVariant = 'duolingo' | 'minimal' | 'dots'

export interface SegmentedProgressProps {
  /** Current progress (0–100) */
  progress: number
  /** Total segments (e.g., 8 for anchor phase) */
  totalSegments: number
  /** Visual variant */
  variant?: SegmentedProgressVariant
  /** Whether to show smooth fill between segments */
  smooth?: boolean
  /** Optional milestone highlight at specific percentages */
  milestone?: number | null
  /** Optional accent color override for filled segments (hex/rgba) */
  accentColor?: string
}

/**
 * SegmentedProgress — Duolingo-style progress bar for onboarding.
 *
 * Pixel specs:
 * - Track height: 12rpx (duolingo), 8rpx (minimal), 16rpx (dots)
 * - Segment gap: 8rpx
 * - Fill gradient: brand gradient
 * - Milestone glow: 0 0 16rpx rgba(139, 92, 246, 0.5)
 */
export default function SegmentedProgress({
  progress,
  totalSegments,
  variant = 'duolingo',
  smooth = false,
  milestone = null,
  accentColor,
}: SegmentedProgressProps) {
  const segments = Array.from({ length: totalSegments }, (_, i) => {
    const segmentProgress = ((i + 1) / totalSegments) * 100
    const isFilled = progress >= segmentProgress
    const isPartial = !isFilled && progress > (i / totalSegments) * 100
    const partialWidth = isPartial
      ? ((progress - (i / totalSegments) * 100) / (100 / totalSegments)) * 100
      : 0
    const isMilestone = milestone !== null && segmentProgress <= milestone && segmentProgress > (milestone || 0) - (100 / totalSegments)

    return {
      isFilled,
      isPartial,
      partialWidth,
      isMilestone,
    }
  })

  const variantClass = `segmented-progress--${variant}`

  return (
    <View className={`segmented-progress ${variantClass}`}>
      {segments.map((seg, i) => (
        <View
          key={i}
          className={`segmented-progress__segment
            ${seg.isFilled ? 'segmented-progress__segment--filled' : ''}
            ${seg.isMilestone ? 'segmented-progress__segment--milestone' : ''}
          `}
          style={seg.isFilled && accentColor ? { background: accentColor } : {}}
        >
          {seg.isPartial && smooth && (
            <View
              className='segmented-progress__partial'
              style={{ width: `${seg.partialWidth}%`, ...(accentColor ? { background: accentColor } : {}) }}
            />
          )}
        </View>
      ))}
    </View>
  )
}
