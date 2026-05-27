import { View, Text } from '@tarojs/components'
import './InterestChipCloud.scss'

export interface InterestChipCloudProps {
  labels: string[]
  levels?: Record<string, 1 | 2 | 3>
  accent?: boolean
  compact?: boolean
  emptyText?: string
  onEmptyClick?: () => void
  className?: string
}

/**
 * InterestChipCloud — read-only interest chip display used across profile surfaces.
 *
 * Renders a horizontal-wrapping cloud of interest labels as small pills.
 * Optional `levels` prop maps labels to L1/L2/L3 for visual intensity.
 * Used in profile tab, onboarding profile-review, and anywhere else
 * interests are displayed read-only.
 */
export default function InterestChipCloud({
  labels,
  levels,
  accent = false,
  compact = false,
  emptyText,
  onEmptyClick,
  className = '',
}: InterestChipCloudProps) {
  if (labels.length === 0 && !emptyText) {
    return null
  }

  return (
    <View className={`interest-chip-cloud ${className}`}>
      {labels.length === 0 && emptyText ? (
        <View className='interest-chip-cloud__empty' onClick={onEmptyClick}>
          <Text className='interest-chip-cloud__empty-text'>{emptyText}</Text>
          {onEmptyClick && <Text className='interest-chip-cloud__empty-cta'>去添加 ›</Text>}
        </View>
      ) : (
        <View className='interest-chip-cloud__chips'>
          {labels.map((label, index) => {
            const level = levels?.[label]
            return (
              <View
                key={`${label}-${index}`}
                className={[
                  'interest-chip-cloud__chip',
                  accent ? 'interest-chip-cloud__chip--accent' : '',
                  level ? `interest-chip-cloud__chip--level-${level}` : '',
                  compact ? 'interest-chip-cloud__chip--compact' : '',
                ].filter(Boolean).join(' ')}
              >
                <Text className='interest-chip-cloud__chip-text'>{label}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
