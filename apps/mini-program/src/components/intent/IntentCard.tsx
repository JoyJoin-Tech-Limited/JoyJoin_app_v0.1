import { View, Text } from '@tarojs/components'
import { useCallback } from 'react'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import CheckBadge from '../ui/CheckBadge'
import { haptics } from '../../lib/utils/haptics'
import './IntentCard.scss'

export interface IntentCardOption {
  value: string
  label: string
  emoji?: string
  subtitle?: string
}

interface IntentCardProps {
  option: IntentCardOption
  selected?: boolean
  dimmed?: boolean
  disabled?: boolean
  onClick?: () => void
  iconSize?: number
  className?: string
  testId?: string
}

/**
 * Shared intent selector card used in onboarding essential-data and pool registration.
 *
 * Renders a branded Lovart icon (via JoyJoinIcon tier='intent'), label, subtitle,
 * and a selection checkmark. Cards are toggle buttons (role='button' with aria-pressed)
 * because intent selection is multi-select.
 */
export default function IntentCard({
  option,
  selected = false,
  dimmed = false,
  disabled = false,
  onClick,
  iconSize = 48,
  className = '',
  testId,
}: IntentCardProps) {
  const handleTap = useCallback(() => {
    if (disabled || !onClick) return
    haptics('light')
    onClick()
  }, [disabled, onClick])

  return (
    <View
      className={[
        'intent-card',
        selected ? 'intent-card--selected' : '',
        dimmed ? 'intent-card--dimmed' : '',
        disabled ? 'intent-card--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      hoverClass={disabled ? '' : 'intent-card--hover'}
      onClick={handleTap}
      role='button'
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`${option.label}${option.subtitle ? `：${option.subtitle}` : ''}${disabled ? '（已达上限）' : ''}`}
      data-testid={testId}
    >
      {option.emoji != null ? (
        <JoyJoinIcon
          emoji={option.emoji}
          tier='intent'
          size={iconSize}
          className='intent-card__icon'
          lazyLoad={false}
        />
      ) : null}
      <Text className='intent-card__label'>{option.label}</Text>
      {option.subtitle ? <Text className='intent-card__subtitle'>{option.subtitle}</Text> : null}
      {selected && <CheckBadge className='intent-card__check' />}
    </View>
  )
}
