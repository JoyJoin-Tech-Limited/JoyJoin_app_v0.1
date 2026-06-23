import { View, Text } from '@tarojs/components'
import { type ReactNode } from 'react'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import './SelectableTile.scss'

export interface SelectableTileProps {
  id?: string
  selected: boolean
  onClick: () => void
  label: string
  variant: 'compact' | 'large' | 'row'
  checkmark?: boolean
  disabled?: boolean
  loading?: boolean
  pending?: boolean
  icon?: ReactNode
  children?: ReactNode
  ariaLabel?: string
}

export default function SelectableTile({
  id,
  selected,
  onClick,
  label,
  variant,
  checkmark = true,
  disabled = false,
  loading = false,
  pending = false,
  icon,
  children,
  ariaLabel,
}: SelectableTileProps) {
  const isCard = variant === 'compact' || variant === 'large'
  const { isPrimary } = useDeviceTier()

  return (
    <View
      id={id}
      className={`selectable-tile selectable-tile--${variant} ${selected ? 'selectable-tile--selected' : ''} ${disabled ? 'selectable-tile--disabled' : ''} ${loading ? 'selectable-tile--loading' : ''} ${pending ? 'selectable-tile--pending' : ''} ${isPrimary ? 'selectable-tile--primary' : 'selectable-tile--degradation'}`}
      onClick={disabled || loading ? undefined : onClick}
      hoverClass={disabled || loading ? undefined : 'selectable-tile--hover'}
      role='button'
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      aria-disabled={disabled || loading}
    >
      {selected && checkmark && isCard && (
        <View className='selectable-tile__check' aria-hidden='true'>
          <Text className='selectable-tile__check-icon'>✓</Text>
        </View>
      )}

      {icon && <View className='selectable-tile__icon'>{icon}</View>}

      <Text className='selectable-tile__label'>{label}</Text>

      {selected && checkmark && !isCard && (
        <View className='selectable-tile__check selectable-tile__check--inline' aria-hidden='true'>
          <Text className='selectable-tile__check-icon'>✓</Text>
        </View>
      )}

      {pending && (
        <View className='selectable-tile__pending-badge' aria-hidden='true'>
          <Text className='selectable-tile__pending-badge-text'>待解锁</Text>
        </View>
      )}
      {children && !pending && <View className='selectable-tile__children'>{children}</View>}
    </View>
  )
}
