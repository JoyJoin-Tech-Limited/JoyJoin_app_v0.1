import { View, Text } from '@tarojs/components'
import './Chip.scss'

export interface ChipProps {
  label: string
  meta?: string
  selected?: boolean
  level?: 1 | 2 | 3
  /**
   * Heat mode — reinterpret `level` as interest heat (L1 感兴趣 / L2 很热衷 /
   * L3 必聊项) and render the canonical heat palette (extended-data
   * --jj-heat-l1..l3) instead of the generic purple intensity escalation.
   * Use for interest-heat selectors only; difficulty/other level semantics
   * (e.g. PersonalityDice) keep the default styling.
   */
  heat?: boolean
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
  heat = false,
  compact = false,
  disabled = false,
  className = '',
  onClick,
}: ChipProps) {
  const classes = [
    'chip',
    selected ? 'chip--selected' : '',
    level ? `chip--level-${level}` : '',
    heat ? 'chip--heat' : '',
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
