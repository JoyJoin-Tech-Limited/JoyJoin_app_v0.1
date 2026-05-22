import { View, Text } from '@tarojs/components'
import './Chip.scss'

export interface ChipProps {
  label: string
  meta?: string
  selected?: boolean
  level?: 1 | 2 | 3
  compact?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}

/**
 * Chip — unified tag/pill component for interest tags, filters, and selections.
 *
 * Derives visual language from existing edit-profile and extended-data tag surfaces,
 * unified into a single primitive with wow micro-interactions.
 */
export default function Chip({
  label,
  meta,
  selected = false,
  level,
  compact = false,
  disabled = false,
  className = '',
  onClick,
}: ChipProps) {
  const classes = [
    'chip',
    selected ? 'chip--selected' : '',
    level ? `chip--level-${level}` : '',
    compact ? 'chip--compact' : '',
    disabled ? 'chip--disabled' : '',
    className,
  ].filter(Boolean)

  return (
    <View
      className={classes.join(' ')}
      onClick={disabled ? undefined : onClick}
    >
      {selected && (
        <View className='chip__check'>
          <Text className='chip__check-icon'>✓</Text>
        </View>
      )}
      <Text className='chip__label'>{label}</Text>
      {meta && <Text className='chip__meta'>{meta}</Text>}
    </View>
  )
}
