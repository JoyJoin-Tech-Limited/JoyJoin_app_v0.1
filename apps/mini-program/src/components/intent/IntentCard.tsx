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
  onClick?: () => void
  iconSize?: number
  /**
   * Layout variant. 'default' is the original centered card (unchanged pixels
   * for pool-registration). 'compact' shrinks min-height/padding for the
   * essential-data 3×2 zero-scroll grid; 'strip' is the full-width horizontal
   * row used for 随缘 (icon left + label/subtitle inline).
   */
  variant?: 'default' | 'compact' | 'strip'
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
  onClick,
  iconSize = 144,
  variant = 'default',
  className = '',
  testId,
}: IntentCardProps) {
  const handleTap = useCallback(() => {
    if (!onClick) return
    haptics('light')
    onClick()
  }, [onClick])

  const variantClass = variant === 'default' ? '' : `intent-card--${variant}`

  return (
    <View
      className={[
        'intent-card',
        variantClass,
        selected ? 'intent-card--selected' : '',
        dimmed ? 'intent-card--dimmed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      hoverClass='intent-card--hover'
      onClick={handleTap}
      role='button'
      aria-pressed={selected}
      aria-label={`${option.label}${option.subtitle ? `：${option.subtitle}` : ''}`}
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
      {variant === 'strip' ? (
        <View className='intent-card__strip-text'>
          <Text className='intent-card__label'>{option.label}</Text>
          {option.subtitle ? <Text className='intent-card__subtitle'>{option.subtitle}</Text> : null}
        </View>
      ) : (
        <>
          <Text className='intent-card__label'>{option.label}</Text>
          {option.subtitle ? <Text className='intent-card__subtitle'>{option.subtitle}</Text> : null}
        </>
      )}
      {selected && <CheckBadge className='intent-card__check' />}
    </View>
  )
}
