import { View, Text } from '@tarojs/components'
// NOTE: the stylesheet is NOT imported here. Chip is used by four page entries
// (icebreaker-session, profile-linked/edit-profile, event-feedback and, via
// ProfessionChatOverlay, onboarding/essential-data), and a CSS module reached by
// more than one page entry is hoisted into the root common.wxss — i.e. charged
// against the 2 MB MAIN package budget. Each consuming page `@use`s Chip.scss so
// the rules compile into that page's own subpackage WXSS.

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
  /** Forwarded to the root View as `aria-label` (WeChat a11y). */
  ariaLabel?: string
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
  ariaLabel,
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
      aria-label={ariaLabel}
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
