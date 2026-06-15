import { View } from '@tarojs/components'
import './CheckBadge.scss'

interface CheckBadgeProps {
  className?: string
}

/**
 * Branded circular check badge used for selection indicators.
 * Replaces ad-hoc text glyphs so every selected state is visually consistent.
 */
export default function CheckBadge({ className = '' }: CheckBadgeProps) {
  return (
    <View className={`jj-check-badge ${className}`}>
      <View className='jj-check-badge__mark' />
    </View>
  )
}
